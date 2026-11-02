/* 3D memory core: the knowledge graph as faceted nodes, drifting shards and dust (Three.js r128).
   Desynchronized skills are flickering wireframes; partly synced are glassy; synchronized are solid and glow. */
const Graph3D = (() => {
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const KIND = {person: '--gold', skill: '--blue', tool: '--blue', project: '--gold', role: '--red', organization: '--red',
    education: '--stone', publication: '--red', certification: '--stone', domain: '--red', interest: '--stone', goal: '--red', note: '--muted'};
  const SKILLISH = k => k === 'skill' || k === 'tool';
  let W, H, renderer, scene, cam, group, meshes = [], line, ring, shards, dust, G = {nodes: [], edges: []}, sel = null, opts = {};
  const rot = {x: -.25, y: 0, vx: 0, vy: .0016}, dist = {v: 420, fit: 420};
  const shardData = [], tmp = new THREE.Object3D(), v3 = new THREE.Vector3();
  let labels, drag = null, moved = 0, t0 = performance.now();

  function layout() {
    const P = {}, n = G.nodes.length;
    G.nodes.forEach((nd, i) => { const a = i * 2.4, r = 60 + i * 5; P[nd.id] = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, (i % 5 - 2) * 30); });
    if (P.me) P.me.set(0, 0, 0);
    for (let it = 0; it < (n > 120 ? 120 : 280); it++) {
      const F = {}; G.nodes.forEach(nd => F[nd.id] = new THREE.Vector3());
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = G.nodes[i].id, b = G.nodes[j].id, d = P[a].clone().sub(P[b]), l = Math.max(d.length(), 1), f = 2200 / (l * l * l);
        F[a].addScaledVector(d, f); F[b].addScaledVector(d, -f);
      }
      for (const e of G.edges) { const a = P[e.src], b = P[e.dst]; if (!a || !b) continue; const d = b.clone().sub(a), f = (d.length() - 70) * .02; d.normalize().multiplyScalar(f); F[e.src].add(d); F[e.dst].sub(d); }
      G.nodes.forEach(nd => { if (nd.id !== 'me') P[nd.id].add(F[nd.id].clampLength(0, 6)); });
    }
    return P;
  }
  function color(k) { return new THREE.Color(css(KIND[k] || '--muted')); }
  function material(nd) {
    const s = nd.source === 'goal' ? (nd.sync || 0) : 2;
    return new THREE.MeshStandardMaterial({flatShading: true, roughness: s === 2 ? .35 : .15, metalness: s === 2 ? .35 : .1,
      transparent: true, opacity: s === 0 ? .6 : s === 1 ? .75 : 1, wireframe: s === 0, emissiveIntensity: s === 2 && nd.source === 'goal' ? .45 : .15});
  }
  function paint() {
    meshes.forEach(m => { const k = m.userData.sync === 2 && m.userData.source === 'goal' ? 'skill-synced' : m.userData.kind;
      const c = k === 'skill-synced' ? new THREE.Color(css('--gold')) : color(m.userData.kind); m.material.color = c; m.material.emissive = c; });
    if (line) line.material.color = new THREE.Color(css('--ink2'));
    if (ring) ring.material.color = new THREE.Color(css('--gold'));
    if (shards) shards.material.color = new THREE.Color(css('--gold'));
    if (dust) dust.material.color = new THREE.Color(css('--blue'));
  }
  function set(nodes, edges, selected) {
    G = {nodes, edges}; group.clear(); meshes = [];
    if (!nodes.length) { labels.innerHTML = ''; return; }
    const P = layout(), deg = {};
    edges.forEach(e => { deg[e.src] = (deg[e.src] || 0) + 1; deg[e.dst] = (deg[e.dst] || 0) + 1; });
    const geo = new THREE.IcosahedronGeometry(1, 1);
    nodes.forEach(nd => {
      const m = new THREE.Mesh(geo, material(nd));
      m.scale.setScalar(nd.kind === 'person' ? 9 : 3.2 + Math.min(deg[nd.id] || 0, 6) * .6);
      m.position.copy(P[nd.id]); m.userData = nd; group.add(m); meshes.push(m);
    });
    const pts = []; edges.forEach(e => { if (P[e.src] && P[e.dst]) pts.push(P[e.src], P[e.dst]); });
    line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({transparent: true, opacity: .26}));
    ring = new THREE.Mesh(new THREE.TorusGeometry(16, .35, 6, 64), new THREE.MeshBasicMaterial({transparent: true, opacity: .6}));
    dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({length: 900}, () => (Math.random() - .5) * 760), 3)), new THREE.PointsMaterial({size: 1.6, transparent: true, opacity: .4}));
    group.add(line, ring, dust);
    labels.innerHTML = nodes.map(nd => `<span data-id="${nd.id}" class="${nd.kind === 'person' ? 'me' : nd.source === 'goal' && !nd.sync ? 'desync' : ''}"></span>`).join('');
    labels.querySelectorAll('span').forEach((s, i) => { const l = nodes[i].label; s.textContent = l.length > 30 ? l.slice(0, 28) + '…' : l; });
    paint(); select(nodes.some(n => n.id === selected) ? selected : (nodes.find(n => n.id === 'me') || nodes[0]).id, true);
  }
  function select(id, quiet) {
    sel = id; const nb = new Set(G.edges.filter(e => e.src === id || e.dst === id).map(e => e.src === id ? e.dst : e.src));
    meshes.forEach(m => { m.userData.dim = !(m.userData.id === id || nb.has(m.userData.id)); });
    if (!quiet || opts.onSelect) opts.onSelect && opts.onSelect(id);
  }
  function frame() {
    const r = opts.frame ? opts.frame() : {left: 0, right: W, top: 0, bottom: H};
    cam.setViewOffset(W, H, W / 2 - (r.left + r.right) / 2, H / 2 - (r.top + r.bottom) / 2, W, H);
    dist.fit = 420 * Math.max(1, 440 / Math.max(220, r.bottom - r.top)); dist.v = dist.fit;
  }
  function init(canvas, labelEl, o) {
    opts = o || {}; labels = labelEl;
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true}); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0, 380, 1500);
    cam = new THREE.PerspectiveCamera(45, 1, 1, 3000);
    scene.add(new THREE.AmbientLight(0xffffff, .75)); const d = new THREE.DirectionalLight(0xfff1d6, .9); d.position.set(80, 120, 160); scene.add(d);
    group = new THREE.Group(); scene.add(group);
    const n = 70; shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({flatShading: true, transparent: true, opacity: .13, metalness: .5, roughness: .3}), n);
    for (let i = 0; i < n; i++) shardData.push({p: new THREE.Vector3((Math.random() - .5) * 1500, (Math.random() - .5) * 1000, -250 - Math.random() * 500), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), s: 4 + Math.random() * 16, v: .05 + Math.random() * .2});
    scene.add(shards);
    const size = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); frame(); };
    size(); addEventListener('resize', size); opts.resize = size;
    const busy = e => e.target.closest('.glass, .overlay, .view:not(.pass)');
    addEventListener('pointerdown', e => { if (busy(e)) return; drag = [e.clientX, e.clientY]; moved = 0; });
    addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; moved += Math.abs(dx) + Math.abs(dy);
      rot.vy = dx * .0006; rot.vx = dy * .0006; rot.y += dx * .006; rot.x = Math.max(-1.2, Math.min(1.2, rot.x + dy * .006)); drag = [e.clientX, e.clientY]; });
    addEventListener('pointerup', e => { if (drag && moved < 5) pick(e); drag = null; });
    addEventListener('wheel', e => { if (busy(e)) return; dist.v = Math.max(140, Math.min(1000, dist.v + e.deltaY * .3)); }, {passive: true});
    const ray = new THREE.Raycaster();
    function pick(e) { ray.setFromCamera({x: e.clientX / W * 2 - 1, y: -e.clientY / H * 2 + 1}, cam); const h = ray.intersectObjects(meshes)[0]; if (h) select(h.object.userData.id); }
    requestAnimationFrame(loop);
  }
  function loop(t) {
    requestAnimationFrame(loop);
    if (document.hidden || opts.paused && opts.paused()) return;
    if (!drag) { rot.y += rot.vy; rot.vy += (.0016 - rot.vy) * .02; rot.x += rot.vx; rot.vx *= .94; }
    group.rotation.set(rot.x, rot.y, 0);
    cam.position.set(0, 0, dist.v); cam.lookAt(0, 0, 0);
    shardData.forEach((o, i) => { o.p.y += o.v; if (o.p.y > 520) o.p.y = -520; o.r.x += .002; o.r.y += .003;
      tmp.position.set(o.p.x - rot.y * 40, o.p.y + rot.x * 40, o.p.z); tmp.rotation.copy(o.r); tmp.scale.setScalar(o.s); tmp.updateMatrix(); shards.setMatrixAt(i, tmp.matrix); });
    shards.instanceMatrix.needsUpdate = true;
    if (dust) dust.rotation.y += .0004;
    const ts = (t - t0) / 1000;
    meshes.forEach(m => { m.rotation.y += .004; const nd = m.userData;
      const base = nd.dim ? .3 : 1, s = nd.source === 'goal' ? nd.sync || 0 : 2;
      m.material.opacity = base * (s === 0 ? .45 + .25 * Math.max(0, Math.sin(ts * 9 + m.id)) * (Math.sin(ts * 1.3 + m.id) > .6 ? 1 : 0) + .1 : s === 1 ? .75 : 1); });
    const s = meshes.find(m => m.userData.id === sel);
    if (ring && s) { ring.position.copy(s.position); ring.scale.setScalar(s.scale.x / 9 + .3 + Math.sin(ts * 2.5) * .05);
      ring.quaternion.copy(group.quaternion).invert(); }
    renderer.render(scene, cam);
    labels.querySelectorAll('span').forEach(sp => { const m = meshes.find(x => x.userData.id === sp.dataset.id); if (!m) return;
      m.getWorldPosition(v3); const z = v3.clone().applyMatrix4(cam.matrixWorldInverse).z; v3.project(cam);
      sp.style.left = (v3.x + 1) / 2 * W + m.scale.x * 1.2 + 'px'; sp.style.top = (1 - v3.y) / 2 * H + 'px';
      sp.style.opacity = Math.max(.12, Math.min(1, 1.6 - (-z - 120) / 260)) * (m.userData.dim ? .45 : 1); });
  }
  return {init, set, select, paint, frame: () => frame(), resize: () => opts.resize && opts.resize(), KIND};
})();
