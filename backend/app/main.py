import os
import uuid
import time
import json
import asyncio
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from app.config import settings
from app.models import GoalRunRequest, UploadedFileMetadata
from app.database import db_manager
from app.services.ppt_parser import parse_document
from app.agents.graph import (
    execute_run_workflow,
    subscribe_to_run,
    unsubscribe_from_run
)

app = FastAPI(
    title="Multi-Agent Workflow API",
    description="Backend API for 4-Agent Workflow System with PowerPoint upload, LangGraph orchestration, and MongoDB Atlas.",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite default port 5173 and others)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "mongodb_connected": db_manager.is_connected,
        "database_mode": "MongoDB Atlas" if db_manager.is_connected else "Local File Persistence (Fallback)",
        "gemini_key_set": bool(settings.gemini_api_key or os.getenv("GEMINI_API_KEY")),
        "groq_key_set": bool(settings.groq_api_key or os.getenv("GROQ_API_KEY")),
        "openrouter_key_set": bool(settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")),
        "timestamp": time.time()
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload and parse PowerPoint presentations (.pptx, .ppt) and documents.
    Extracts slides, titles, body text, bullet points, and speaker notes.
    """
    filename = file.filename or "presentation.pptx"
    ext = Path(filename).suffix.lower()

    if ext not in [".pptx", ".ppt", ".txt", ".md", ".json"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Please upload a PowerPoint (.pptx, .ppt) or text document."
        )

    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}_{filename}"
    saved_path = settings.upload_dir / saved_filename

    try:
        content = await file.read()
        with open(saved_path, "wb") as f:
            f.write(content)

        metadata = parse_document(saved_path, original_filename=filename)
        metadata.file_id = file_id

        # Save to database (MongoDB Atlas or fallback)
        db_manager.save_document(metadata.model_dump())

        return {
            "success": True,
            "message": f"Successfully parsed {metadata.slide_count} slides from {filename}.",
            "file": metadata.model_dump()
        }
    except Exception as e:
        if saved_path.exists():
            saved_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@app.get("/api/files")
def get_files():
    """List all uploaded presentation files."""
    return db_manager.list_documents()

@app.get("/api/files/{file_id}")
def get_file_detail(file_id: str):
    """Get full details of a specific presentation including all slides."""
    doc = db_manager.get_document(file_id)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    return doc

@app.delete("/api/files/{file_id}")
def delete_file(file_id: str):
    """Delete an uploaded presentation."""
    doc = db_manager.get_document(file_id)
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    saved_path = settings.upload_dir / doc.get("filename", "")
    if saved_path.exists():
        try:
            saved_path.unlink()
        except Exception:
            pass

    db_manager.delete_document(file_id)
    return {"success": True, "message": "File deleted"}

@app.post("/api/runs")
async def start_run(req: GoalRunRequest, background_tasks: BackgroundTasks):
    """
    Initiates a new multi-agent execution run with LangGraph.
    Coordinates Manager -> Researcher -> Writer -> Reviewer.
    """
    if not req.goal or not req.goal.strip():
        raise HTTPException(status_code=400, detail="Goal cannot be empty")

    run_id = str(uuid.uuid4())
    custom_keys = {
        "gemini_api_key": req.gemini_api_key or "",
        "groq_api_key": req.groq_api_key or "",
        "openrouter_api_key": req.openrouter_api_key or ""
    }

    if req.mongodb_uri:
        db_manager.update_uri(req.mongodb_uri)

    background_tasks.add_task(
        execute_run_workflow,
        run_id=run_id,
        goal=req.goal,
        file_ids=req.file_ids,
        max_revisions=req.max_revisions,
        custom_keys=custom_keys
    )

    return {
        "run_id": run_id,
        "status": "started",
        "message": "Multi-agent workflow launched. Listen to /api/stream/{run_id} for live progress."
    }

@app.get("/api/runs")
def list_runs():
    """Get all past and current workflow runs."""
    return db_manager.list_runs()

@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    """Get status and results of a specific run."""
    run = db_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    steps = db_manager.get_run_steps(run_id)
    return {"run": run, "steps": steps}

@app.get("/api/stream/{run_id}")
async def stream_run_progress(run_id: str):
    """
    Server-Sent Events (SSE) streaming endpoint for live agent progress.
    Pushes real-time events from the 4 agents to the frontend.
    """
    queue = subscribe_to_run(run_id)

    async def event_generator():
        # First send any existing historical steps from this run
        existing_steps = db_manager.get_run_steps(run_id)
        for step in existing_steps:
            yield f"data: {json.dumps(step)}\n\n"

        # Check if run is already finished
        run = db_manager.get_run(run_id)
        if run and run.get("status") in ["completed", "failed"]:
            yield f"data: {json.dumps({'run_id': run_id, 'agent': 'system', 'step_type': run.get('status'), 'message': 'Run already finished.'})}\n\n"
            unsubscribe_from_run(run_id, queue)
            return

        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("step_type") in ["completed", "error"] and event.get("agent") == "system":
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": ping\n\n"
                    run_check = db_manager.get_run(run_id)
                    if run_check and run_check.get("status") in ["completed", "failed"]:
                        break
        finally:
            unsubscribe_from_run(run_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/settings/test-db")
def test_mongodb_connection(payload: dict):
    uri = payload.get("mongodb_uri", "")
    if not uri:
        raise HTTPException(status_code=400, detail="MongoDB URI is required")
    connected = db_manager.update_uri(uri)
    return {
        "connected": connected,
        "message": "Connected to MongoDB Atlas successfully!" if connected else "Could not connect to MongoDB Atlas. Check your URI or network access."
    }
