"""Anthropic built-in web_search server tool (PLAN.md §7: no hand-rolled HTTP).

max_uses caps searches per turn — latency + cost control. Result URLs are
collected as plan sources in llm.stream_text.
"""

WEB_SEARCH_TOOL = {
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": 2,
}
