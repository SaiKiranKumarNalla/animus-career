"""Minimal MCP server (stdio, JSON-RPC 2.0, no extra dependencies) so Claude Code, Codex or any MCP client
can use ANIMUS Career as a plugin:  claude mcp add animus -- python -m animus_career.mcp_server"""
import json
import sys

from . import career, db, kg

TOOLS = {
    "knowledge_graph": ("Your career knowledge graph as text (skills, projects, roles, links).", {}, lambda a: kg.context(20000)),
    "add_to_graph": ("Add a node (skill, project, course, publication, note…) linked to you.",
                     {"kind": {"type": "string"}, "label": {"type": "string"}, "detail": {"type": "string"}},
                     lambda a: kg.add_edge(kg.ME, kg.add_node(a.get("kind", "note"), a["label"], a.get("detail", "")),
                                           "related_to") or "added"),
    "top_opportunities": ("Best open opportunities (jobs, PhD/postdoc, labs, fellowships…).", {"limit": {"type": "integer"}},
                          lambda a: json.dumps(db.rows("SELECT id, kind, title, company, location, url, score FROM jobs "
                                                       "WHERE status IN ('new','saved') ORDER BY score DESC LIMIT ?",
                                                       (int(a.get("limit", 15)),)), indent=1)),
    "skill_trends": ("Trending skills across your matches and whether you have them.", {}, lambda a: json.dumps(career.trends())),
    "domain_bridge": ("Plan a switch into a new domain from your graph.", {"domain": {"type": "string"}},
                      lambda a: career.domain_bridge(a["domain"])[0]),
    "weekly_brief": ("Generate this week's career brief.", {}, lambda a: career.weekly_brief()[0]),
}


def handle(msg):
    m, mid = msg.get("method"), msg.get("id")
    if m == "initialize":
        res = {"protocolVersion": msg.get("params", {}).get("protocolVersion", "2024-11-05"),
               "capabilities": {"tools": {}}, "serverInfo": {"name": "animus_career", "version": "1.0"}}
    elif m == "tools/list":
        res = {"tools": [{"name": n, "description": d, "inputSchema": {"type": "object", "properties": p}}
                         for n, (d, p, _) in TOOLS.items()]}
    elif m == "tools/call":
        p = msg["params"]
        try:
            text, err = str(TOOLS[p["name"]][2](p.get("arguments") or {})), False
        except Exception as e:  # noqa: BLE001
            text, err = f"error: {e}", True
        res = {"content": [{"type": "text", "text": text}], "isError": err}
    elif mid is None:
        return None  # notification
    else:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"unknown method {m}"}}
    return {"jsonrpc": "2.0", "id": mid, "result": res}


def main():
    db.init()
    for line in sys.stdin:
        if line.strip():
            out = handle(json.loads(line))
            if out:
                sys.stdout.write(json.dumps(out) + "\n")
                sys.stdout.flush()


if __name__ == "__main__":
    main()
