import json
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_service
from app.database import db_manager
from app.agents.output_type import detect_output_type

def run_manager_agent(
    goal: str,
    file_ids: List[str],
    custom_keys: Dict[str, str] = None,
    output_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Manager Agent: Analyzes user goal and uploaded presentation slides,
    then decomposes the workflow into distinct specialist tasks.
    """
    output_type = output_type or detect_output_type(goal)
    deliverable = "production-ready code" if output_type == "code" else "a grounded written report"

    # Collect summary of available documents
    doc_summaries = []
    for fid in file_ids:
        doc = db_manager.get_document(fid)
        if doc:
            title = doc.get("original_name") or doc.get("filename")
            slides = doc.get("slides", [])
            slide_titles = [s.get("title", f"Slide {s.get('slide_number')}") for s in slides[:6]]
            doc_summaries.append(f"Document: {title} ({len(slides)} slides). Key slide topics: {', '.join(slide_titles)}")

    docs_context = "\n".join(doc_summaries) if doc_summaries else "No documents uploaded. Relying on web search."

    prompt = f"""
You are the Manager Agent in a Multi-Agent Workflow System.
Your responsibility is to decompose the user's high-level goal into actionable tasks for:
1. Researcher (Document RAG + Web Search)
2. Writer (prepare {deliverable})
3. Reviewer (quality, completeness, and grounding audit appropriate to the deliverable)

The requested deliverable type is {output_type}. Ensure the Writer and Reviewer tasks match it.

User Goal: {goal}

Available Grounding Documents:
{docs_context}

Return a valid JSON array of tasks with this exact format:
[
  {{"id": 1, "title": "...", "description": "...", "assigned_to": "Researcher"}},
  {{"id": 2, "title": "...", "description": "...", "assigned_to": "Researcher"}},
  {{"id": 3, "title": "...", "description": "...", "assigned_to": "Writer"}},
  {{"id": 4, "title": "...", "description": "...", "assigned_to": "Reviewer"}}
]
Do not include any markdown fences or extraneous text, only the raw JSON array.
"""

    response = llm_service.generate(prompt, system_instruction="You are an expert technical project manager agent.", agent_role="manager", custom_keys=custom_keys)

    try:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
        tasks = json.loads(clean)
        if isinstance(tasks, list):
            return tasks
    except Exception:
        pass

    # Safe fallback tasks
    writer_description = (
        "Implement the requested solution as clean, production-ready code"
        if output_type == "code"
        else "Synthesize the research into a clear, structured report grounded in the evidence"
    )
    return [
        {"id": 1, "title": "Deconstruct Goal & Slide Requirements", "description": f"Identify core requirements for: {goal[:60]}", "assigned_to": "Researcher"},
        {"id": 2, "title": "Extract Presentation & Web Evidence", "description": "Retrieve exact slide numbers and conduct live web search", "assigned_to": "Researcher"},
        {"id": 3, "title": "Prepare Requested Deliverable", "description": writer_description, "assigned_to": "Writer"},
        {"id": 4, "title": "Quality Audit & Verification", "description": f"Review the {output_type} for quality, completeness, and grounding", "assigned_to": "Reviewer"}
    ]
