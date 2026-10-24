import re


_REPORT_REQUEST_PATTERN = re.compile(
    r"^\s*(?:please\s+)?(?:analy[sz]e|assess|compare|create|draft|evaluate|"
    r"explain|generate|investigate|prepare|research|summari[sz]e|write)\b"
    r"[^.!?\n]{0,60}\b(?:analysis|brief|document|findings|presentation|"
    r"recommendations|report|summary)\b",
    re.IGNORECASE,
)
_CODE_INTENT_PATTERN = re.compile(
    r"\b(?:build|create|develop|fix|generate|implement|modify|refactor|write)\b"
    r"[^.!?\n]{0,60}\b(?:api|application|app|backend|class|cli|code|component|"
    r"database|endpoint|function|frontend|library|program|script|service|"
    r"software|website)\b",
    re.IGNORECASE,
)
_CODE_ARTIFACT_PATTERN = re.compile(
    r"\b(?:application|app|backend|class|cli|code|component|database|endpoint|"
    r"function|frontend|library|program|script|service|software|website)\b",
    re.IGNORECASE,
)
_REPORT_GOAL_PATTERN = re.compile(
    r"\b(?:analy[sz]e|assessment|assess|brief|compare|document|evaluate|"
    r"explain|investigate|presentation|recommend|report|research|summari[sz]e)\b",
    re.IGNORECASE,
)


def detect_output_type(goal: str) -> str:
    """Infer whether a workflow goal calls for code or a written report."""
    if _REPORT_REQUEST_PATTERN.search(goal):
        return "report"
    if _CODE_INTENT_PATTERN.search(goal):
        return "code"
    if _REPORT_GOAL_PATTERN.search(goal):
        return "report"
    if _CODE_ARTIFACT_PATTERN.search(goal):
        return "code"
    return "code"
