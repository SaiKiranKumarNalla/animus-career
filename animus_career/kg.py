"""Career knowledge graph: the resume broken into nodes (skills, projects, roles, …) and edges.

Users extend it from the dashboard or CLI. Prompts read `context()` so every claim about the
candidate traces back to a node the resume or the user supplied."""
import json
import re
import time

from . import ai, db, scoring

KINDS = ["person", "skill", "tool", "project", "role", "organization", "education",
         "publication", "certification", "interest", "domain", "goal", "note"]
RELS = ["has_skill", "uses", "built", "worked_at", "held_role", "studied_at", "authored",
        "certified_in", "interested_in", "demonstrates", "part_of", "targets", "related_to"]
ME = "me"


def slug(kind, label):
    return f"{kind}:" + re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:80]


SOURCES = {"resume": "Resume", "linkedin": "LinkedIn", "github": "GitHub", "portfolio": "Portfolio",
           "document": "Document", "user": "Added by you"}


def add_node(kind, label, detail="", source="user", sync=None):
    """Anything from your own sources is yours (synchronized). Desired skills come in with source="goal", sync=0;
    if a later source shows that skill, it is upgraded to synchronized."""
    kind = kind if kind in KINDS else "note"
    nid = ME if kind == "person" else slug(kind, label)
    sync = (0 if source == "goal" else 2) if sync is None else sync
    db.execute("INSERT INTO kg_nodes(id, kind, label, detail, source, created, sync) VALUES(?,?,?,?,?,?,?) "
               "ON CONFLICT(id) DO UPDATE SET detail=CASE WHEN excluded.detail!='' THEN excluded.detail ELSE detail END, "
               "sync=MAX(sync, excluded.sync), source=CASE WHEN source='goal' AND excluded.source!='goal' THEN excluded.source ELSE source END",
               (nid, kind, label.strip(), detail.strip(), source, time.time(), sync))
    return nid


def add_edge(src, dst, rel="related_to", source="user"):
    rel = rel if rel in RELS else "related_to"
    if ME in (src, dst) and not db.one("SELECT 1 FROM kg_nodes WHERE id=?", (ME,)):
        add_node("person", "Me", source=source)
    db.execute("INSERT OR IGNORE INTO kg_edges(src, dst, rel, source, created) VALUES(?,?,?,?,?)",
               (src, dst, rel, source, time.time()))


def set_sync(nid, level, evidence):
    db.execute("UPDATE kg_nodes SET sync=?, evidence=? WHERE id=?", (max(0, min(2, level)), json.dumps(evidence), nid))


def sync_percent():
    """Progress on the skills you chose to learn: synchronized counts 1, synchronizing 0.5."""
    rows = db.rows("SELECT sync FROM kg_nodes WHERE kind IN ('skill','tool') AND id IN (SELECT dst FROM kg_edges WHERE rel='targets')")
    return round(100 * sum((r["sync"] or 0) / 2 for r in rows) / len(rows)) if rows else 0


def delete_node(nid):
    db.execute("DELETE FROM kg_edges WHERE src=? OR dst=?", (nid, nid))
    db.execute("DELETE FROM kg_nodes WHERE id=?", (nid,))


def graph():
    return {"nodes": db.rows("SELECT * FROM kg_nodes ORDER BY kind, label"),
            "edges": db.rows("SELECT * FROM kg_edges")}


def _json(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    return json.loads(m.group(0)) if m else {}


def build_from_resume(resume_text, name="Me", agent=None):
    """Replace the resume-sourced part of the graph; other sources, desired skills and your own additions are kept."""
    db.execute("DELETE FROM kg_edges WHERE source='resume'")
    db.execute("DELETE FROM kg_nodes WHERE source='resume' AND id NOT IN (SELECT src FROM kg_edges UNION SELECT dst FROM kg_edges)")
    add_node("person", name or "Me", source="resume")
    return ingest(resume_text, "resume", agent)


def ingest(text, source="document", agent=None):
    """Add what a source states (resume, LinkedIn export, GitHub summary, portfolio page, report…) to the graph.
    Nothing is invented: the model may only use facts in `text`."""
    what = SOURCES.get(source, "document").lower()
    data, errors = {}, []
    try:
        out, _ = ai.ask(
            f"Turn this {what} into a knowledge graph. Use ONLY facts stated in it. Return ONLY JSON: "
            '{"nodes":[{"kind":"…","label":"…","detail":"one short line"}],'
            '"edges":[{"src":"label","dst":"label","rel":"…"}]}. '
            f"kinds: {', '.join(KINDS[1:])}. rels: {', '.join(RELS)}. "
            "Use the label \"me\" for the person. Link each project/role/publication to the skills and tools it shows. "
            f"Existing labels you may link to: {[n['label'] for n in db.rows('SELECT label FROM kg_nodes')][:120]}\n\n"
            f"{what.upper()}:\n{text[:15000]}", agent=agent, task="profile")
        data = _json(out)
    except Exception as e:  # noqa: BLE001 — fall back to local skill extraction, but say so
        errors.append(f"graph step failed: {str(e)[:400]}")
    ids = {"me": ME, **{n["label"].lower(): n["id"] for n in db.rows("SELECT id, label FROM kg_nodes")}}
    for n in data.get("nodes", []):
        if n.get("label") and n.get("kind") != "person":
            ids[n["label"].lower()] = add_node(n.get("kind", "note"), n["label"], n.get("detail", ""), source)
    for e in data.get("edges", []):
        a, b = ids.get(str(e.get("src", "")).lower()), ids.get(str(e.get("dst", "")).lower())
        if a and b:
            add_edge(a, b, e.get("rel", "related_to"), source)
    for nid in [i for i in ids.values() if i != ME and not db.one("SELECT 1 FROM kg_edges WHERE src=? OR dst=?", (i, i))]:
        add_edge(ME, nid, "related_to", source)
    for needed, focus in ((("skill", "tool"), None), (("skill",), METHODS)):
        if not any(n.get("kind") in needed for n in data.get("nodes", [])):
            try:
                _skills_pass(text, agent, *([focus] if focus else []), source=source)
            except RuntimeError as e:
                errors.append(str(e))
    if source == "resume" and not db.one("SELECT 1 FROM kg_nodes WHERE kind IN ('skill','tool')"):
        errors.append("used basic keyword matching instead of AI; rebuild when a model is available")
        for sk in scoring.extract_skills(text):
            add_edge(ME, add_node("skill", sk, source="resume"), "has_skill", "resume")
    db.log_run("graph_build", "; ".join(errors) or "ok", ok=not errors)
    return {**stats(), "errors": errors}


METHODS = ("scientific and engineering methods and domain techniques, NOT software names (e.g. image reconstruction, "
           "PET quantification, CFD, statistical analysis); use kind \"skill\"")


def _skills_pass(resume_text, agent=None, focus="concrete hard skills and tools (methods, software, languages, techniques)", source="resume"):
    """Models often list roles and papers but skip skills; ask for skills/tools alone and link them to what shows them."""
    have = {n["label"].lower(): n["id"] for n in db.rows("SELECT id, label FROM kg_nodes")}
    try:
        out, _ = ai.ask(
            f"From this resume list the {focus} it states. "
            "Use ONLY what the text says. Return ONLY JSON: "
            '{"skills":[{"label":"…","kind":"skill|tool","shown_by":["exact label of a role/publication/project/education"]}]}. '
            f"Known labels: {list(have)[:80]}\n\nRESUME:\n{resume_text[:15000]}", agent=agent, task="profile")
        items = _json(out).get("skills", [])
    except Exception as e:  # noqa: BLE001 — reported to the caller, never silently dropped
        raise RuntimeError(f"skills step failed: {str(e)[:400]}") from e
    if not items:
        raise RuntimeError("skills step: the model returned no skills")
    for it in items:
        if not it.get("label"):
            continue
        nid = add_node(it.get("kind", "skill"), it["label"], source=source)
        add_edge(ME, nid, "has_skill", source)
        for src in it.get("shown_by", []):
            if str(src).lower() in have:
                add_edge(have[str(src).lower()], nid, "demonstrates", source)


def stats():
    g = graph()
    by = {}
    for n in g["nodes"]:
        by[n["kind"]] = by.get(n["kind"], 0) + 1
    return {"nodes": len(g["nodes"]), "edges": len(g["edges"]), "by_kind": by, "sync": sync_percent()}


def suggest(agent=None, n=6):
    """Skills worth adding as goals: from target roles/domains and what your matched opportunities ask for.
    Only proposals; nothing is added until you approve one."""
    from .config import get_settings
    st = get_settings()
    have = {r["label"].lower() for r in db.rows("SELECT label FROM kg_nodes")}
    dismissed = set(st.get("dismissed_skills", []))
    demand = []
    try:
        from . import career
        demand = [(t["skill"], t["posts"]) for t in career.trends()["skills"] if not t["have"]][:15]
    except Exception:  # noqa: BLE001
        pass
    out, _ = ai.ask(
        f"Suggest {n} skills this person does NOT have yet that would most help their goals. Return ONLY JSON "
        '{"skills":[{"label":"short skill name","kind":"skill|tool","why":"one sentence tied to their goals or market demand"}]}.\n'
        f"Target roles: {st.get('target_roles', [])}. Target domains: {st.get('target_domains', [])}. Tracks: {st.get('tracks', [])}.\n"
        f"Skills asked for in their matched opportunities but missing (skill, posts): {demand}\n"
        f"Do not suggest anything in this list: {sorted(have | dismissed)[:200]}\n\nGRAPH:\n{context(4000)}",
        agent=agent, task="training")
    return [s for s in _json(out).get("skills", []) if s.get("label") and s["label"].lower() not in have | dismissed][:n]


def desire(label, kind="skill", why="", agent=None):
    """Approve a suggested (or your own) desired skill: it joins the graph desynchronized, with a development plan."""
    nid = add_node(kind if kind in ("skill", "tool") else "skill", label, why, "goal")
    add_edge(ME, nid, "targets", "goal")
    plan = make_plan(nid, agent)
    return {"id": nid, "plan": plan}


def make_plan(nid, agent=None):
    n = db.one("SELECT * FROM kg_nodes WHERE id=?", (nid,))
    out, _ = ai.ask(
        f"Write a short development plan to learn \"{n['label']}\" for this person, building on what they already know. "
        "4 to 6 steps, each doable in a few hours to a week, the last step producing something they can show "
        "(a repo, a certificate, a write-up). Free resources first. Return ONLY JSON "
        '{"steps":[{"text":"…","resource":"name or URL, or empty"}]}.\n\nGRAPH:\n' + context(4000), agent=agent, task="training")
    steps = [{"text": x["text"], "resource": x.get("resource", ""), "done": False} for x in _json(out).get("steps", []) if x.get("text")]
    if not steps:
        raise RuntimeError("The model returned no plan; try again or pick another model.")
    db.execute("UPDATE kg_nodes SET plan=? WHERE id=?", (json.dumps(steps), nid))
    return steps


def set_plan(nid, steps):
    """Save plan progress; the sync level follows it (none done → desynchronized, some → synchronizing, all → synchronized)."""
    done = sum(1 for x in steps if x.get("done"))
    level = 2 if steps and done == len(steps) else 1 if done else 0
    db.execute("UPDATE kg_nodes SET plan=?, sync=? WHERE id=?", (json.dumps(steps), level, nid))
    return level


def last_build_problem():
    """The last graph build's errors, so the UI can say why the graph looks thin (empty when it went fine)."""
    r = db.one("SELECT summary, ok FROM runs WHERE kind='graph_build' ORDER BY id DESC LIMIT 1")
    return r["summary"] if r and not r["ok"] else ""


def skills():
    return [n["label"] for n in db.rows("SELECT label FROM kg_nodes WHERE kind IN ('skill','tool') ORDER BY label")]


def context(chars=6000):
    """Compact text form of the graph for prompts."""
    g = graph()
    label = {n["id"]: n["label"] for n in g["nodes"]}
    lines = [f"[{n['kind']}] {n['label']}" + (f": {n['detail']}" if n["detail"] else "") for n in g["nodes"]]
    lines += [f"{label.get(e['src'], e['src'])} -{e['rel']}-> {label.get(e['dst'], e['dst'])}" for e in g["edges"]]
    return "\n".join(lines)[:chars]


def path(src, dst, max_depth=4):
    """Shortest undirected path between two nodes (labels), e.g. a transferable-skill bridge."""
    adj = {}
    for e in db.rows("SELECT src, dst FROM kg_edges"):
        adj.setdefault(e["src"], set()).add(e["dst"])
        adj.setdefault(e["dst"], set()).add(e["src"])
    frontier, seen = [[src]], {src}
    while frontier:
        p = frontier.pop(0)
        if p[-1] == dst:
            return p
        if len(p) > max_depth:
            continue
        for nb in adj.get(p[-1], ()):
            if nb not in seen:
                seen.add(nb)
                frontier.append(p + [nb])
    return []


def export_markdown():
    """Obsidian-style notes, one per node, with [[wikilinks]] for edges."""
    g = graph()
    label = {n["id"]: n["label"] for n in g["nodes"]}
    notes = {}
    for n in g["nodes"]:
        out = [f"{label[e['dst']]}" for e in g["edges"] if e["src"] == n["id"] and e["dst"] in label]
        body = f"---\nkind: {n['kind']}\nsource: {n['source']}\n---\n# {n['label']}\n\n{n['detail']}\n\n"
        body += "\n".join(f"- [[{t}]]" for t in out)
        notes[f"{n['kind']}/{n['label']}.md"] = body
    return notes
