from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_service
from app.agents.output_type import detect_output_type

def run_writer_agent(
    goal: str,
    research_summary: str,
    citations: List[Dict[str, str]],
    tasks: List[Dict[str, Any]],
    revision_count: int = 0,
    review_feedback: Optional[Dict[str, Any]] = None,
    custom_keys: Dict[str, str] = None,
    log_callback = None,
    output_type: Optional[str] = None
) -> str:
    """
    Writer Agent: Transforms research findings and manager directives into
    either clean, production-ready code or a well-structured report.
    If called in a feedback revision loop, actively incorporates reviewer critiques.
    """
    output_type = output_type or detect_output_type(goal)
    is_code = output_type == "code"
    deliverable = "production-ready code" if is_code else "a clear, evidence-grounded report"
    is_revision = revision_count > 0 and review_feedback is not None

    if log_callback:
        if is_revision:
            log_callback(
                "writer",
                "revision",
                f"Writer incorporating Reviewer feedback (Revision #{revision_count}): Revising {output_type}..."
            )
        else:
            log_callback("writer", "start", f"Writer generating {deliverable} based on research dossier...")

    revision_instructions = ""
    if is_revision and review_feedback:
        critiques = review_feedback.get("critiques", [])
        critique_bullets = "\n".join([f"- {c}" for c in critiques])
        revision_instructions = f"""
ATTENTION - REVISION REQUIRED (Iteration {revision_count}):
The Reviewer reviewed your previous draft and provided the following feedback:
Summary: {review_feedback.get('quality_summary', '')}
Specific Critiques to Fix:
{critique_bullets}
Suggestions: {review_feedback.get('suggestions', '')}

You MUST explicitly resolve each of these critiques in this updated draft!
"""

    citation_list = "\n".join([f"- {c.get('title')} ({c.get('url', 'local')})" for c in citations])

    output_guidelines = """
Code Writing Guidelines:
1. Output ONLY code — no Markdown formatting, no prose paragraphs, no explanation outside of code comments.
2. If multiple files are needed, clearly separate them with a comment header like:
   # ===== FILE: <filename> =====
3. Write clean, modular, well-commented code with proper imports, error handling, and type hints where applicable.
4. Follow best practices for the relevant language/framework (PEP 8 for Python, ESLint conventions for JS/TS, etc.).
5. Include docstrings/JSDoc for all public classes, functions, and modules.
6. If configuration or environment variables are needed, document them in a comment block at the top or in a separate config file section.
7. Infer the most appropriate programming language(s) from the goal and research context. Default to Python if ambiguous.
8. Reference relevant findings from the research dossier as inline code comments where they informed design decisions.
""" if is_code else """
Report Writing Guidelines:
1. Write a complete, clearly structured Markdown report that directly answers the user's goal.
2. Ground factual claims in the research dossier and cite relevant references inline.
3. Distinguish evidence from assumptions, and identify meaningful gaps or limitations.
4. Use concise headings, lists, and tables when they improve readability.
5. Do not include source code unless the user explicitly requests it.
"""

    prompt = f"""
You are the Writer Agent in a Multi-Agent Workflow System.
Your responsibility is to produce {deliverable} that directly fulfills the user's goal.
Deliverable type: {output_type}

Target Goal: {goal}

Manager Tasks:
{chr(10).join([f"- {t.get('title')}: {t.get('description')}" for t in tasks])}

Research Evidence & Grounding Dossier:
{research_summary}

Available References:
{citation_list}

{revision_instructions}

{output_guidelines}
"""

    draft = llm_service.generate(
        prompt,
        system_instruction=(
            "You are an expert software engineer agent. Produce only clean, production-ready code."
            if is_code else
            "You are an expert research writer. Produce clear, evidence-grounded, well-structured Markdown reports."
        ),
        agent_role="writer",
        custom_keys=custom_keys
    )

    if log_callback:
        log_callback(
            "writer",
            "completed",
            f"{output_type.title()} generation completed ({len(draft.split())} tokens)." + (f" (Revision {revision_count})" if is_revision else "")
        )

    return draft
