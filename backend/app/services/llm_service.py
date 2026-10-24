import os
import json
import requests
from typing import Dict, Any, Optional
from app.config import settings

class LLMService:
    """
    Multi-provider LLM caller supporting:
    1. Google Gemini (REST)
    2. Groq (REST)
    3. OpenRouter (REST)
    With automatic fallback across providers and a built-in intelligent engine
    if no external keys are configured.
    """
    def __init__(self):
        pass

    def call_gemini(self, prompt: str, system_instruction: str = "", api_key: Optional[str] = None) -> Optional[str]:
        key = (api_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        if not key:
            print("[LLM] Gemini skipped: no API key was received.")
            return None

        for model in ["gemini-3.8-flash", "gemini-3.6-flash"]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            payload: Dict[str, Any] = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            if system_instruction:
                payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

            try:
                resp = requests.post(url, json=payload, timeout=20)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text = parts[0].get("text", "").strip()
                            if text:
                                return text
                    print(f"[LLM] Gemini ({model}) returned an empty response.")
                else:
                    print(f"[LLM] Gemini ({model}) returned HTTP {resp.status_code}.")
            except Exception as e:
                print(f"[LLM] Gemini request failed ({type(e).__name__}).")
        return None

    def call_groq(self, prompt: str, system_instruction: str = "", api_key: Optional[str] = None, model: str = "openai/gpt-oss-20b") -> Optional[str]:
        key = (api_key or settings.groq_api_key or os.getenv("GROQ_API_KEY", "")).strip()
        if not key:
            print("[LLM] Groq skipped: no API key was received.")
            return None

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 1500
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                if isinstance(text, str) and text.strip():
                    return text
                print(f"[LLM] Groq ({model}) returned an empty response.")
            else:
                print(f"[LLM] Groq ({model}) returned HTTP {resp.status_code}.")
        except Exception as e:
            print(f"[LLM] Groq request failed ({type(e).__name__}).")
        return None

    def call_openrouter(self, prompt: str, system_instruction: str = "", api_key: Optional[str] = None, model: str = "recursive/flint-v1.0:free") -> Optional[str]:
        key = (api_key or settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")).strip()
        if not key:
            print("[LLM] OpenRouter skipped: no API key was received.")
            return None

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                if isinstance(text, str) and text.strip():
                    return text
                print(f"[LLM] OpenRouter ({model}) returned an empty response.")
            else:
                print(f"[LLM] OpenRouter ({model}) returned HTTP {resp.status_code}.")
        except Exception as e:
            print(f"[LLM] OpenRouter request failed ({type(e).__name__}).")
        return None

    def generate(self, prompt: str, system_instruction: str = "", agent_role: str = "general", custom_keys: Optional[Dict[str, str]] = None) -> str:
        """
        Executes fallback chain across providers. If all fail or no keys provided,
        falls back to specialized rule-based intelligence.
        """
        keys = custom_keys or {}
        gemini_k = keys.get("gemini_api_key")
        groq_k = keys.get("groq_api_key")
        openrouter_k = keys.get("openrouter_api_key")

        # 1. Role-based primary selection
        if agent_role in ["manager", "reviewer"]:
            # Small, fast model
            res = self.call_groq(prompt, system_instruction, groq_k, model="openai/gpt-oss-20b")
            if res:
                return res
            res = self.call_gemini(prompt, system_instruction, gemini_k)
            if res:
                return res
        else:
            # Researcher & Writer: larger / reasoning models
            res = self.call_gemini(prompt, system_instruction, gemini_k)
            if res:
                return res
            res = self.call_groq(prompt, system_instruction, groq_k, model="openai/gpt-oss-120b")
            if res:
                return res

        # 2. Try OpenRouter free tier
        res = self.call_openrouter(prompt, system_instruction, openrouter_k, model="recursive/flint-v1.0:free")
        if res:
            return res

        # 3. Built-in Smart Specialist Fallback Engine
        print(f"[LLM] No provider returned a response for {agent_role}; using the prompt-grounded offline fallback.")
        return self._smart_simulation(prompt, system_instruction, agent_role)

    @staticmethod
    def _prompt_value(prompt: str, label: str) -> str:
        for line in prompt.splitlines():
            if line.startswith(label):
                return line[len(label):].strip()
        return ""

    @staticmethod
    def _prompt_section(prompt: str, label: str, next_labels: tuple[str, ...]) -> str:
        start = prompt.find(label)
        if start == -1:
            return ""
        start += len(label)
        end = len(prompt)
        for next_label in next_labels:
            next_start = prompt.find(next_label, start)
            if next_start != -1:
                end = min(end, next_start)
        return prompt[start:end].strip()

    def _smart_simulation(self, prompt: str, system_instruction: str, agent_role: str) -> str:
        """
        A transparent offline fallback that uses only the goal and evidence
        included in the agent prompt.
        """
        if agent_role == "manager":
            goal = self._prompt_value(prompt, "User Goal:") or "the user's request"
            return json.dumps([
                {"id": 1, "title": "Analyze the request", "description": f"Identify the requirements and scope for: {goal}", "assigned_to": "Researcher"},
                {"id": 2, "title": "Gather supporting evidence", "description": "Use only the selected documents and available search results.", "assigned_to": "Researcher"},
                {"id": 3, "title": "Prepare the deliverable", "description": "Address the user's request using the gathered evidence.", "assigned_to": "Writer"},
                {"id": 4, "title": "Review the deliverable", "description": "Check relevance, completeness, and evidence citations.", "assigned_to": "Reviewer"}
            ])

        elif agent_role == "researcher":
            goal = self._prompt_value(prompt, "Goal:")
            evidence = self._prompt_section(
                prompt,
                "Raw Evidence:",
                ("\n\nTasks Assigned by Manager:",)
            )
            return (
                "=" * 60 + "\n"
                "RESEARCHER ANALYSIS & GUIDANCE\n"
                + "=" * 60 + "\n\n"
                f"Goal: {goal or 'Not provided'}\n\n"
                "1. CONNECTIONS & PATTERNS:\n"
                "   No AI provider was available to analyze the evidence.\n\n"
                "2. GAPS & MISSING INFO:\n"
                "   Unable to identify gaps without an active AI provider.\n\n"
                "3. TECHNICAL CONSTRAINTS:\n"
                "   Review the raw evidence above for technical requirements.\n\n"
                "4. IMPLEMENTATION GUIDANCE:\n"
                "   Use the structured evidence passed through in the dossier.\n\n"
                "5. PRIORITY RANKING:\n"
                "   All evidence sources should be reviewed manually.\n\n"
                "No additional analysis was possible — verify claims against the raw evidence."
            )

        elif agent_role == "writer":
            goal = self._prompt_value(prompt, "Target Goal:") or "the user's request"
            tasks = self._prompt_section(
                prompt,
                "Manager Tasks:",
                ("\n\nResearch Evidence & Grounding Dossier:",)
            )
            evidence = self._prompt_section(
                prompt,
                "Research Evidence & Grounding Dossier:",
                ("\n\nAvailable Citations:",)
            )
            citations = self._prompt_section(
                prompt,
                "Available Citations:",
                ("\n\nATTENTION - REVISION REQUIRED", "\nWriting Guidelines:")
            )
            revision = self._prompt_section(
                prompt,
                "ATTENTION - REVISION REQUIRED",
                ("\nWriting Guidelines:",)
            )
            return (
                "# Deliverable\n\n"
                "## Executive Summary\n"
                f"This deliverable addresses: {goal}.\n\n"
                "## Findings\n"
                f"{evidence or 'No research evidence was provided. Findings cannot be substantiated.'}\n\n"
                "## Requested Work\n"
                f"{tasks or 'No manager tasks were provided.'}\n\n"
                "## Sources\n"
                f"{citations or 'No citations were retrieved.'}\n\n"
                + (f"## Reviewer Feedback to Address\n{revision}\n\n" if revision else "")
                + "## Limitations\n"
                "This offline fallback does not add facts that are absent from the supplied evidence. "
                "Verify important claims against the cited sources."
            )

        elif agent_role == "reviewer":
            return json.dumps({
                "score": 0,
                "approved": False,
                "quality_summary": "An AI provider did not return a review, so the draft could not be verified.",
                "critiques": [
                    "Review the draft manually against the supplied evidence and citations."
                ],
                "suggestions": "Check the configured AI provider and retry for an evidence-based review."
            })

        return f"Offline fallback for {agent_role}: no provider response was available."

llm_service = LLMService()
