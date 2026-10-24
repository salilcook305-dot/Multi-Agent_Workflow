import time
from typing import List, Dict, Any
from duckduckgo_search import DDGS

class SearchService:
    def __init__(self):
        self.ddgs = DDGS()

    def search(self, query: str, max_results: int = 4) -> List[Dict[str, str]]:
        """
        Runs a web search using DuckDuckGo search service.
        Returns list of dicts: {'title': str, 'snippet': str, 'url': str}
        """
        results: List[Dict[str, str]] = []
        try:
            ddg_gen = self.ddgs.text(query, max_results=max_results)
            for item in ddg_gen:
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("body", ""),
                    "url": item.get("href", "")
                })
        except Exception as e:
            print(f"[SearchService] Web search failed for query '{query}': {e}")

        return results

search_service = SearchService()
