"""Career helper: domain switching, GitHub portfolio coach, skill trends and the weekly career brief.
Everything about the candidate comes from the knowledge graph (kg.py) and stored resume."""
import json
from collections import Counter

import httpx

from . import ai, db, kg
from .config import get_settings

TRACKS = {
    "student": "a university student: projects to build, internships, summer schools, master's/PhD programs, RA positions",
    "industry": "industry roles: jobs, startups, founding/EIR roles",
    "academia": "academia: PhD, postdoc and faculty positions, fellowships, grants, calls for papers",
    "research_lab": "research labs (industrial and public): research engineer/scientist roles, residencies, visiting positions",
}


def _tracks():
    return [t for t in get_settings().get("tracks", ["industry"]) if t in TRACKS] or ["industry"]


def _me():
    return kg.context() or "(knowledge graph empty: upload a resume)"


def trends(limit=200):
    """Skill demand across recent matched opportunities vs. what the graph already has (local, instant)."""
    have = {s.lower() for s in kg.skills()}
    rows = db.rows("SELECT missing, matched, found_at FROM jobs WHERE score>0 ORDER BY found_at DESC LIMIT ?", (limit,))
    half = len(rows) // 2 or 1
    recent, older = Counter(), Counter()
    for i, j in enumerate(rows):
        sk = json.loads(j["missing"] or "[]") + json.loads(j["matched"] or "[]")
        (recent if i < half else older).update(s.lower() for s in sk)
    out = []
    for s, n in recent.most_common(30):
        out.append({"skill": s, "posts": n, "delta": n - older.get(s, 0), "have": s in have})
    return {"skills": out, "analyzed": len(rows)}


def domain_bridge(domain, agent=None):
    """Transferable skills, gaps and a bridge plan for switching into `domain`."""
    nid = kg.add_node("domain", domain, source="user")
    kg.add_edge(kg.ME, nid, "targets")
    text, used = ai.ask(f"""I want to move into: {domain}. My tracks: {', '.join(TRACKS[t] for t in _tracks())}.
Using ONLY my knowledge graph below, answer in Markdown:
1. **Transferable**: which of my skills/projects carry over, and why (cite the graph nodes).
2. **Gaps**: the 5–8 skills or credentials I lack, ranked.
3. **Bridge plan (8 weeks)**: courses, papers, a portfolio project per gap.
4. **Entry points**: role titles, labs/companies and programs that welcome people with my background.
5. **Story**: a 3-sentence pitch explaining the switch.

MY KNOWLEDGE GRAPH:
{_me()}""", agent=agent, task="training")
    db.save_doc("domain_bridge", f"Switching into {domain}", text, None, used)
    return text, used


def github_repos(user):
    r = httpx.get(f"https://api.github.com/users/{user}/repos", params={"per_page": 100, "sort": "updated"},
                  headers={"Accept": "application/vnd.github+json"}, timeout=20)
    r.raise_for_status()
    return [{"name": x["name"], "desc": x.get("description") or "", "lang": x.get("language") or "",
             "stars": x.get("stargazers_count", 0), "fork": x.get("fork"), "updated": x.get("pushed_at", "")[:10],
             "topics": x.get("topics", [])} for x in r.json()]


def github_coach(user="", agent=None):
    """Review the public GitHub portfolio against the graph and target domains."""
    user = user or get_settings().get("github_user", "")
    if not user:
        raise RuntimeError("Set your GitHub username in Config (github_user).")
    repos = [r for r in github_repos(user) if not r["fork"]][:40]
    s = get_settings()
    text, used = ai.ask(f"""Act as a portfolio reviewer for {', '.join(TRACKS[t] for t in _tracks())}.
Target roles: {', '.join(s.get('target_roles', [])) or 'see graph'}. Target domains: {', '.join(s.get('target_domains', [])) or 'none'}.
GitHub user {user} public repos (name | lang | stars | last push | description):
{chr(10).join(f"{r['name']} | {r['lang']} | {r['stars']} | {r['updated']} | {r['desc']}" for r in repos)}

MY KNOWLEDGE GRAPH:
{_me()}

In Markdown: 1. **What to pin** (6) and why. 2. **Fix list** per repo (README, demo, tests, license).
3. **Profile README** draft (only true facts). 4. **3 projects to build next** that close my gaps, each with scope,
stack and a 2-week milestone. 5. **Skills my graph claims but GitHub doesn't show yet**.""", agent=agent, task="training")
    db.save_doc("github_coach", f"GitHub portfolio review ({user})", text, None, used)
    for r in repos:  # repos become project nodes the user can link further
        kg.add_edge(kg.ME, kg.add_node("project", r["name"], r["desc"], "github"), "built", "github")
    return text, used


def weekly_brief(agent=None):
    """The weekly email: trends, gaps, plan, opportunities per track, GitHub tip and quests."""
    from . import game
    s = get_settings()
    tr = trends()["skills"][:12]
    top = db.rows("SELECT title, company, kind, url, score FROM jobs WHERE status IN ('new','saved') "
                  "ORDER BY score DESC LIMIT 10")
    g = game.state()
    text, used = ai.ask(f"""Write my weekly career brief (Markdown, skimmable, encouraging, honest).
Tracks: {', '.join(TRACKS[t] for t in _tracks())}. Target domains: {', '.join(s.get('target_domains', [])) or 'none'}.
Trending skills in my matches (skill, posts, change, I have it): {[(t['skill'], t['posts'], t['delta'], t['have']) for t in tr]}
Top open opportunities: {[(j['title'], j['company'], j['kind'], j['url']) for j in top]}
Game: level {g.get('level')}, streak {g.get('streak')} days.

Sections: 🔥 Skills trending this week · 🧭 Your gaps → 3 tasks this week (≤ 6 h total) · 🎯 Best opportunities
(grouped by track, why each fits) · 🐙 GitHub tip · 🔀 Domain-switch step · ⚔️ 3 quests with XP (10–50).

MY KNOWLEDGE GRAPH:
{_me()}""", agent=agent, task="training")
    db.save_doc("weekly_brief", "Weekly career brief", text, None, used)
    return text, used


RESEARCH = {
    "company": "a company brief: what they build, products and pipeline, recent news and funding (last 12 months), "
               "hiring signals, team and culture, and where someone with my background fits",
    "lab": "a research lab / group brief: the PI and key members, research lines, their 5 most recent relevant papers "
           "(title, year, link), funding and open positions, and a concrete angle for me to approach them",
    "person": "a brief on this researcher or hiring manager: role, recent work and papers, talks, shared interests "
              "with me, and a respectful first-message angle (no private or personal information)",
    "field": "a field brief: what is changing now, key players, open problems, skills in demand, and 3 concrete moves for me",
    "question": "a researched answer to this question",
}


def deep_research(topic, kind="company", agent=None):
    """Web-searched brief with sources. Uses the agents that can search the web (Claude, then Codex)."""
    prompt = (f"Research and write {RESEARCH.get(kind, RESEARCH['question'])}.\nTOPIC: {topic}\n\n"
              "Search the web. Cite every factual claim with a source link; say clearly when something could not be confirmed. "
              "Prefer official pages, papers and reputable news from the last 12 months. Markdown with short sections, "
              "then a 'Sources' list.\n\nABOUT ME (to tailor the angle; never invent facts about me):\n" + _me()[:4000])
    tries = [("claude_cli", ai.ask_claude_web), ("codex", ai.ask_codex_web)]
    if agent in dict(tries):
        tries.sort(key=lambda t: t[0] != agent)
    st, errors = ai.status(), []
    for name, fn in tries:
        if not st[name]["ready"]:
            errors.append(f"{name}: {st[name]['detail']}")
            continue
        try:
            text = ai.call(name, prompt, fn=fn)
            db.save_doc("research", f"Research ({kind}): {topic[:80]}", text, None, name)
            return text, name
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {str(e)[:200]}")
    raise RuntimeError("No web-search agent could answer.\n" + "\n".join(errors))
