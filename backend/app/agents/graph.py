import asyncio
import time
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from app.agents.manager import run_manager_agent
from app.agents.researcher import run_researcher_agent
from app.agents.writer import run_writer_agent
from app.agents.reviewer import run_reviewer_agent
from app.agents.output_type import detect_output_type
from app.database import db_manager

class WorkflowState(TypedDict):
    run_id: str
    goal: str
    output_type: str
    file_ids: List[str]
    custom_keys: Dict[str, str]
    max_revisions: int
    revision_count: int
    tasks: List[Dict[str, Any]]
    research_summary: str
    citations: List[Dict[str, str]]
    draft: str
    reviews: List[Dict[str, Any]]
    latest_review: Optional[Dict[str, Any]]
    approved: bool
    final_output: str

# In-memory streaming event queues for active runs (for SSE endpoints)
run_event_queues: Dict[str, List[asyncio.Queue]] = {}

def subscribe_to_run(run_id: str) -> asyncio.Queue:
    if run_id not in run_event_queues:
        run_event_queues[run_id] = []
    q: asyncio.Queue = asyncio.Queue()
    run_event_queues[run_id].append(q)
    return q

def unsubscribe_from_run(run_id: str, q: asyncio.Queue):
    if run_id in run_event_queues:
        if q in run_event_queues[run_id]:
            run_event_queues[run_id].remove(q)

def broadcast_event(run_id: str, agent: str, step_type: str, message: str, details: Dict[str, Any] = None):
    event = {
        "run_id": run_id,
        "agent": agent,
        "step_type": step_type,
        "message": message,
        "details": details or {},
        "timestamp": time.time()
    }
    # Log to MongoDB / local persistence
    db_manager.log_step(event)

    # Broadcast to all active SSE subscribers
    queues = run_event_queues.get(run_id, [])
    for q in list(queues):
        try:
            q.put_nowait(event)
        except Exception:
            pass

def build_workflow_graph():
    """
    Builds the stateful LangGraph workflow representing:
    Manager -> Researcher -> Writer -> Reviewer -(conditional loop)-> Writer or END
    """
    graph = StateGraph(WorkflowState)

    def manager_node(state: WorkflowState) -> Dict[str, Any]:
        run_id = state["run_id"]
        broadcast_event(run_id, "manager", "start", "Manager Agent analyzing goal and scoping task breakdown...")
        
        tasks = run_manager_agent(
            state["goal"],
            state["file_ids"],
            state.get("custom_keys"),
            state["output_type"]
        )
        
        broadcast_event(
            run_id,
            "manager",
            "completed",
            f"Manager formulated {len(tasks)} specialist tasks for the team.",
            {"tasks": tasks}
        )
        return {"tasks": tasks}

    def researcher_node(state: WorkflowState) -> Dict[str, Any]:
        run_id = state["run_id"]
        broadcast_event(run_id, "researcher", "start", "Researcher Agent starting document RAG and web queries...")

        def log_cb(agent, stype, msg, det=None):
            broadcast_event(run_id, agent, stype, msg, det)

        summary, citations = run_researcher_agent(
            state["goal"],
            state["tasks"],
            state["file_ids"],
            state.get("custom_keys"),
            log_callback=log_cb
        )
        return {"research_summary": summary, "citations": citations}

    def writer_node(state: WorkflowState) -> Dict[str, Any]:
        run_id = state["run_id"]
        rev_count = state.get("revision_count", 0)

        def log_cb(agent, stype, msg, det=None):
            broadcast_event(run_id, agent, stype, msg, det)

        draft = run_writer_agent(
            goal=state["goal"],
            research_summary=state["research_summary"],
            citations=state["citations"],
            tasks=state["tasks"],
            revision_count=rev_count,
            review_feedback=state.get("latest_review"),
            custom_keys=state.get("custom_keys"),
            log_callback=log_cb,
            output_type=state["output_type"]
        )
        return {"draft": draft}

    def reviewer_node(state: WorkflowState) -> Dict[str, Any]:
        run_id = state["run_id"]
        rev_count = state.get("revision_count", 0)
        max_rev = state.get("max_revisions", 2)

        def log_cb(agent, stype, msg, det=None):
            broadcast_event(run_id, agent, stype, msg, det)

        review = run_reviewer_agent(
            goal=state["goal"],
            draft=state["draft"],
            research_summary=state["research_summary"],
            citations=state["citations"],
            revision_count=rev_count,
            max_revisions=max_rev,
            custom_keys=state.get("custom_keys"),
            log_callback=log_cb,
            output_type=state["output_type"]
        )

        all_reviews = list(state.get("reviews", []))
        all_reviews.append(review)
        approved = review.get("approved", False)
        new_rev_count = rev_count + 1 if not approved else rev_count

        return {
            "reviews": all_reviews,
            "latest_review": review,
            "approved": approved,
            "revision_count": new_rev_count,
            "final_output": state["draft"] if approved else ""
        }

    # Conditional routing logic for feedback loop
    def should_continue(state: WorkflowState) -> str:
        if state.get("approved"):
            return "end"
        if state.get("revision_count", 0) >= state.get("max_revisions", 2):
            return "end"
        return "writer"

    # Add Nodes
    graph.add_node("manager", manager_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("writer", writer_node)
    graph.add_node("reviewer", reviewer_node)

    # Add Edges
    graph.set_entry_point("manager")
    graph.add_edge("manager", "researcher")
    graph.add_edge("researcher", "writer")
    graph.add_edge("writer", "reviewer")

    # Conditional Edge from reviewer
    graph.add_conditional_edges(
        "reviewer",
        should_continue,
        {
            "writer": "writer",
            "end": END
        }
    )

    return graph.compile()

# Compile the singleton LangGraph workflow app
workflow_app = build_workflow_graph()

async def execute_run_workflow(
    run_id: str,
    goal: str,
    file_ids: List[str],
    max_revisions: int = 2,
    custom_keys: Dict[str, str] = None
):
    """
    Executes the compiled LangGraph workflow asynchronously in the background.
    """
    # Initial run record save
    initial_run = {
        "run_id": run_id,
        "goal": goal,
        "output_type": detect_output_type(goal),
        "file_ids": file_ids,
        "status": "running",
        "current_agent": "manager",
        "revision_count": 0,
        "max_revisions": max_revisions,
        "tasks": [],
        "research_summary": "",
        "citations": [],
        "draft": "",
        "reviews": [],
        "final_output": "",
        "created_at": time.time(),
        "completed_at": None
    }
    db_manager.save_run(initial_run)
    broadcast_event(run_id, "system", "start", f"Workflow execution initiated for goal: '{goal[:60]}...'")

    initial_state: WorkflowState = {
        "run_id": run_id,
        "goal": goal,
        "output_type": initial_run["output_type"],
        "file_ids": file_ids,
        "custom_keys": custom_keys or {},
        "max_revisions": max_revisions,
        "revision_count": 0,
        "tasks": [],
        "research_summary": "",
        "citations": [],
        "draft": "",
        "reviews": [],
        "latest_review": None,
        "approved": False,
        "final_output": ""
    }

    try:
        # Run the LangGraph state machine in executor to avoid blocking event loop
        loop = asyncio.get_event_loop()
        final_state = await loop.run_in_executor(None, workflow_app.invoke, initial_state)

        # Save final state in MongoDB Atlas / persistence
        completed_run = {
            "run_id": run_id,
            "goal": goal,
            "output_type": final_state.get("output_type", initial_run["output_type"]),
            "file_ids": file_ids,
            "status": "completed",
            "current_agent": "completed",
            "revision_count": final_state.get("revision_count", 0),
            "max_revisions": max_revisions,
            "tasks": final_state.get("tasks", []),
            "research_summary": final_state.get("research_summary", ""),
            "citations": final_state.get("citations", []),
            "draft": final_state.get("draft", ""),
            "reviews": final_state.get("reviews", []),
            "final_output": final_state.get("final_output") or final_state.get("draft", ""),
            "created_at": initial_run["created_at"],
            "completed_at": time.time()
        }
        db_manager.save_run(completed_run)

        broadcast_event(
            run_id,
            "system",
            "completed",
            "Workflow finished successfully! Final report is ready.",
            {"final_output": completed_run["final_output"]}
        )

    except Exception as e:
        error_msg = f"Workflow failed during execution: {str(e)}"
        print(f"[WorkflowGraph] {error_msg}")
        failed_run = db_manager.get_run(run_id) or initial_run
        failed_run["status"] = "failed"
        failed_run["error_message"] = error_msg
        failed_run["completed_at"] = time.time()
        db_manager.save_run(failed_run)

        broadcast_event(run_id, "system", "error", error_msg)
