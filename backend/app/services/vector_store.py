import re
import math
from typing import List, Dict, Any, Optional
from app.database import db_manager

class DocumentVectorStore:
    """
    RAG service for presentation slides and documents.
    Provides semantic/keyword retrieval over uploaded slides
    with slide number and source document citations.
    """
    def __init__(self):
        pass

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"\b\w{3,}\b", text.lower())

    def search_slides(self, query: str, file_ids: Optional[List[str]] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top relevant slides matching the query across all or selected uploaded files.
        """
        all_docs = db_manager.list_documents()
        if file_ids:
            all_docs = [d for d in all_docs if d.get("file_id") in file_ids]

        if not all_docs:
            return []

        query_tokens = set(self._tokenize(query))
        if not query_tokens:
            return []

        scored_slides = []

        for doc in all_docs:
            filename = doc.get("original_name") or doc.get("filename", "Presentation")
            file_id = doc.get("file_id")
            slides = doc.get("slides", [])

            for slide in slides:
                slide_num = slide.get("slide_number", 1)
                title = slide.get("title", "")
                content = slide.get("content", "")
                notes = slide.get("notes", "")
                bullets = " ".join(slide.get("bullet_points", []))

                combined_text = f"{title} {content} {bullets} {notes}"
                slide_tokens = self._tokenize(combined_text)

                if not slide_tokens:
                    continue

                # Compute keyword overlap & title match bonus
                score = 0.0
                title_lower = title.lower()
                for token in query_tokens:
                    tf = slide_tokens.count(token)
                    if tf > 0:
                        score += 1.0 + math.log(1.0 + tf)
                    if token in title_lower:
                        score += 3.0  # boost if keyword appears in slide title

                if score > 0:
                    scored_slides.append({
                        "file_id": file_id,
                        "filename": filename,
                        "slide_number": slide_num,
                        "title": title,
                        "content": content,
                        "bullet_points": slide.get("bullet_points", []),
                        "notes": notes,
                        "score": round(score, 2),
                        "citation": f"[{filename} - Slide {slide_num}: {title}]"
                    })

        # Sort descending by score
        scored_slides.sort(key=lambda x: x["score"], reverse=True)
        return scored_slides[:top_k]

vector_store = DocumentVectorStore()
