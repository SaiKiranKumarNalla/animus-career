# Sourcing policy

ANIMUS Career finds opportunities only in ways that respect the sites it reads. These rules ship as defaults;
the numeric ones are settings you can change in **Config → Sourcing** (or `data/settings.json`).

| Rule | Setting | Default |
|---|---|---|
| Only official APIs, public RSS/ATS feeds, your own alert emails, or AI web search. Never scrape sites whose terms forbid it. | fixed | on |
| Gemini may only *propose* opportunities; Claude or Codex must approve each one (`animus approve-proposal DIGEST --agent codex`). | `require_second_agent_approval` | `true` |
| Import only opportunities whose resume-reviewed fit is strictly above the threshold (`animus import-reviewed FILE`). | `import_min_fit` | `50` |
| Searches look back this many days. | `lookback_days` | `7` |
| Paid sources (Apify) are off until you set a monthly cap; each run's `maxTotalChargeUsd` stays below what remains, checked live against the official API. | `apify_monthly_budget_usd` | `0` (off) |
| AI models open postings and confirm they are real and open (`animus verify-web`). | `model_verify_per_scan` | `6` |
| Confirmed broken, closed or generic links are archived; blocked pages stay "unverified". Saved/applied records and notes are never deleted. | fixed | on |
| Source-listed vs. independently confirmed vacancies are labelled. Salaries are never invented; work authorization is never assumed. | fixed | on |
| Every fact about you comes from your resume or your knowledge graph. | fixed | on |

Private, per-user rules can go in `AGENTS.local.md` (gitignored). AI coding agents working in the folder read it.
