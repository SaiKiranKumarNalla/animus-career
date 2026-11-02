# ANIMUS Career: instructions for AI coding agents (Claude Code, Codex, Gemini CLI)

This folder is ANIMUS Career (`animus_career`), a local-first career agent (jobs, academia, research labs, students). Use the `animus` CLI to act on it:

- `animus status`: agent and email health, job count
- `animus scan [--no-email]`: fetch jobs, score, agent-review, and email alerts
- `animus jobs -n 20`: top matches with IDs
- `animus cover <JOB_ID>`: cover letter for a job
- `animus ask "…"` / `animus council "…"`: coach / multi-agent answer
- `animus plan` / `animus weekly`: development plan / emailed weekly career brief
- `animus graph` / `animus trends` / `animus domain NAME` / `animus github USER`: knowledge graph and career helper

Data lives in the user's app folder (`~/.animus_career`, `%APPDATA%\ANIMUS Career`, or `ANIMUS_HOME`; legacy installs use `./data`): SQLite `data/animus_career.db`, settings `data/settings.json`.
Code: `animus_career/` (FastAPI server `server.py`, sources `sources.py`, prompts `coach.py`, agents `ai.py`).
Never print or commit `.env` (it holds the email app password and API keys).
Never invent facts about the candidate. Everything must come from the stored resume or knowledge graph.

## Sourcing rules (all installs)

- Gemini must not add opportunities directly: its proposals go through `job_proposals` and must be approved by
  Claude or Codex (`animus approve-proposal DIGEST --agent codex|claude_cli`). Never bypass this.
- Never scrape sites whose terms forbid it; use official APIs, the user's own alert emails, or AI web search.
- Archive confirmed broken/closed/generic links; keep blocked pages as unverified. Preserve saved/applied records and notes.

## Private instructions
If `AGENTS.local.md` exists in this folder, read it and follow it as well. It holds this user's private policies.
