import json

from animus_career import db, kg, mcp_server


def test_graph_add_path_and_export():
    db.init()
    py = kg.add_node("skill", "Python")
    proj = kg.add_node("project", "Tumour segmentation")
    kg.add_edge(kg.ME, proj, "built")
    kg.add_edge(proj, py, "demonstrates")
    assert kg.path(kg.ME, py) == [kg.ME, proj, py]
    assert "Tumour segmentation -demonstrates-> Python" in kg.context()
    assert any("[[Python]]" in body for body in kg.export_markdown().values())
    kg.delete_node(py)
    assert py not in {n["id"] for n in kg.graph()["nodes"]}


def test_mcp_lists_and_calls_tools():
    db.init()
    tools = mcp_server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    assert {"knowledge_graph", "add_to_graph", "weekly_brief"} <= {t["name"] for t in tools}
    r = mcp_server.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                           "params": {"name": "skill_trends", "arguments": {}}})["result"]
    assert not r["isError"] and "skills" in json.loads(r["content"][0]["text"])


def test_web_bridge_requires_pairing_code():
    from fastapi.testclient import TestClient
    from animus_career import server
    c = TestClient(server.app)
    assert c.get("/api/kg", headers={"origin": "https://evil.example.com"}).status_code == 403
    assert c.get("/api/kg", headers={"origin": "https://someone.github.io"}).status_code == 401
    ok = c.get("/api/kg", headers={"origin": "https://someone.github.io", "x-animus-pair": server.pairing_code()})
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == "https://someone.github.io"
    assert c.get("/app/").status_code == 200


def test_sources_are_synced_and_goals_follow_their_plan():
    db.init()
    assert db.one("SELECT sync FROM kg_nodes WHERE id=?", (kg.add_node("skill", "Go", source="resume"),))["sync"] == 2
    goal = kg.add_node("skill", "Rust", source="goal")
    kg.add_edge(kg.ME, goal, "targets", "goal")
    steps = [{"text": "read the book", "done": True}, {"text": "ship a CLI", "done": False}]
    assert kg.set_plan(goal, steps) == 1
    steps[1]["done"] = True
    assert kg.set_plan(goal, steps) == 2 and kg.sync_percent() > 0
    # a source that shows a desired skill upgrades it to synchronized
    assert db.one("SELECT sync FROM kg_nodes WHERE id=?", (kg.add_node("skill", "Rust", source="github"),))["sync"] == 2


def test_build_reports_model_failure(monkeypatch):
    from animus_career import ai
    db.init()
    monkeypatch.setattr(ai, "ask", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("all models limited")))
    out = kg.build_from_resume("Python developer with SQL and Docker experience. " * 10)
    assert out["errors"] and "all models limited" in out["errors"][0]
    assert kg.last_build_problem()
