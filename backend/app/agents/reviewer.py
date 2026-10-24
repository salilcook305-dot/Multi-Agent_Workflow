import json
from typing import Dict, Any, List, Tuple
from app.services.llm_service import llm_service
from app.agents.output_type import detect_output_type

def run_reviewer_agent(
    goal: str,
    draft: str,
    research_summary: str,
    citations: List[Dict[str, str]],
    revision_count: int = 0,
    max_revisions: int = 2,
    custom_keys: Dict[str, str] = None,
    log_callback = None,
    output_type: str = None
) -> Dict[str, Any]:
    """
    Reviewer Agent: Evaluates the Writer's output for quality and adherence to the goal.
    Enforces the feedback loop back to the Writer if quality threshold (< 85) is not met,
    capped at max_revisions.
    """
    output_type = output_type or detect_output_type(goal)
    is_code = output_type == "code"
    review_focus = (
        "code correctness, completeness, code quality, error handling, and security"
        if is_code else
        "report accuracy, completeness, clarity, evidence grounding, and citation quality"
    )
    deliverable_name = "CODE" if is_code else "REPORT"
    review_criteria = """
1. Correctness: Does the code correctly implement the user's goal? Are there logic errors, off-by-one bugs, or missing edge cases?
2. Completeness: Does it fully address the requirements, without missing functions or TODO stubs?
3. Code Quality: Is it clean, modular, and aligned with language-specific best practices?
4. Error Handling: Does it handle errors gracefully and validate inputs?
5. Documentation: Are public APIs understandable and properly documented?
6. Security: Are there obvious security issues such as hardcoded secrets, injection, or unsanitized inputs?
""" if is_code else """
1. Accuracy: Are factual claims consistent with the research context and available references?
2. Completeness: Does the report address the user's goal and all important requirements?
3. Evidence Grounding: Are claims supported by citations, with assumptions and gaps identified?
4. Clarity: Is the report well-structured, readable, and appropriately concise?
5. Usefulness: Are conclusions and recommendations relevant and actionable?
6. Balanced Treatment: Does it represent uncertainty and avoid unsupported conclusions?
"""

    if log_callback:
        log_callback(
            "reviewer",
            "thinking",
            f"Reviewer evaluating {output_type} quality and goal adherence (Iteration #{revision_count + 1})..."
        )

    citation_titles = [c.get("title", "") for c in citations]

    prompt = f"""
You are the Reviewer Agent in a Multi-Agent Workflow System.
Your job is to critically review the deliverable produced by the Writer Agent.
Requested deliverable type: {output_type}

Evaluate the {output_type} on these criteria:
{review_criteria}

User Goal: {goal}

Current Revision Iteration: {revision_count} (Max allowed: {max_revisions})

Research Context (grounding for the deliverable):
{research_summary[:1500]}

Available References:
{', '.join(citation_titles[:10])}

{deliverable_name} to Review:
{draft[:3000]}

Output your evaluation in this EXACT JSON format:
{{
  "score": 88,
  "approved": true,
  "quality_summary": "Summary of the deliverable quality assessment.",
  "critiques": [
    "Specific issue to fix",
    "Another concrete improvement needed"
  ],
  "suggestions": "Actionable suggestions for improving the code."
}}

Scoring guide:
- 90-100: High-quality, complete, well-grounded deliverable. Approve.
- 75-89: Useful but has quality issues. Request revision with specific fixes.
- Below 75: Significant errors, missing requirements, or poor structure. Request revision.

Set "approved" to true only if score >= 85.
Do not include any text outside the JSON.
"""

    response = llm_service.generate(
        prompt,
        system_instruction=f"You are a rigorous reviewer. Focus on {review_focus}. Be specific and actionable in your feedback.",
        agent_role="reviewer",
        custom_keys=custom_keys
    )

    review_data = None
    try:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
        review_data = json.loads(clean)
    except Exception:
        pass

    # A malformed provider response is not evidence that the code passed review.
    if not review_data or not isinstance(review_data, dict):
        review_data = {
            "score": 0,
            "approved": False,
            "quality_summary": "The reviewer response was unavailable or invalid, so the code could not be verified.",
            "critiques": [
                "Review the code manually for correctness, completeness, and adherence to the goal."
            ],
            "suggestions": "Check the configured AI provider and retry for a proper code review."
        }

    # Enforce maximum revision cap rule
    if revision_count >= max_revisions:
        review_data["approved"] = True
        review_data["quality_summary"] += f" (Auto-approved: reached max revisions limit of {max_revisions})."

    if log_callback:
        status_msg = f"Code review completed. Score: {review_data.get('score', 0)}/100. " + \
                     ("Approved!" if review_data.get("approved") else f"Changes requested (Returning to Writer, Rev {revision_count + 1}/{max_revisions}).")
        log_callback("reviewer", "completed" if review_data.get("approved") else "revision", status_msg, review_data)

    return review_data
