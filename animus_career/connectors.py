"""Connections shown as plug-in cards: AI agents (CLI or API), email, GitHub, paid sources and the MCP server.
Each card says whether it is connected, how to connect it, and can be tested with one click."""
import os
import sys

from . import ai, emailer
from .config import get_settings

CARDS = [
    {"id": "claude_cli", "group": "AI", "name": "Claude Code", "icon": "✳",
     "install": "npm install -g @anthropic-ai/claude-code", "login": "claude", "uses": "your Claude subscription"},
    {"id": "codex", "group": "AI", "name": "Codex CLI", "icon": "◎",
     "install": "npm install -g @openai/codex", "login": "codex login", "uses": "your ChatGPT subscription"},
    {"id": "gemini", "group": "AI", "name": "Gemini CLI", "icon": "✦",
     "install": "npm install -g @google/gemini-cli", "login": "gemini", "keys": ["GEMINI_API_KEY"],
     "uses": "your Google account or a Gemini API key"},
    {"id": "anthropic_api", "group": "AI", "name": "Anthropic API", "icon": "⌘", "keys": ["ANTHROPIC_API_KEY"],
     "uses": "pay-as-you-go API key"},
    {"id": "ollama", "group": "AI", "name": "Local models (Ollama)", "icon": "◍",
     "install": "https://ollama.com/download", "login": "ollama pull qwen3", "keys": ["OLLAMA_MODEL"],
     "uses": "Qwen, Gemma, Llama, DeepSeek-R1… on your own machine; private and free"},
    {"id": "openai_compat", "group": "AI", "name": "OpenAI-compatible", "icon": "⇄",
     "keys": ["OPENAI_COMPAT_BASE_URL", "OPENAI_COMPAT_API_KEY", "OPENAI_COMPAT_MODEL"],
     "uses": "DeepSeek API, OpenRouter, Groq, LM Studio, vLLM"},
    {"id": "email", "group": "Email", "name": "Email (SMTP)", "icon": "✉", "setup": "email",
     "uses": "an app password: sends your weekly brief, reads your own job-alert emails"},
    {"id": "github", "group": "Data", "name": "GitHub", "icon": "🐙", "setting": "github_user",
     "uses": "public repos for the portfolio coach (no token needed)"},
    {"id": "apify", "group": "Data", "name": "Apify (optional, paid)", "icon": "⚡", "keys": ["APIFY_TOKEN"],
     "uses": "LinkedIn/WTTJ actors under your monthly cap (off by default)"},
    {"id": "adzuna", "group": "Data", "name": "Adzuna jobs API", "icon": "⌕", "keys": ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
     "uses": "free official job API"},
    {"id": "mcp", "group": "Plugin", "name": "Use from Claude / Codex (MCP)", "icon": "⧉",
     "uses": "lets your AI app read your graph, opportunities and briefs"},
]


def mcp_snippet():
    return {"command": sys.executable, "args": ["-m", "animus_career.mcp_server"]}


def list_all():
    st, s = ai.status(), get_settings()
    out = []
    for c in CARDS:
        c = dict(c)
        if c["id"] in st:
            v = st[c["id"]]
            c["connected"], c["detail"] = v["ready"], v["detail"]
        elif c["id"] == "email":
            c["connected"] = emailer.configured()
            c["detail"] = os.environ.get("SMTP_USER", "not connected")
        elif c.get("setting"):
            c["connected"] = bool(s.get(c["setting"]))
            c["detail"] = s.get(c["setting"]) or "not set"
        elif c["id"] == "mcp":
            c["connected"], c["detail"], c["config"] = True, "available", mcp_snippet()
            c["install"] = f"claude mcp add animus -- {sys.executable} -m animus_career.mcp_server"
        else:
            c["connected"] = all(os.environ.get(k) for k in c.get("keys", []))
            c["detail"] = "key set" if c["connected"] else "no key"
        out.append(c)
    return out


def test(cid):
    if cid in ai.AGENTS:
        return ai.probe(cid)
    if cid == "email":
        return {"ok": emailer.configured(), "reply": "SMTP credentials present" if emailer.configured() else "not connected"}
    if cid == "github":
        from . import career
        user = get_settings().get("github_user")
        return {"ok": bool(user), "reply": f"{len(career.github_repos(user))} public repos" if user else "set a username"}
    if cid == "apify":
        from . import apify
        return {"ok": True, "reply": str(apify.budget())[:200]}
    return {"ok": True, "reply": "nothing to test"}
