# Multi-Agent_Workflow | AI Samrat

> **Enterprise Multi-Agent Intelligence System**  
> *4 Specialist Agents • PowerPoint RAG Grounding • Model Fallback Architecture • MongoDB Atlas*

---

## 🌟 Overview & System Highlights

Single AI models struggle with complex, multi-step goals that require deep research, drafting, and quality audit. This system implements an autonomous **4-Specialist Agent Workflow** coordinated via **LangGraph**, backed by a high-concurrency **FastAPI** server and an interactive **React + Vite** dashboard with real-time **Server-Sent Events (SSE)** streaming.

```
                     ┌─────────────────────────────────────────┐
                     │          User Goal & PPT Upload         │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │   Manager Agent   │
                                │ (Task Allocation) │
                                └─────────┬─────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │ Researcher Agent  │◄── PowerPoint Slides RAG
                                │ (Grounding & DDG) │◄── DuckDuckGo Web Search
                                └─────────┬─────────┘
                                          │
                                          ▼
                             ┌──►┌───────────────────┐
                             │   │   Writer Agent    │
           Revision Loop     │   │ (Markdown Draft)  │
      (Capped at 2 Iterations)   └─────────┬─────────┘
                             │             │
                             │             ▼
                             │   ┌───────────────────┐
                             └───┤  Reviewer Agent   │───► [ Approved Deliverable ]
                                 │ (Audit & Sources) │
                                 └───────────────────┘
```

---

## 📐 Architecture Breakdown: Frontend, Backend & Database

### 1. Frontend Layer (`frontend/`)
- **Branding**: AI Samrat Software Solutions.
- **Technology**: React 18, Vite, Lucide Icons, Glassmorphism Design System.
- **PowerPoint File Uploader**:
  - Drag-and-drop support for `.pptx`, `.ppt`, and documents.
  - Automatically parses slides and provides an interactive **Slide Preview Modal** to inspect slide titles, bullet points, and speaker notes before running agents.
- **Agent Pipeline Visualizer**:
  - Live interactive graph showing all 4 specialist agent nodes (`Manager`, `Researcher`, `Writer`, `Reviewer`).
  - Active node glowing animations, pulse rings, and dynamic **Feedback Loop badges** showing revision counters (`Revision 1/2`).
- **Live Progress Streaming (SSE)**:
  - Subscribes to `/api/stream/{run_id}` via Server-Sent Events.
  - Displays real-time thoughts, tool calls (e.g., slide retrieval, DuckDuckGo search queries), and agent handoffs.
  - Filterable by agent.
- **Verified Deliverable & Audit Scorecard**:
  - Automatically detects whether a goal requests code (for example, “build a REST API”) or a report (for example, “analyze the presentation”); unspecified goals retain the code default.
  - Renders code and Markdown reports in the appropriate format.
  - Reviewer score (e.g. `94/100`), approval status, and round-by-round critique history.
  - Slide citations badges that link claims to specific presentation slides.
  - One-click copy and download (`.txt` for code, `.md` for reports).
- **Configuration & Key Manager**:
  - In-app modal to test MongoDB Atlas connectivity and enter API keys with `localStorage` persistence.

---

### 2. Backend Layer (`backend/`)
- **Technology**: Python 3.14, FastAPI, Uvicorn, LangGraph, python-pptx, DuckDuckGo Search (`ddgs`).
- **Endpoints**:
  - `POST /api/upload`: Uploads and parses `.pptx` slides, notes, tables, and words.
  - `GET /api/files`: Lists all uploaded presentation documents.
  - `GET /api/files/{file_id}`: Fetches all slide details for a presentation.
  - `DELETE /api/files/{file_id}`: Removes presentation and vector indices.
  - `POST /api/runs`: Launches a LangGraph multi-agent execution run in the background.
  - `GET /api/runs`: Lists past runs with statuses and timestamps.
  - `GET /api/runs/{run_id}`: Retrieves complete run data, drafts, reviews, and step logs.
  - `GET /api/stream/{run_id}`: Real-time Server-Sent Events (SSE) streaming progress.
  - `POST /api/settings/test-db`: Tests MongoDB Atlas cluster connection.
  - `GET /api/health`: System health and provider status.
- **Agent Orchestration (LangGraph `StateGraph`)**:
  - **Manager**: Decomposes user directives into 4 specialist tasks.
  - **Researcher**: RAG retrieval over uploaded PowerPoint slides + live web intelligence.
  - **Writer**: Produces goal-appropriate code or a structured Markdown report, incorporating research notes and previous critiques.
  - **Reviewer**: Audits code quality and security or report accuracy and grounding, then routes back to `Writer` for revisions as needed.
- **LLM Multi-Provider Fallback**:
  - Automatic provider chain: **Gemini → Groq → OpenRouter → Built-in Specialist Engine**.

---

### 3. Database Layer (`database.py`)
- **Technology**: MongoDB Atlas (`pymongo`).
- **Collections**:
  - `runs`: Stores run metadata, goal, current agent, drafts, and final approved reports.
  - `steps`: Detailed real-time log of agent thoughts, tool calls, and outputs.
  - `documents`: Uploaded PowerPoint files metadata, slide contents, bullet points, and speaker notes.
- **Resilient Offline/Local Fallback**:
  - If a MongoDB Atlas URI is not configured, the database manager automatically persists data to local JSON storage in `backend/data/`.

---

## 🚀 Quick Start Guide

### 1. Launch with One Click
Double click or run:
```cmd
start.bat
```
This automatically starts:
- **FastAPI Backend**: `http://localhost:8000` (API Docs: `http://localhost:8000/docs`)
- **React Frontend**: `http://localhost:5173`

The launcher resolves paths relative to `start.bat`, so it works when the project folder is moved. On first setup, install the backend requirements with `python -m pip install -r backend\requirements.txt` and the frontend dependencies with `npm install --prefix frontend`. The launcher uses the project virtual environment when it is usable, otherwise it checks the Python environment on `PATH`.

---

### 2. Manual Startup

#### Backend:
```powershell
cd backend
..\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Frontend:
```cmd
cd frontend
set TEMP=D:\temp
set TMP=D:\temp
set npm_config_prefix=D:\temp\npm-global
set npm_config_cache=D:\temp\npm-cache
npm run dev
```

---

## 🔑 API Keys & Integrations (Optional)

Configure via `.env` or in the UI by clicking **"Settings & Keys"**:
- **MongoDB Atlas**: Cluster connection string (`mongodb+srv://...`)
- **Google Gemini**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Groq**: [Groq Console](https://console.groq.com/keys)
- **OpenRouter**: [OpenRouter](https://openrouter.ai/keys)
