# ANIMUS Career (`animus_career`)

**A local-first AI career agent for students, industry, academia and research labs.** Upload your resume and it
becomes a **knowledge graph** of your skills, projects and experience. From that graph it finds jobs, PhD/postdoc
positions, lab openings, fellowships, grants, hackathons and events; tracks which skills are trending; reviews your
GitHub portfolio; plans switches into new domains; and emails you a **weekly career brief**. It runs on your own computer, using the AI
subscriptions you already pay for (Claude, ChatGPT/Codex, Gemini). No API bills, and your CV never leaves your
machine except in prompts to your own AI accounts.

> Status: early public version (1.0). macOS and Linux are tested; Windows support is new, so please report issues.

## Two ways to use it
| | **Web version** (no install) | **Local agent** (full) |
|---|---|---|
| Where | `https://<you>.github.io/animus_career` | `animus open` on your computer |
| Your data | only in your browser | only in a database on your computer |
| Models | your API key (Claude, OpenAI, Gemini, DeepSeek, OpenRouter) or **local models** (Ollama, LM Studio) | your **Claude Code / Codex / Gemini subscriptions**, Ollama, or any OpenAI-compatible endpoint |
| Graph, sync, quests, coach | ✓ | ✓ |
| Job / PhD / lab scans, link checks, weekly email | | ✓ |

The web version can also **pair** with your local agent (`animus pair` prints a code): it then uses the agent's data and models.
There is no ANIMUS server and no account; nobody (including the maintainers) ever sees your data.

## Proof, not claims
Every skill in your graph has a sync state. Skills from a resume start **desynchronized**: they are only claims.
Add proof (a GitHub repo, a certificate, a short quick check) and a model judges it; the skill becomes **partly synced** or
**synchronized**. Your **Sync %** is the share of your skills that are proven, and your quests are the cheapest way to raise it.

### Principles
- No feed, no posting, no social layer. The agent works for one person.
- It drafts and checks; you decide and send. It never applies or messages anyone on its own.
- Local models first where privacy matters: route resume reading to Qwen or Gemma on your machine (Settings → Which model does what).
- Every opportunity shows its source and whether it was verified.

## What it does
- **Knowledge graph:** your resume is broken into skills, tools, projects, roles, education and publications, linked
  together. Add courses, papers, repos and notes as you grow; every answer the agents give about you comes from this
  graph, so nothing is invented. Export it as Obsidian-style Markdown.
- **Tracks:** pick any of 🎓 student, 🏭 industry, 📜 academia, 🔬 research labs; matching, briefs and plans follow them.
- **Domain switching:** add domains you want to move into. You get transferable skills (traced through the graph), gaps,
  an 8-week bridge plan and entry points.
- **GitHub portfolio coach:** what to pin, what to fix, a profile README draft and three projects to build next.
- **Skill trends:** which skills are rising across your matches, and which you already have.
- **Weekly career brief (email):** trending skills, this week's three tasks, best opportunities per track, a GitHub tip,
  a domain-switch step and quests.
- **Connections:** one-click cards for Claude Code, Codex, Gemini, the Anthropic API, email, GitHub and optional sources,
  each with a Test button. ANIMUS Career also runs as an **MCP plugin** so Claude Code or Codex can use your graph.
- **Discover:** swipe through opportunities (→ save, ← dismiss, ↑ star, ↓ later). Every swipe trains your ranking.
- **Field packs:** lanes, searches, companies and conferences for *your* field, generated from your CV or picked from
  built-ins (software, data/AI, biotech, medical imaging).
- **Many sources:** free job APIs, company boards (Greenhouse, Lever, Ashby), France Travail, Adzuna, EU funding calls,
  OpenAlex (potential PIs), Devpost, your job-alert emails (LinkedIn, Indeed, APEC, Welcome to the Jungle, read-only),
  and an **AI web radar** (Claude/Codex search the web, lane by lane).
- **Trust:** links are checked automatically. Claude or Codex can **open the page and confirm the posting**, and every item
  shows *who added it* and *who verified it, and when*. Dead, duplicate and expired items are archived automatically.
- **Template jobs:** paste postings you found yourself. Similar ones get boosted, and a gap plan tells you how to become that candidate.
- **Academia:** postdocs, fellowships, grants, and a Fellowship Match that pairs open calls with eligible host PIs.
- **Writing:** tailored CVs, cover letters, outreach and postdoc emails, LinkedIn drafts, mock interviews, salary and visa briefs.
- **Game layer:** XP and levels earned from real progress (triage, verification, applications, practice), daily
  quests, streaks and achievements. Opportunities come in rarity tiers (common → legendary), and agent energy bars show
  how much of your AI subscriptions is left today.
- **Plan:** kanban tracker, deadline calendar (.ics), world map, skill ranker, weekly top-5 email.
- **Optional:** email alerts (Gmail, Outlook, iCloud, any IMAP/SMTP), Obsidian / Markdown knowledge base.

## Install
Requires **Python 3.10+**. Then install at least one AI command-line tool and log in once (the setup wizard shows how):
[Claude Code](https://claude.com/claude-code) (Claude Pro/Max) and/or [Codex](https://github.com/openai/codex) (ChatGPT).

**macOS / Linux**
```bash
git clone https://github.com/<you>/animus_career && cd animus_career
./scripts/install.sh
```
**Windows (PowerShell)**
```powershell
git clone https://github.com/<you>/animus_career; cd animus_career
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```
Then open **http://127.0.0.1:8765** (or run `animus open`). The **setup wizard** walks you through:
1. CV upload → AI profile
2. Field pack (generated from your CV, or a built-in one)
3. Connecting Claude / Codex / Gemini
4. Optional email
5. How applying should work: assisted, auto-send email applications, or (risky) full auto-apply

Prefer the terminal? `animus setup`.

## Where your data lives
`~/.animus_career` (Windows: `%APPDATA%\ANIMUS Career`). Override it with `ANIMUS_HOME`. It holds the SQLite database,
settings, logs and your private `.env` (email app password, optional API keys, `chmod 600`). Nothing personal is ever
written inside the repo.

## CLI
```
animus open | setup | scan | status | jobs | radar [lanes…] | verify-web --company X
animus graph [rebuild | add --kind skill --label "Rust"] | trends | domain "climate tech" | github USER | brief
animus ask "…" | council "…" | cover JOB_ID | tailor JOB_ID | plan | weekly
```

## Local and open models
- **Ollama** (Qwen, Gemma, Llama, DeepSeek-R1, Mistral…): install from ollama.com, `ollama pull qwen3`. The local agent
  finds it automatically and sends private tasks to it (`local_tasks` setting: resume parsing and job scoring by default).
  For the web version start it with `OLLAMA_ORIGINS=* ollama serve`.
- **OpenAI-compatible** (DeepSeek API, OpenRouter, Groq, LM Studio, vLLM): set `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_MODEL`
  and optionally `OPENAI_COMPAT_API_KEY` on the Connections page.

## Publish the web version
Push the repo to GitHub, then Settings → Pages → Source: **GitHub Actions**. The `Web app` workflow publishes
`animus_career/web` to `https://<you>.github.io/<repo>/`. It is static files only: no domain, no server, no data.

## Use it from Claude Code / Codex (MCP)
```bash
claude mcp add animus -- python -m animus_career.mcp_server
```
Tools: `knowledge_graph`, `add_to_graph`, `top_opportunities`, `skill_trends`, `domain_bridge`, `weekly_brief`.
The Connections page shows the exact command for your install.

## Sourcing policy
Official APIs, public feeds, your own alert emails and AI web search only; a second AI must approve Gemini's finds;
paid sources are off until you set a cap. Details and settings: [docs/SOURCING_POLICY.md](docs/SOURCING_POLICY.md).

## Applying modes and their limits
The mode is chosen in setup. Today ANIMUS Career prepares the material: tailored CV, letter, email and answers, plus a
text "application pack". The automatic modes are on the roadmap.
- **Assisted (default):** ANIMUS Career prepares everything; you press Submit.
- **Auto-send email applications (planned):** sent from your own account within the daily limits you set.
- **Full auto-apply to web forms (planned, opt-in):** off by default. Automated submissions break the terms of LinkedIn, Indeed and
  most applicant-tracking systems, and can get accounts banned. ANIMUS Career never scrapes sites that forbid it; it uses
  official APIs, your own alert emails, or AI web search instead.

## Contributing
Field packs are plain JSON in `animus_career/packs/`; new packs for other fields are very welcome. Run tests with `pytest`.

## License
MIT. See [LICENSE](LICENSE).
