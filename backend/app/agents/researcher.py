from typing import Dict, Any, List, Tuple
from app.services.vector_store import vector_store
from app.services.search_service import search_service
from app.services.llm_service import llm_service

def run_researcher_agent(
    goal: str,
    tasks: List[Dict[str, Any]],
    file_ids: List[str],
    custom_keys: Dict[str, str] = None,
    log_callback = None
) -> Tuple[str, List[Dict[str, str]]]:
    """
    Researcher Agent: Retrieves factual grounding from both uploaded presentation slides (RAG)
    and live web search (DuckDuckGo). Produces a two-part evidence dossier:
    1. STRUCTURED EVIDENCE — raw slide data and web excerpts passed through verbatim
    2. RESEARCHER ANALYSIS — LLM-generated insights, gap analysis, and implementation guidance
    The Writer receives both parts so it has full access to the original evidence.
    """
    if log_callback:
        log_callback("researcher", "tool_call", "Querying document vector store for uploaded PowerPoint slides...")

    # 1. Slide Retrieval (RAG)
    matched_slides = vector_store.search_slides(goal, file_ids=file_ids, top_k=6)
    
    # Also search by task keywords if few slides matched
    if len(matched_slides) < 3 and tasks:
        task_query = " ".join([t.get("title", "") for t in tasks])
        extra_slides = vector_store.search_slides(task_query, file_ids=file_ids, top_k=4)
        for s in extra_slides:
            if not any(existing["slide_number"] == s["slide_number"] and existing["file_id"] == s["file_id"] for existing in matched_slides):
                matched_slides.append(s)

    structured_slides = []
    citations: List[Dict[str, str]] = []

    for s in matched_slides:
        cit_str = s["citation"]
        citations.append({"type": "slide", "title": cit_str, "url": f"#slide-{s['slide_number']}"})

        # Build structured evidence block per slide
        block_lines = [
            f"--- EVIDENCE SOURCE: {cit_str} ---",
            f"  Slide Number : {s['slide_number']}",
            f"  Title        : {s['title']}",
        ]
        if s["content"]:
            block_lines.append(f"  Content      : {s['content']}")
        if s["bullet_points"]:
            block_lines.append("  Key Points   :")
            for bp in s["bullet_points"]:
                block_lines.append(f"    • {bp}")
        if s.get("notes"):
            block_lines.append(f"  Speaker Notes: {s['notes']}")
        block_lines.append(f"  Relevance    : score {s.get('score', 0)}")
        block_lines.append("---")

        structured_slides.append("\n".join(block_lines))

    if log_callback:
        log_callback(
            "researcher",
            "tool_result",
            f"Retrieved {len(matched_slides)} relevant presentation slides for factual grounding.",
            {"slide_citations": [s["citation"] for s in matched_slides]}
        )

    # 2. Live Web Search (DuckDuckGo)
    web_query = goal
    if len(web_query) > 80:
        web_query = web_query[:80]
    
    if log_callback:
        log_callback("researcher", "tool_call", f"Executing DuckDuckGo web search: '{web_query}'")

    web_results = search_service.search(web_query, max_results=3)
    structured_web = []
    for wr in web_results:
        citations.append({"type": "web", "title": wr["title"], "url": wr["url"]})
        structured_web.append(
            f"--- WEB SOURCE: {wr['title']} ---\n"
            f"  URL     : {wr['url']}\n"
            f"  Excerpt : {wr['snippet']}\n"
            f"---"
        )

    if log_callback:
        log_callback("researcher", "tool_result", f"Gathered {len(web_results)} live web search references.")

    # 3. Build the raw structured evidence section (passed through verbatim)
    raw_evidence_lines = ["=" * 60, "STRUCTURED EVIDENCE DOSSIER", "=" * 60, ""]

    if structured_slides:
        raw_evidence_lines.append(f"DOCUMENT EVIDENCE ({len(structured_slides)} slides retrieved):")
        raw_evidence_lines.append("")
        for block in structured_slides:
            raw_evidence_lines.append(block)
            raw_evidence_lines.append("")
    else:
        raw_evidence_lines.append("DOCUMENT EVIDENCE: No matching slides found in uploaded files.")
        raw_evidence_lines.append("")

    if structured_web:
        raw_evidence_lines.append(f"WEB EVIDENCE ({len(structured_web)} sources retrieved):")
        raw_evidence_lines.append("")
        for block in structured_web:
            raw_evidence_lines.append(block)
            raw_evidence_lines.append("")
    else:
        raw_evidence_lines.append("WEB EVIDENCE: No web search results retrieved.")
        raw_evidence_lines.append("")

    raw_evidence = "\n".join(raw_evidence_lines)

    # 4. Use LLM for ANALYSIS ONLY — do not summarize or restate the evidence
    analysis_prompt = f"""
You are the Researcher Agent in a Multi-Agent Workflow System.
The raw evidence from uploaded documents and web search is listed below. It will be passed directly to the Writer Agent — you do NOT need to restate or summarize it.

Your job is ONLY to provide analytical value on top of the raw evidence:

Goal: {goal}

Raw Evidence:
{raw_evidence}

Tasks Assigned by Manager:
{chr(10).join([f"- {t.get('title')}: {t.get('description')}" for t in tasks])}

Provide ONLY the following (do NOT repeat the raw evidence):
1. CONNECTIONS & PATTERNS: What relationships, dependencies, or patterns do you see across the evidence sources?
2. GAPS & MISSING INFO: What information is missing or insufficient for the Writer to complete the goal? What assumptions must be made?
3. TECHNICAL CONSTRAINTS: What technical requirements, limitations, or best practices are implied by the evidence?
4. IMPLEMENTATION GUIDANCE: Based on the evidence, what specific approach, architecture, or design should the Writer follow?
5. PRIORITY RANKING: Which evidence sources are most critical for the goal? Which can be deprioritized?

Be specific. Reference evidence by its source tag (e.g., [Filename - Slide 3: Title] or [Web: Source Title]).
Do NOT restate facts from the evidence — the Writer already has them.
"""

    analysis = llm_service.generate(
        analysis_prompt,
        system_instruction="You are a senior technical research analyst. Your role is to provide analytical insights, identify gaps, and give implementation guidance — NOT to summarize or restate evidence. Be concise and actionable.",
        agent_role="researcher",
        custom_keys=custom_keys
    )

    # 5. Combine: structured evidence (verbatim) + LLM analysis
    full_dossier = (
        f"{raw_evidence}\n"
        f"{'=' * 60}\n"
        f"RESEARCHER ANALYSIS & GUIDANCE\n"
        f"{'=' * 60}\n\n"
        f"{analysis}"
    )

    if log_callback:
        log_callback(
            "researcher",
            "completed",
            f"Evidence dossier assembled: {len(structured_slides)} slide sources, "
            f"{len(structured_web)} web sources, plus analytical guidance."
        )

    return full_dossier, citations
