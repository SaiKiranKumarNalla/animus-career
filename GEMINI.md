# ANIMUS Career: instructions for AI coding agents (Claude Code, Codex, Gemini CLI)

This folder is ANIMUS Career (`animus_career`), a local-first career agent. Use the `animus` CLI to act on it:

- `animus status`: agent and email health, job count
- `animus scan [--no-email]`: fetch jobs, score, agent-review, and email alerts
- `animus jobs -n 20`: top matches with IDs
- `animus cover <JOB_ID>`: cover letter for a job
- `animus ask "…"` / `animus council "…"`: coach / multi-agent answer
- `animus plan` / `animus weekly`: development plan / emailed weekly plan

Data: `data/animus_career.db` (SQLite: jobs, resumes, documents, chat, runs). Settings: `data/settings.json`.
Code: `animus_career/` (FastAPI server `server.py`, sources `sources.py`, prompts `coach.py`, agents `ai.py`).
Never print or commit `.env` (it holds the Gmail app password and API keys).
Never invent facts about the candidate. Everything must come from the stored resume.

## Mandatory sourcing restriction

Do not run autonomous searches, scans, or radar commands. Do not insert jobs
directly into SQLite or bypass ANIMUS Career's insertion gate. Gemini may draft
proposals only. Proposals must be independently reviewed and approved by
Claude or Codex through `animus approve-proposal`; an unavailable reviewer
means the proposal stays pending. Gemini cannot approve its own work.

If `AGENTS.local.md` exists in this folder, read it and follow it as well (private user policies).
