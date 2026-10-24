from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import time
import uuid

class SlideData(BaseModel):
    slide_number: int
    title: str = ""
    content: str = ""
    notes: str = ""
    bullet_points: List[str] = Field(default_factory=list)

class UploadedFileMetadata(BaseModel):
    file_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_name: str
    file_size_bytes: int
    slide_count: int
    total_words: int
    slides: List[SlideData] = Field(default_factory=list)
    uploaded_at: float = Field(default_factory=time.time)

class GoalRunRequest(BaseModel):
    goal: str
    file_ids: List[str] = Field(default_factory=list)
    max_revisions: int = 2
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    mongodb_uri: Optional[str] = None

class AgentStepEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str
    agent: str  # 'manager', 'researcher', 'writer', 'reviewer', 'system'
    step_type: str  # 'start', 'thinking', 'tool_call', 'tool_result', 'revision', 'completed', 'error'
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: float = Field(default_factory=time.time)

class ManagerTask(BaseModel):
    id: int
    title: str
    description: str
    assigned_to: str
    status: str = "pending"

class ReviewFeedback(BaseModel):
    iteration: int
    score: int
    quality_summary: str
    critiques: List[str] = Field(default_factory=list)
    approved: bool
    suggestions: str = ""

class RunRecord(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    goal: str
    file_ids: List[str] = Field(default_factory=list)
    status: str = "queued"  # queued, running, completed, failed
    current_agent: str = "manager"
    revision_count: int = 0
    max_revisions: int = 2
    tasks: List[Dict[str, Any]] = Field(default_factory=list)
    research_summary: str = ""
    research_sources: List[Dict[str, str]] = Field(default_factory=list)
    current_draft: str = ""
    reviews: List[Dict[str, Any]] = Field(default_factory=list)
    final_output: str = ""
    error_message: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    completed_at: Optional[float] = None
