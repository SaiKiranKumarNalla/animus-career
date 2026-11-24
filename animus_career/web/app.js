/* ANIMUS Career web app. Runs entirely in the browser (data in this browser only) or, when paired, on top of the
   local `animus` agent. No server of ours, no accounts, no tracking. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const md = t => DOMPurify.sanitize(marked.parse(t || ''));
const KINDS = ['skill', 'tool', 'project', 'role', 'organization', 'education', 'publication', 'certification', 'interest', 'domain', 'goal', 'note'];
const SKILLISH = k => k === 'skill' || k === 'tool';
const SYNC = ['Desynchronized', 'Synchronizing', 'Synchronized'];

/* ---------- palettes: each has light and dark tokens; "custom" overrides accents ---------- */
const PALETTES = {
  paris: {name: 'Paris 1789', light: {bg: '#efe8da', bg2: '#e4dccb', ink: '#1d2433', ink2: '#5b6273', muted: '#8c8f98', blue: '#24477a', gold: '#a8812c', red: '#9e2f3c', stone: '#b9b2a3'},
    dark: {bg: '#0c111c', bg2: '#141b2a', ink: '#ece4d2', ink2: '#a9a493', muted: '#6d7180', blue: '#6f95d6', gold: '#d8b25c', red: '#d0566a', stone: '#5a6276'}},
  florence: {name: 'Florence', light: {bg: '#f3ebe0', bg2: '#e9dcc8', ink: '#2a211b', ink2: '#6b5a4c', muted: '#9a8b7d', blue: '#4f6b3a', gold: '#b5832b', red: '#a4472c', stone: '#c2ae95'},
    dark: {bg: '#16110d', bg2: '#221a14', ink: '#efe2d0', ink2: '#b5a28c', muted: '#7a6a5a', blue: '#8fb06f', gold: '#e0ab4f', red: '#d97a58', stone: '#6e5d4c'}},
  origins: {name: 'Sand and lapis', light: {bg: '#f4ecdc', bg2: '#eadcc2', ink: '#1f2430', ink2: '#5e6170', muted: '#968f80', blue: '#1f5fa8', gold: '#c08a2e', red: '#1d8f8a', stone: '#cdb995'},
    dark: {bg: '#0f1418', bg2: '#182027', ink: '#f0e6d2', ink2: '#b3a990', muted: '#77735f', blue: '#5c9be6', gold: '#e8b45a', red: '#3cc3b9', stone: '#665c48'}},
  north: {name: 'Northern frost', light: {bg: '#eef1f3', bg2: '#dfe5ea', ink: '#1b232b', ink2: '#566370', muted: '#8a96a1', blue: '#3a6f8f', gold: '#9a7b4a', red: '#a3472f', stone: '#a9b4bd'},
    dark: {bg: '#0d1216', bg2: '#151d23', ink: '#e6edf1', ink2: '#9fb0bc', muted: '#62717c', blue: '#7fb4d6', gold: '#cfa96d', red: '#d9785c', stone: '#4c5964'}},
  neutral: {name: 'Plain', light: {bg: '#f5f5f4', bg2: '#ebebea', ink: '#1c1c1c', ink2: '#5c5c5c', muted: '#8f8f8f', blue: '#2f5bd3', gold: '#b7791f', red: '#c53030', stone: '#b0b0b0'},
    dark: {bg: '#111112', bg2: '#1b1b1d', ink: '#ededed', ink2: '#a3a3a3', muted: '#6b6b6b', blue: '#7aa2ff', gold: '#e7b04f', red: '#f07171', stone: '#555'}},
};

/* ---------- AI providers (all called straight from this browser, or via the paired local agent) ---------- */
const PROVIDERS = {
  agent: {name: 'Local ANIMUS agent', note: 'Uses whatever the agent has: Claude Code, Codex, Gemini, Ollama… (pair it below).'},
  huggingface: {name: 'Hugging Face (your HF token)', url: 'https://router.huggingface.co/v1', model: 'Qwen/Qwen3-32B', note: 'Token from huggingface.co/settings/tokens with the "Make calls to Inference Providers" permission. Uses your HF inference credits; any model id from huggingface.co/models?inference_provider=all works.'},
  ollama: {name: 'Ollama (local, free)', url: 'http://localhost:11434', note: 'Qwen, Gemma, Llama, DeepSeek-R1… on your machine. For the web version start it with OLLAMA_ORIGINS=* ollama serve.'},
  lmstudio: {name: 'LM Studio (local)', url: 'http://localhost:1234/v1', note: 'Turn on "Enable CORS" in LM Studio\'s server tab.'},
  anthropic: {name: 'Claude (API key)', model: 'claude-sonnet-5-5', note: 'Key from console.anthropic.com. Sent only to Anthropic.'},
  openai: {name: 'OpenAI (API key)', url: 'https://api.openai.com/v1', model: '', note: 'Key from platform.openai.com.'},
  gemini: {name: 'Gemini (API key)', model: 'gemini-2.5-flash', note: 'Key from aistudio.google.com.'},
  deepseek: {name: 'DeepSeek (API key)', url: 'https://api.deepseek.com', model: 'deepseek-chat', note: 'Key from platform.deepseek.com.'},
  openrouter: {name: 'OpenRouter (any open model)', url: 'https://openrouter.ai/api/v1', model: 'qwen/qwen3-32b', note: 'One key for Qwen, Gemma, Llama, DeepSeek, Mistral…'},
  browser: {name: 'In-browser model (no key, free)', model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', note: 'Runs a small open model (Qwen2.5 1.5B) inside this browser with WebGPU: no key, no account, nothing leaves your computer. First use downloads about 1 GB; needs Chrome, Edge or another WebGPU browser. Good for trying ANIMUS; larger models give better results. Smaller and faster: Qwen2.5-0.5B-Instruct-q4f16_1-MLC.'},
};
const TASKS = {extract: 'Read resume → graph', verify: 'Check proof', coach: 'Quests and plans', chat: 'Coach chat'};

/* ---------- state ---------- */
const KEY = 'animus.career.v1';
const blank = () => ({nodes: [], edges: [], xp: 0, log: [], quests: [], profile: {},
  settings: {palette: 'paris', custom: {}, mode: '', providers: {}, routes: {extract: '', verify: '', coach: '', chat: ''}, agent: {url: 'http://127.0.0.1:8765', code: ''}}});
let S = blank();
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); S.settings = Object.assign(blank().settings, S.settings); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save in this browser (private mode?)'); } };
let AGENT = false, sel = 'me';
if (location.pathname.startsWith('/app')) S.settings.agent.url = location.origin;  // served by the agent itself

function toast(m) { const d = document.createElement('div'); d.className = 'toast glass'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3800); }
async function busy(btn, fn) { const t = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="ld"></span>'; try { return await fn(); } catch (e) { toast('⚠ ' + e.message); } finally { btn.disabled = false; btn.innerHTML = t; } }

/* ---------- local agent bridge ---------- */
async function agent(path, body, method) {
  const a = S.settings.agent, same = location.origin === a.url.replace(/\/$/, '');
  const r = await fetch(a.url.replace(/\/$/, '') + path, {method: method || (body ? 'POST' : 'GET'),
    headers: Object.assign({'content-type': 'application/json'}, same ? {} : {'x-animus-pair': a.code}), body: body ? JSON.stringify(body) : undefined});
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText);
  return r.json();
}
async function detectAgent() {
  const a = S.settings.agent; if (!a.url || (!a.code && location.origin !== a.url.replace(/\/$/, ''))) return false;
  try { await agent('/api/kg'); return true; } catch (e) { return false; }
}

/* ---------- graph store: browser storage, or the agent's database when paired ---------- */
// Your sources (resume, LinkedIn, GitHub, portfolio, documents) are yours: synchronized. Skills you choose to learn
// (source "goal") start desynchronized and sync as you work through their development plan.
const SOURCES = {resume: 'Resume', linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', document: 'Document', user: 'Added by you', goal: 'Goal'};
const live = () => AGENT && !S.demo;
const slugId = (kind, label) => kind === 'person' ? 'me' : kind + ':' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const isGoal = n => n.source === 'goal';
const store = {
  async load() {
    if (live()) { const g = await agent('/api/kg');
      S.nodes = g.nodes.map(n => ({...n, sync: n.sync || 0, plan: JSON.parse(n.plan || '[]')})); S.edges = g.edges.map(e => ({src: e.src, dst: e.dst, rel: e.rel}));
      if (g.problem && g.problem !== S.lastProblem) { S.lastProblem = g.problem; toast('Last graph build had problems: ' + g.problem.slice(0, 220)); } }
    if (S.nodes.length && !S.nodes.some(n => n.id === 'me')) S.nodes.unshift({id: 'me', kind: 'person', label: S.profile.name || 'Me', source: 'resume', sync: 2});
  },
  local(kind, label, detail, source, link, rel) {  // browser-side upsert, same rules as the agent's kg.add_node
    const id = slugId(kind, label), sync = source === 'goal' ? 0 : 2, n = S.nodes.find(x => x.id === id);
    if (!n) S.nodes.push({id, kind, label, detail: detail || '', source, sync, plan: [], created: Date.now()});
    else { n.sync = Math.max(n.sync || 0, sync); if (n.source === 'goal' && source !== 'goal') n.source = source; if (detail) n.detail = detail; }
    if (link && link !== id && !S.edges.some(e => e.src === link && e.dst === id)) S.edges.push({src: link, dst: id, rel: rel || 'related_to'});
    return id;
  },
  async add(kind, label, detail, link, rel) {
    if (live()) await agent('/api/kg/node', {kind, label, detail, link_to: link, rel});
    const id = store.local(kind, label, detail, 'user', link, rel); save(); return id;
  },
  async ingest(text, source) {
    if (live()) { const r = await agent('/api/kg/ingest', {text, source}); await store.load(); return r; }
    const g = parseJSON(await ask('extract', `Turn this ${SOURCES[source].toLowerCase()} into a knowledge graph. Use ONLY facts stated in it. Return ONLY JSON:
{"name":"…","nodes":[{"kind":"…","label":"…","detail":"one short line"}],"edges":[{"src":"label","dst":"label","rel":"…"}]}
kinds: ${KINDS.join(', ')}. Use "me" for the person. Include hard skills, tools AND methods/techniques as their own nodes, linked from the roles,
projects and publications that show them. Keep labels short. Existing labels you may link to: ${S.nodes.map(n => n.label).slice(0, 120).join(' | ')}\n\n${text.slice(0, 15000)}`));
    if (!S.nodes.length) S.nodes.push({id: 'me', kind: 'person', label: g.name || 'Me', source, sync: 2});
    if (g.name && source === 'resume') { S.profile.name = g.name; S.nodes.find(n => n.id === 'me').label = g.name; }
    const ids = {me: 'me', ...Object.fromEntries(S.nodes.map(n => [n.label.toLowerCase(), n.id]))};
    for (const n of g.nodes || []) if (n.label && n.kind !== 'person') ids[n.label.toLowerCase()] = store.local(KINDS.includes(n.kind) ? n.kind : 'note', n.label, n.detail, source);
    for (const e of g.edges || []) { const a = ids[String(e.src).toLowerCase()], b = ids[String(e.dst).toLowerCase()]; if (a && b && a !== b && !S.edges.some(x => x.src === a && x.dst === b)) S.edges.push({src: a, dst: b, rel: e.rel || 'related_to'}); }
    S.nodes.filter(n => n.id !== 'me' && !S.edges.some(e => e.dst === n.id || e.src === n.id)).forEach(n => S.edges.push({src: 'me', dst: n.id, rel: 'related_to'}));
    save(); return {errors: []};
  },
  async github(user) {
    if (live()) { const r = await agent('/api/kg/github', {user}); await store.load(); return r; }
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`);
    if (!r.ok) throw new Error('GitHub user not found.');
    const repos = (await r.json()).filter(x => !x.fork).slice(0, 40);
    return store.ingest(`GitHub profile ${user}\n` + repos.map(x => `Repo ${x.name} (${x.language || ''}, ${x.stargazers_count} stars, topics ${(x.topics || []).join(', ')}): ${x.description || ''}`).join('\n'), 'github');
  },
  async suggest() {
    if (live()) return agent('/api/kg/suggest', {});
    const have = S.nodes.map(n => n.label.toLowerCase()), no = S.dismissed || [];
    const out = parseJSON(await ask('coach', `Suggest 6 skills this person does NOT have yet that would most help their goals. Return ONLY JSON
{"skills":[{"label":"short skill name","kind":"skill|tool","why":"one sentence tied to their goals"}]}. Do not suggest: ${[...have, ...no].slice(0, 200).join(', ')}\n\nGRAPH:\n${graphText().slice(0, 4000)}`));
    return (out.skills || []).filter(x => x.label && !have.includes(x.label.toLowerCase()) && !no.includes(x.label.toLowerCase()));
  },
  async dismiss(label) {
    if (live()) await agent('/api/kg/desire', {label, dismiss: true});
    (S.dismissed = S.dismissed || []).push(label.toLowerCase()); save();
  },
  async desire(label, kind, why) {
    if (live()) { const r = await agent('/api/kg/desire', {label, kind, why}); await store.load(); return r.id; }
    const id = store.local(kind === 'tool' ? 'tool' : 'skill', label, why, 'goal', 'me', 'targets');
    S.nodes.find(n => n.id === id).plan = await store.makePlan(id); save(); return id;
  },
  async makePlan(id) {
    if (live()) { const r = await agent('/api/kg/plan', {id, regenerate: true}); return r.plan; }
    const n = S.nodes.find(x => x.id === id);
    const out = parseJSON(await ask('coach', `Write a short development plan to learn "${n.label}" for this person, building on what they already know.
4 to 6 steps, each doable in a few hours to a week, the last producing something they can show (a repo, a certificate, a write-up). Free resources first.
Return ONLY JSON {"steps":[{"text":"…","resource":"name or URL, or empty"}]}\n\nGRAPH:\n${graphText().slice(0, 4000)}`));
    const steps = (out.steps || []).filter(x => x.text).map(x => ({text: x.text, resource: x.resource || '', done: false}));
    if (!steps.length) throw new Error('The model returned no plan; try again.');
    return steps;
  },
  async setPlan(id, steps) {
    const n = S.nodes.find(x => x.id === id), done = steps.filter(x => x.done).length;
    n.plan = steps; n.sync = steps.length && done === steps.length ? 2 : done ? 1 : 0;
    if (live()) await agent('/api/kg/plan', {id, steps});
    save(); return n.sync;
  },
  async remove(id) {
    if (live()) await agent('/api/kg/node/' + encodeURIComponent(id), null, 'DELETE');
    S.nodes = S.nodes.filter(n => n.id !== id); S.edges = S.edges.filter(e => e.src !== id && e.dst !== id); save();
  },
};

/* ---------- LLM routing ---------- */
function providerFor(task) {
  const r = S.settings.routes[task]; if (r) return r;
  if (AGENT) return 'agent';
  return Object.keys(PROVIDERS).find(p => p !== 'agent' && configured(p)) || '';
}
function configured(p) { const c = S.settings.providers[p] || {}; return p === 'agent' ? AGENT : p === 'ollama' || p === 'lmstudio' || p === 'browser' ? !!c.on : !!c.key; }
/* in-browser model (WebLLM, WebGPU) */
let WEBLLM = null;
async function browserModel(model) {
  if (!navigator.gpu) throw new Error('This browser has no WebGPU. Use Chrome or Edge on a recent computer, or pick another model.');
  if (WEBLLM && WEBLLM.model === model) return WEBLLM.engine;
  const lib = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm');
  const show = m => { const el = document.querySelector('#rmsg'); if (el) el.textContent = m; };
  toast('Loading the in-browser model (first time: about 1 GB, then cached)…');
  const engine = await lib.CreateMLCEngine(model, {initProgressCallback: r => show('In-browser model: ' + (r.text || Math.round((r.progress || 0) * 100) + '%'))});
  WEBLLM = {model, engine}; show('In-browser model ready.'); return engine;
}
async function ask(task, prompt, system) {
  system = system || 'You are a careful, honest career coach. Use only facts given to you about the person; never invent experience.';
  const p = providerFor(task); if (!p) throw new Error('Set up a model first (⚙ Settings → Models).');
  const c = Object.assign({}, PROVIDERS[p], S.settings.providers[p] || {});
  const json = async (url, init) => { const r = await fetch(url, init); if (!r.ok) throw new Error(`${PROVIDERS[p].name}: ${r.status} ${(await r.text()).slice(0, 160)}`); return r.json(); };
  const strip = t => (t || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (p === 'agent') return (await agent('/api/ai/raw', {prompt, system, task: task === 'extract' ? 'profile' : task === 'verify' ? 'review' : 'training'})).text;
  if (p === 'anthropic') {
    const d = await json('https://api.anthropic.com/v1/messages', {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': c.key,
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'},
      body: JSON.stringify({model: c.model || 'claude-sonnet-5-5', max_tokens: 4000, system, messages: [{role: 'user', content: prompt}]})});
    return d.content.filter(b => b.type === 'text').map(b => b.text).join('');
  }
  if (p === 'gemini') {
    const d = await json(`https://generativelanguage.googleapis.com/v1beta/models/${c.model || 'gemini-2.5-flash'}:generateContent`, {method: 'POST',
      headers: {'content-type': 'application/json', 'x-goog-api-key': c.key}, body: JSON.stringify({systemInstruction: {parts: [{text: system}]}, contents: [{role: 'user', parts: [{text: prompt}]}]})});
    return strip(((d.candidates || [])[0]?.content?.parts || []).map(x => x.text || '').join(''));
  }
  if (p === 'browser') {
    const eng = await browserModel(c.model || PROVIDERS.browser.model);
    const d = await eng.chat.completions.create({messages: [{role: 'system', content: system}, {role: 'user', content: prompt}], temperature: 0.3});
    return strip(d.choices[0].message.content);
  }
  if (p === 'ollama') {
    let model = c.model; if (!model) { const t = await json(c.url + '/api/tags'); model = (t.models || [])[0]?.name; if (!model) throw new Error('Ollama has no models: run `ollama pull qwen3`'); }
    const d = await json(c.url + '/api/chat', {method: 'POST', body: JSON.stringify({model, stream: false, messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]})});
    return strip(d.message.content);
  }
  const d = await json(c.url.replace(/\/$/, '') + '/chat/completions', {method: 'POST', headers: Object.assign({'content-type': 'application/json'}, c.key ? {authorization: 'Bearer ' + c.key} : {}),
    body: JSON.stringify({model: c.model, messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]})});
  return strip(d.choices[0].message.content);
}
const parseJSON = t => { const m = (t || '').match(/\{[\s\S]*\}/); if (!m) throw new Error('The model did not return JSON; try another model.'); return JSON.parse(m[0]); };
const graphText = () => { const L = Object.fromEntries(S.nodes.map(n => [n.id, n.label]));
  return S.nodes.map(n => `[${n.kind}${isGoal(n) ? ', wants to learn: ' + SYNC[n.sync || 0].toLowerCase() : ''}] ${n.label}${n.detail ? ': ' + n.detail : ''}`).join('\n') + '\n' +
    S.edges.map(e => `${L[e.src] || e.src} -${e.rel}-> ${L[e.dst] || e.dst}`).join('\n'); };

/* ---------- progress: XP, level, goals, quests (= next step of each development plan) ---------- */
const XP = {node: 10, source: 30, goal: 20, step: 25, synced: 100};
function gain(kind, xp) { S.xp += xp; S.log.push({t: Date.now(), kind, xp}); save(); renderHUD(); }
const level = xp => Math.floor((Math.sqrt(1 + 8 * xp / 100) - 1) / 2) + 1;
const goals = () => S.nodes.filter(isGoal);
const syncPct = () => { const g = goals(); return g.length ? Math.round(100 * g.reduce((a, n) => a + (n.sync || 0) / 2, 0) / g.length) : 0; };
function refreshQuests() {
  S.quests = goals().filter(n => n.sync < 2 && (n.plan || []).length).map(n => { const i = n.plan.findIndex(x => !x.done);
    return {node: n.id, step: i, text: `${n.label}: ${n.plan[i].text}`, xp: i === n.plan.length - 1 ? XP.step + XP.synced : XP.step}; }).slice(0, 3);
}
function renderHUD() {
  const p = syncPct(), g = goals(); $('#syncbar').style.setProperty('--p', p + '%'); $('#synctxt').textContent = g.length ? p + '%' : '–';
  $('#syncbar').parentElement.title = 'Progress on the skills you chose to learn (' + g.filter(n => n.sync === 2).length + ' of ' + g.length + ' synchronized)';
  $('#lvl').textContent = `· Lv ${level(S.xp)} · ${S.xp} XP`;
  $('#mode').textContent = S.demo ? 'Sample data' : AGENT ? 'Local agent' : 'Browser only'; $('#mode').classList.toggle('on', AGENT);
  $('#mode').title = AGENT ? 'Paired with your local ANIMUS agent: data lives in its database on your computer.' : 'Your data lives only in this browser. Nothing is sent anywhere except prompts to the model you choose.';
}
async function tick(nodeId, step) {
  const n = S.nodes.find(x => x.id === nodeId), steps = n.plan.map((x, i) => i === step ? {...x, done: !x.done} : x), before = n.sync;
  const after = await store.setPlan(nodeId, steps);
  if (steps[step].done) gain('step', XP.step);
  if (after === 2 && before < 2) { gain('synced', XP.synced); toast(`${n.label} synchronized · +${XP.synced} XP`); }
  redraw(nodeId);
}
let SUGG = null;
function renderDock() {
  $('#qxp').textContent = S.quests.length ? '+' + S.quests.reduce((a, q) => a + q.xp, 0) + ' XP' : '';
  $('#quests').innerHTML = S.quests.map(q => `<div class="row"><button class="q" data-tick="${esc(q.node)}|${q.step}" title="Mark done" aria-label="Mark done"></button><a href="#" data-n="${esc(q.node)}">${esc(q.text)}</a><span class="r xp">${q.xp}</span></div>`).join('')
    || '<p class="note">Approve a suggested skill to get a development plan; its next step shows up here.</p>';
  $('#sugg').innerHTML = SUGG === null ? '<button class="btn" id="sgo">Suggest skills for my goals</button>'
    : SUGG.slice(0, 3).map((x, i) => `<div class="row" style="flex-wrap:wrap"><b style="flex:1">${esc(x.label)}</b><button class="btn" data-yes="${i}" style="padding:4px 10px">Add</button><button class="btn" data-no="${i}" style="padding:4px 10px">No</button><span class="note" style="width:100%">${esc(x.why || '')}</span></div>`).join('')
      || '<p class="note">No new suggestions. Add a target domain in Coach for more.</p>';
  const g = goals().sort((a, b) => (b.sync || 0) - (a.sync || 0));
  $('#goals').innerHTML = g.slice(0, 4).map(n => { const d = (n.plan || []).filter(x => x.done).length, t = (n.plan || []).length;
    return `<div class="row"><a href="#" data-n="${esc(n.id)}">${esc(n.label)}</a><span class="r"><span class="tag s${n.sync || 0}">${n.sync === 2 ? 'Synchronized' : t ? d + '/' + t : 'no plan'}</span></span></div>`; }).join('')
    || '<p class="note">Skills you decide to learn appear here.</p>';
  $$('#v-core [data-n]').forEach(a => a.onclick = e => { e.preventDefault(); Graph3D.select(a.dataset.n); });
  $$('[data-tick]').forEach(b => b.onclick = () => { const [id, i] = b.dataset.tick.split('|'); tick(id, +i); });
  const sg = $('#sgo'); if (sg) sg.onclick = e => busy(e.target, async () => { SUGG = await store.suggest(); renderDock(); });
  $$('[data-yes]').forEach(b => b.onclick = e => busy(e.target, async () => { const x = SUGG[+b.dataset.yes];
    const id = await store.desire(x.label, x.kind, x.why); SUGG = SUGG.filter(y => y !== x); gain('goal', XP.goal); toast(`${x.label} added (desynchronized) with a development plan`); redraw(id); }));
  $$('[data-no]').forEach(b => b.onclick = async () => { const x = SUGG[+b.dataset.no]; await store.dismiss(x.label); SUGG = SUGG.filter(y => y !== x); renderDock(); });
}

/* ---------- node panel ---------- */
function renderNode(id) {
  sel = id; const n = S.nodes.find(x => x.id === id); if (!n) return;
  const L = Object.fromEntries(S.nodes.map(x => [x.id, x.label]));
  const nb = S.edges.filter(e => e.src === id || e.dst === id).map(e => e.src === id ? e.dst : e.src);
  const plan = n.plan || [];
  $('#node').innerHTML = `<div class="kind">${esc(n.kind)}</div><h2>${esc(n.label)}</h2>
    <p class="sub">${esc(n.detail || (n.kind === 'person' ? 'Your memory core, built from your resume and the sources you add.' : 'Linked to ' + nb.length + ' memories.'))}</p>
    <div class="hstack" style="margin-top:10px">${isGoal(n) ? `<span class="tag s${n.sync || 0}">${SYNC[n.sync || 0]}</span><span class="note">a skill you chose to learn</span>`
      : n.id !== 'me' ? `<span class="tag">From ${esc(SOURCES[n.source] || 'your sources')}</span>` : ''}</div>
    ${isGoal(n) ? `<h3 style="margin-top:14px">Development plan <span class="mono">${plan.filter(x => x.done).length}/${plan.length}</span></h3>
      ${plan.map((x, i) => `<div class="row"><button class="q ${x.done ? 'done' : ''}" data-step="${i}" aria-label="Toggle step"></button><span style="flex:1">${esc(x.text)}${x.resource ? `<br><span class="note">${/^https?:/.test(x.resource) ? `<a href="${esc(x.resource)}" target="_blank" rel="noopener">${esc(x.resource)}</a>` : esc(x.resource)}</span>` : ''}</span></div>`).join('')}
      <button class="btn" id="replan" style="margin-top:8px">${plan.length ? 'Rewrite plan' : 'Make a plan'}</button>` : ''}
    <div class="chips">${nb.map(x => `<span class="chip" data-go="${esc(x)}">${esc(L[x] || x)}</span>`).join('')}</div>
    ${n.id !== 'me' ? '<div style="margin-top:12px"><button class="btn" id="del">Remove</button></div>' : ''}`;
  $$('#node [data-go]').forEach(c => c.onclick = () => Graph3D.select(c.dataset.go));
  $$('#node [data-step]').forEach(b => b.onclick = () => tick(id, +b.dataset.step));
  const rp = $('#replan'); if (rp) rp.onclick = e => busy(e.target, async () => { await store.setPlan(id, await store.makePlan(id)); redraw(id); });
  const d = $('#del'); if (d) d.onclick = async () => { await store.remove(id); redraw('me'); };
}

/* ---------- views ---------- */
const V = {};
V.sync = () => {
  const g = goals(), src = Object.keys(SOURCES).filter(k => k !== 'goal').map(k => [k, S.nodes.filter(n => n.source === k).length]);
  $('#v-sync').innerHTML = `<div class="grid2">
   <div class="card glass"><h3>Your sources <span>synchronized: these are yours</span></h3>
    ${src.map(([k, c]) => `<div class="row"><span style="flex:1">${SOURCES[k]}</span><span class="r">${c} items</span></div>`).join('')}
    <div class="stack" style="margin-top:12px"><select id="stype"><option value="linkedin">LinkedIn (paste your profile text or upload its PDF export)</option>
      <option value="github">GitHub (username)</option><option value="portfolio">Portfolio or personal site (paste its text)</option><option value="document">Report, thesis, paper or notes</option><option value="resume">Updated resume</option></select>
     <input id="sgh" placeholder="GitHub username" class="hidden"><input type="file" id="sfile" accept=".pdf,.txt,.md"><textarea id="stext" placeholder="…or paste the text"></textarea>
     <button class="btn p" id="sadd">Add to my graph</button><p class="note">Read only: ANIMUS never logs in to these sites or posts anything. LinkedIn: use "Save to PDF" on your profile.</p></div></div>
   <div class="card glass"><h3>Skills you are learning <span class="mono">${g.filter(n => n.sync === 2).length}/${g.length} synchronized</span></h3>
    ${g.map(n => { const d = (n.plan || []).filter(x => x.done).length, t = (n.plan || []).length;
      return `<div class="row"><a href="#" data-n="${esc(n.id)}">${esc(n.label)}</a><span class="r"><span class="tag s${n.sync || 0}">${SYNC[n.sync || 0]}${t && n.sync < 2 ? ' · ' + d + '/' + t : ''}</span></span></div>`; }).join('') || '<p class="note">None yet.</p>'}
    <div class="hstack" style="margin-top:12px"><input id="want" placeholder="A skill you want to learn" style="flex:1"><button class="btn g" id="wadd">Add with a plan</button></div></div>
   <div class="card glass"><h3>How sync works</h3><p class="sub">Everything from your resume, LinkedIn, GitHub, portfolio and documents is <b>synchronized</b>: it is yours.
    When ANIMUS sees a skill that would help your goals, it asks whether to add it. If you say yes, it joins your graph <b>desynchronized</b> with a development plan.
    Working through the steps makes it <b>synchronizing</b>; finishing the plan (or a new source that shows the skill) makes it <b>synchronized</b>.
    The Sync bar at the top is your progress on the skills you chose to learn.</p></div></div>`;
  const kind = () => $('#stype').value;
  $('#stype').onchange = () => { const gh = kind() === 'github'; $('#sgh').classList.toggle('hidden', !gh); $('#sfile').classList.toggle('hidden', gh); $('#stext').classList.toggle('hidden', gh); };
  $('#sadd').onclick = e => busy(e.target, async () => {
    let r; if (kind() === 'github') { if (!$('#sgh').value.trim()) return toast('Enter a GitHub username.'); r = await store.github($('#sgh').value.trim()); }
    else { const f = $('#sfile').files[0], text = f ? await readResume(f) : $('#stext').value; if ((text || '').trim().length < 80) return toast('Not enough text to read.'); r = await store.ingest(text, kind()); }
    gain('source', XP.source); toast((r.errors || []).length ? 'Added with problems: ' + r.errors.join('; ').slice(0, 200) : 'Added to your graph'); redraw(sel); V.sync(); });
  $('#wadd').onclick = e => busy(e.target, async () => { const l = $('#want').value.trim(); if (!l) return; const id = await store.desire(l, 'skill', ''); gain('goal', XP.goal); redraw(id); V.sync(); });
  $$('#v-sync [data-n]').forEach(a => a.onclick = e => { e.preventDefault(); show('core'); Graph3D.select(a.dataset.n); });
};
V.coach = () => {
  $('#v-coach').innerHTML = `<div class="grid2"><div class="card glass"><h3>Ask your coach</h3><div class="stack">
    <textarea id="cq" placeholder="What should I learn next to move into research labs? Which skill gives me the most leverage this month?"></textarea>
    <div class="hstack"><button class="btn p" id="cask">Ask</button><button class="btn" id="cweek">Plan my week</button></div></div></div>
    <div class="card glass"><h3>Switch domains</h3><div class="stack"><input id="dom" placeholder="medical imaging, climate tech, quant research…">
    <button class="btn g" id="dgo">Plan the bridge</button><p class="note">Adds the domain to your graph and maps which of your synced skills transfer.</p></div></div></div>
    <div class="card glass" style="margin-top:16px"><div class="md" id="cout"><p class="note">Answers use only your graph and its sync states.</p></div></div>`;
  const out = t => { $('#cout').innerHTML = md(t); };
  $('#cask').onclick = e => busy(e.target, async () => out(await ask('chat', `${$('#cq').value}\n\nMY GRAPH (with sync states):\n${graphText()}`)));
  $('#cweek').onclick = e => busy(e.target, async () => out(await ask('coach', `Plan my next 7 days (≤ 6 hours total) to raise my Sync %: pick the 2–3 desynchronized skills that matter most for my goals,
and for each give one concrete proof I can produce this week (a small repo, a certificate module, a write-up). Markdown, short.\n\nMY GRAPH:\n${graphText()}`)));
  $('#dgo').onclick = e => busy(e.target, async () => { const d = $('#dom').value.trim(); if (!d) return toast('Name a domain first.');
    await store.add('domain', d, '', 'me', 'targets'); redraw(sel);
    out(await ask('coach', `I want to move into ${d}. Using ONLY my graph: 1) transferable skills (prefer synchronized ones, say which are only claims),
2) the 5 most important gaps, 3) an 8-week bridge plan with one proof per gap, 4) entry-level titles, labs and programs. Markdown.\n\nMY GRAPH:\n${graphText()}`)); });
};
V.opps = async () => {
  if (!AGENT) {
    $('#v-opps').innerHTML = `<div class="grid2"><div class="card glass"><h3>Check a posting against your graph</h3><div class="stack">
      <textarea id="jd" placeholder="Paste a job, PhD, postdoc or lab posting"></textarea><button class="btn p" id="fit">Check my fit</button></div></div>
      <div class="card glass"><h3>Want automatic scans?</h3><p class="sub">Job, PhD, postdoc, fellowship and lab scans run in the local agent on your computer (they need to fetch many sources, which a browser cannot do).</p>
      <p class="sub" style="margin-top:8px">Install it from the project's GitHub page, run <span class="mono">animus pair</span>, and paste the code in ⚙ Settings.</p></div></div>
      <div class="card glass" style="margin-top:16px"><div class="md" id="fout"></div></div>`;
    $('#fit').onclick = e => busy(e.target, async () => { if (!$('#jd').value.trim()) return toast('Paste a posting first.');
      $('#fout').innerHTML = md(await ask('coach', `Compare this posting with my graph. Give: fit score /100, requirements I meet with SYNCHRONIZED proof, ones I only claim, real gaps,
and the single most useful proof to add before applying. Be honest. Markdown.\n\nPOSTING:\n${$('#jd').value.slice(0, 8000)}\n\nMY GRAPH:\n${graphText()}`)); });
    return;
  }
  $('#v-opps').innerHTML = '<div class="card glass"><span class="ld"></span></div>';
  const jobs = await agent('/api/jobs?limit=40').catch(() => []);
  const tier = s => s >= 90 ? ['Legendary', 's2'] : s >= 80 ? ['Epic', 's1'] : s >= 70 ? ['Rare', ''] : ['Common', 's0'];
  $('#v-opps').innerHTML = `<div class="card glass"><h3>Top opportunities <span>from your local agent</span></h3>${jobs.map(j => { const t = tier(j.score || 0);
    return `<div class="row"><span class="tag ${t[1]}">${t[0]}</span><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a><span class="note">${esc(j.company || '')} · ${esc(j.kind || 'job')}</span><span class="r">${Math.round(j.score || 0)}</span></div>`; }).join('') || '<p class="note">No opportunities yet. Run a scan in the agent (animus scan).</p>'}</div>`;
};
V.settings = () => {
  const st = S.settings, pv = st.providers;
  $('#v-settings').innerHTML = `<div class="grid2">
   <div class="card glass"><h3>Models</h3><p class="note">Keys stay in this browser and go only to that provider. Local models never leave your machine.</p>
    ${Object.entries(PROVIDERS).filter(([k]) => k !== 'agent').map(([k, p]) => { const c = pv[k] || {}; const local = k === 'ollama' || k === 'lmstudio' || k === 'browser';
      return `<div class="row" style="flex-wrap:wrap"><b style="flex:1">${p.name}</b><span class="tag ${configured(k) ? 's2' : 's0'}">${configured(k) ? 'on' : 'off'}</span>
      <div class="stack" style="width:100%">${local ? `<label class="hstack note"><input type="checkbox" data-p="${k}" data-f="on" ${c.on ? 'checked' : ''} style="width:auto"> use it</label>` : `<input type="password" data-p="${k}" data-f="key" placeholder="API key" value="${esc(c.key || '')}">`}
      <div class="hstack">${p.url !== undefined ? `<input data-p="${k}" data-f="url" placeholder="${esc(p.url)}" value="${esc(c.url || '')}" style="flex:2">` : ''}<input data-p="${k}" data-f="model" placeholder="${esc(p.model || 'model (blank = first installed)')}" value="${esc(c.model || '')}" style="flex:1"></div>
      <span class="note">${p.note}</span></div></div>`; }).join('')}
    <div class="hstack" style="margin-top:10px"><button class="btn p" id="psave">Save models</button><button class="btn" id="ptest">Test</button></div></div>
   <div class="stack" style="gap:16px">
    <div class="card glass"><h3>Which model does what</h3>${Object.entries(TASKS).map(([t, label]) => `<div class="row"><span style="flex:1">${label}</span>
      <select data-route="${t}" style="width:200px"><option value="">Automatic</option>${Object.entries(PROVIDERS).map(([k, p]) => `<option value="${k}" ${st.routes[t] === k ? 'selected' : ''}>${p.name}</option>`).join('')}</select></div>`).join('')}
      <p class="note" style="margin-top:6px">Tip: a local model (Qwen, Gemma) for reading resumes keeps your CV private; a stronger model for checking proof.</p></div>
    <div class="card glass"><h3>Local agent <span class="tag ${AGENT ? 's2' : 's0'}">${AGENT ? 'paired' : 'not paired'}</span></h3><div class="stack">
      <input id="aurl" value="${esc(st.agent.url)}" placeholder="http://127.0.0.1:8765"><input id="acode" type="password" value="${esc(st.agent.code)}" placeholder="Pairing code from: animus pair">
      <button class="btn" id="apair">Pair</button><p class="note">Pairing moves your graph to the agent's database on your computer and unlocks scans, email briefs and your Claude Code / Codex subscriptions.</p></div></div>
    <div class="card glass"><h3>Palette</h3><div class="sw">${Object.entries(PALETTES).map(([k, p]) => `<button data-pal="${k}" class="${st.palette === k ? 'on' : ''}"><i style="background:${p.light.blue}"></i><i style="background:${p.light.gold}"></i><i style="background:${p.light.red}"></i>${p.name}</button>`).join('')}</div>
      <div class="hstack" style="margin-top:12px">${['blue', 'gold', 'red'].map((v, i) => `<label class="note">${['Primary', 'Sync', 'Accent'][i]} <input type="color" data-col="${v}" value="${(st.custom[mode()] || {})[v] || PALETTES[st.palette][mode()][v]}" style="width:48px;height:32px;padding:2px"></label>`).join('')}
      <button class="btn" id="preset">Reset colours</button></div></div>
    <div class="card glass"><h3>Your data</h3><div class="hstack"><button class="btn" id="exp">Export</button><label class="btn">Import<input type="file" id="imp" accept=".json" hidden></label><button class="btn" id="wipe">Erase everything</button></div>
      <p class="note" style="margin-top:8px">There is no ANIMUS server. In browser mode your data exists only here; export it to move between devices.</p></div>
   </div></div>`;
  $('#psave').onclick = () => { $$('#v-settings [data-p]').forEach(i => { const c = pv[i.dataset.p] = pv[i.dataset.p] || {}; c[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); save(); toast('Models saved'); V.settings(); };
  $('#ptest').onclick = e => busy(e.target, async () => toast('Model says: ' + (await ask('chat', 'Reply with exactly: synchronized')).slice(0, 60)));
  $$('[data-route]').forEach(s => s.onchange = () => { st.routes[s.dataset.route] = s.value; save(); });
  $('#apair').onclick = e => busy(e.target, async () => { st.agent.url = $('#aurl').value.trim().replace(/\/$/, ''); st.agent.code = $('#acode').value.trim(); save();
    AGENT = await detectAgent(); if (!AGENT) throw new Error('Could not reach the agent. Is `animus serve` running, and is the code right?');
    if (S.demo) { S.demo = false; S.nodes = []; S.edges = []; }
    if (S.nodes.length) for (const n of S.nodes.filter(n => n.id !== 'me')) { const link = (S.edges.find(e => e.dst === n.id) || {}).src || 'me'; await agent('/api/kg/node', {kind: n.kind, label: n.label, detail: n.detail, link_to: link, source: n.source || 'user'}); if (isGoal(n) && (n.plan || []).length) await agent('/api/kg/plan', {id: n.id, steps: n.plan}); }
    toast('Paired with your local agent'); await boot(); V.settings(); });
  $$('[data-pal]').forEach(b => b.onclick = () => { st.palette = b.dataset.pal; st.custom = {}; save(); theme(); V.settings(); });
  $$('[data-col]').forEach(i => i.oninput = () => { (st.custom[mode()] = st.custom[mode()] || {})[i.dataset.col] = i.value; save(); theme(); });
  $('#preset').onclick = () => { st.custom = {}; save(); theme(); V.settings(); };
  $('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], {type: 'application/json'})); a.download = 'animus-career.json'; a.click(); };
  $('#imp').onchange = async e => { try { S = Object.assign(blank(), JSON.parse(await e.target.files[0].text())); save(); await boot(); toast('Imported'); } catch (x) { toast('Not an ANIMUS export'); } };
  $('#wipe').onclick = () => { if (confirm('Erase your graph, progress and keys from this browser?')) { localStorage.removeItem(KEY); location.reload(); } };
};

/* ---------- tracker: kanban board, deadline calendar, 3D globe (local agent) ---------- */
const BOARD = ['saved', 'applying', 'applied', 'interview', 'offer', 'rejected'];
const TRK = {tab: 'board', month: (() => { const d = new Date(); d.setDate(1); return d; })()};
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
V.track = async () => {
  if (!AGENT) { $('#v-track').innerHTML = '<div class="card glass"><h3>Tracker</h3><p class="sub">The board, deadlines and globe use the opportunities your local agent finds. Pair it in ⚙ Settings.</p></div>'; return; }
  $('#v-track').innerHTML = `<div class="stack" style="gap:16px"><div class="hstack"><div class="seg">${[['board', 'Board'], ['cal', 'Deadlines'], ['globe', 'Globe']].map(([k, l]) => `<button data-tt="${k}" class="${TRK.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <span id="tact" class="hstack" style="margin-left:auto"></span></div><div id="tbody"><span class="ld"></span></div></div>`;
  $$('[data-tt]').forEach(b => b.onclick = () => { TRK.tab = b.dataset.tt; V.track(); });
  ({board: trackBoard, cal: trackCal, globe: trackGlobe})[TRK.tab]();
};
async function trackBoard() {
  const [items, stalled] = await Promise.all([agent('/api/tracker'), agent('/api/tracker/stalled?days=7').catch(() => [])]);
  $('#tact').innerHTML = '<button class="btn" id="tsync">Read my inbox for updates</button>';
  $('#tbody').innerHTML = (stalled.length ? `<div class="card glass" style="margin-bottom:16px"><h3>No reply for 7+ days <span class="mono">${stalled.length}</span></h3>
    ${stalled.map(x => `<div class="row"><span style="flex:1">${esc(x.title)} · ${esc(x.company)}</span><span class="note">applied ${esc(x.applied_at || '')}</span><button class="btn" data-fu="${esc(x.id)}" style="padding:3px 9px">Draft follow-up</button></div>`).join('')}<div class="md" id="fuo"></div></div>` : '') +
    `<div class="kan">${BOARD.map(st => { const L = items.filter(i => i.status === st);
      return `<div class="kcol glass" data-s="${st}"><h3>${st} <span class="mono">${L.length}</span></h3>${L.map(i => `<div class="kcard" draggable="true" data-id="${esc(i.id)}">
        <b>${esc(i.title)}</b><span class="note">${esc(i.company || '')}</span>${i.deadline ? `<span class="note" style="color:var(--red)">due ${esc(i.deadline)}</span>` : ''}${i.next_action ? `<span class="note" style="color:var(--gold)">→ ${esc(i.next_action)}</span>` : ''}</div>`).join('')}</div>`; }).join('')}</div>
    <p class="note" style="margin-top:8px">Drag cards between columns. Saving or starring in Discover puts a card in “saved”.</p>`;
  $$('.kcard').forEach(c => { c.ondragstart = e => e.dataTransfer.setData('id', c.dataset.id); c.ondblclick = () => { const j = items.find(i => i.id === c.dataset.id); if (j && j.url) window.open(j.url, '_blank', 'noopener'); }; });
  $$('.kcol').forEach(col => { col.ondragover = e => { e.preventDefault(); col.classList.add('over'); }; col.ondragleave = () => col.classList.remove('over');
    col.ondrop = async e => { e.preventDefault(); col.classList.remove('over'); await agent('/api/job/update', {id: e.dataTransfer.getData('id'), status: col.dataset.s});
      if (col.dataset.s === 'applied') gain('applied', 50); if (col.dataset.s === 'interview') gain('interview', 150); if (col.dataset.s === 'offer') gain('offer', 500); trackBoard(); }; });
  $$('[data-fu]').forEach(b => b.onclick = e => busy(e.target, async () => { const r = await agent('/api/tracker/followup', {job_id: b.dataset.fu}); $('#fuo').innerHTML = md(r.text); }));
  $('#tsync').onclick = e => busy(e.target, async () => { const r = await agent('/api/tracker/sync', {}); toast(r.ok === false ? 'Inbox: ' + (r.error || 'failed') : `Checked ${r.checked} emails · ${r.matched} updates`); trackBoard(); });
}
async function trackCal() {
  const m = TRK.month, y = m.getFullYear(), mo = m.getMonth(), off = (new Date(y, mo, 1).getDay() + 6) % 7, start = new Date(y, mo, 1 - off);
  const cells = [...Array(42)].map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), today = iso(new Date());
  const items = await agent(`/api/calendar?start=${iso(cells[0])}&end=${iso(cells[41])}`), by = {};
  items.forEach(i => (by[i.date] = by[i.date] || []).push(i));
  $('#tact').innerHTML = `<button class="btn" id="pm">◂</button><b style="font:300 15px Sora;letter-spacing:.1em">${m.toLocaleString(undefined, {month: 'long', year: 'numeric'})}</b><button class="btn" id="nm">▸</button>
    <a class="btn" href="${esc(S.settings.agent.url.replace(/\/$/, ''))}/api/calendar.ics" download>Export .ics</a>`;
  $('#tbody').innerHTML = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) 300px"><div class="card glass"><div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}
    ${cells.map(d => { const k = iso(d); return `<div class="day ${d.getMonth() !== mo ? 'other' : ''} ${k === today ? 'today' : ''}" data-d="${k}"><b>${d.getDate()}</b>${(by[k] || []).slice(0, 3).map(i => `<span class="ev ${esc(i.type)} ${i.done ? 'done' : ''}" title="${esc(i.title)}">${esc(i.title)}</span>`).join('')}${(by[k] || []).length > 3 ? `<span class="note">+${by[k].length - 3}</span>` : ''}</div>`; }).join('')}</div></div>
    <div class="stack" style="gap:16px;align-content:start"><div class="card glass"><h3>Add an event</h3><div class="stack"><input id="et" placeholder="Interview with Siemens Healthineers"><input type="date" id="ed" value="${today}"><input type="time" id="eti">
      <select id="ek"><option value="interview">Interview</option><option value="deadline">Deadline</option><option value="call">Call</option><option value="event">Event</option><option value="conference">Conference</option></select>
      <button class="btn p" id="eb">Add</button></div></div><div class="card glass" id="dayp"><h3>Day</h3><p class="note">Click a day.</p></div></div></div>`;
  $('#pm').onclick = () => { m.setMonth(m.getMonth() - 1); trackCal(); }; $('#nm').onclick = () => { m.setMonth(m.getMonth() + 1); trackCal(); };
  $('#eb').onclick = e => busy(e.target, async () => { if (!$('#et').value.trim()) return toast('Give the event a title.'); await agent('/api/events', {title: $('#et').value, date: $('#ed').value, time: $('#eti').value, kind: $('#ek').value}); toast('Added'); trackCal(); });
  $$('.day').forEach(d => d.onclick = () => { const L = by[d.dataset.d] || []; $('#ed').value = d.dataset.d;
    $('#dayp').innerHTML = `<h3>${d.dataset.d}</h3>` + (L.map(i => `<div class="row"><span class="tag">${esc(i.type)}</span><span style="flex:1">${esc(i.title)}<br><span class="note">${esc(i.time || '')} ${esc(i.sub || '')}</span></span></div>`).join('') || '<p class="note">Nothing on this day.</p>'); });
}
let GLOBE = null;
async function trackGlobe() {
  $('#tact').innerHTML = '<span class="note">Drag to spin · scroll to zoom · click a pin</span>';
  $('#tbody').innerHTML = `<div class="globe"><div class="card glass" style="padding:0"><canvas id="gl"></canvas></div><div class="card glass" id="gpl"><h3>Places</h3><span class="ld"></span></div></div>`;
  const [data, world] = await Promise.all([agent('/api/map'), GLOBE?.world || fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then(r => r.json())]);
  const cv = $('#gl'), W = cv.clientWidth, H = cv.clientHeight, r = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(W, H, false);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, W / H, .1, 100); cam.position.z = 3.4;
  sc.add(new THREE.AmbientLight(0xffffff, .8)); const dl = new THREE.DirectionalLight(0xfff1d6, .7); dl.position.set(3, 2, 4); sc.add(dl);
  const g = new THREE.Group(); sc.add(g);
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({color: css('--bg2'), transparent: true, opacity: .55, roughness: .6})));
  const v3 = (lon, lat, rad = 1.002) => { const p = (90 - lat) * Math.PI / 180, t = (lon + 180) * Math.PI / 180; return new THREE.Vector3(-rad * Math.sin(p) * Math.cos(t), rad * Math.cos(p), rad * Math.sin(p) * Math.sin(t)); };
  const pts = []; topojson.mesh(world, world.objects.countries).coordinates.forEach(line => { for (let i = 1; i < line.length; i++) pts.push(v3(...line[i - 1]), v3(...line[i])); });
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: css('--ink2'), transparent: true, opacity: .35})));
  const pins = [], max = Math.max(1, ...data.points.map(p => p.items.length));
  data.points.forEach(p => { const best = Math.max(...p.items.map(i => i.score || 0)), h = .03 + .2 * Math.sqrt(p.items.length / max);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, h, 6), new THREE.MeshStandardMaterial({color: css(best >= 85 ? '--gold' : best >= 70 ? '--red' : '--blue'), emissiveIntensity: .4}));
    m.material.emissive = m.material.color; const base = v3(p.lon, p.lat, 1); m.position.copy(base.clone().multiplyScalar(1 + h / 2)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), base.clone().normalize());
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(.018), m.material); tip.position.copy(base.clone().multiplyScalar(1 + h)); m.userData = tip.userData = p; g.add(m, tip); pins.push(m, tip); });
  const eu = v3(10, 48); g.rotation.y = Math.atan2(eu.x, eu.z) * -1; g.rotation.x = .5;
  let drag = null, spin = .0015;
  cv.onpointerdown = e => { drag = [e.clientX, e.clientY, 0]; }; window.addEventListener('pointerup', () => drag = null, {once: false});
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag[2] += Math.abs(dx) + Math.abs(dy); g.rotation.y += dx * .005; g.rotation.x = Math.max(-1.4, Math.min(1.4, g.rotation.x + dy * .005)); drag[0] = e.clientX; drag[1] = e.clientY; spin = 0; };
  cv.onwheel = e => { e.preventDefault(); cam.position.z = Math.max(1.6, Math.min(6, cam.position.z + e.deltaY * .002)); };
  const ray = new THREE.Raycaster();
  cv.onclick = e => { const b = cv.getBoundingClientRect(); ray.setFromCamera({x: (e.clientX - b.left) / b.width * 2 - 1, y: -(e.clientY - b.top) / b.height * 2 + 1}, cam);
    const h = ray.intersectObjects(pins)[0]; if (h) place(h.object.userData); };
  const place = p => { $('#gpl').innerHTML = `<h3>${esc(p.place)} <span class="mono">${p.items.length}</span></h3>` + p.items.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 25)
    .map(i => `<div class="row"><span style="flex:1">${esc(i.title)}<br><span class="note">${esc(i.company || '')} · ${esc(i.kind || '')}</span></span><span class="r">${Math.round(i.score || 0)}</span></div>`).join(''); };
  $('#gpl').innerHTML = `<h3>Top places</h3>` + data.points.slice(0, 12).map((p, i) => `<div class="row"><a href="#" data-pl="${i}" style="flex:1">${esc(p.place)}</a><span class="r">${p.items.length}</span></div>`).join('') +
    (data.virtual?.length ? `<p class="note" style="margin-top:8px">${data.virtual.length} remote or unlocated</p>` : '');
  $$('[data-pl]').forEach(a => a.onclick = e => { e.preventDefault(); place(data.points[+a.dataset.pl]); });
  GLOBE = {world, alive: true};
  const loop = () => { if (!document.body.contains(cv)) return; requestAnimationFrame(loop); if (document.hidden) return; g.rotation.y += spin; r.render(sc, cam); };
  loop();
}

/* ---------- research: web-searched briefs with sources (local agent), model knowledge otherwise ---------- */
const RKINDS = {company: 'Company', lab: 'Research lab', person: 'Researcher / hiring manager', field: 'Field', country: 'Country: visa, salary, relocation', salary: 'Salary for a saved role', question: 'Any question'};
const RS = {kind: 'company'};
V.research = async () => {
  const saved = AGENT ? await agent('/api/jobs?status=saved&limit=60').catch(() => []) : [];
  const k = RS.kind, quick = [...new Set(saved.map(j => j.company).filter(Boolean))].slice(0, 10);
  $('#v-research').innerHTML = `<div class="stack" style="gap:16px"><div class="seg">${Object.entries(RKINDS).map(([x, l]) => `<button data-rk="${x}" class="${x === k ? 'on' : ''}">${l}</button>`).join('')}</div>
   <div class="wgrid"><div class="card glass"><div class="stack"><h3>${RKINDS[k]}</h3>
    ${k === 'salary' ? `<select id="rjob">${saved.map(j => `<option value="${esc(j.id)}">${esc(j.title)} · ${esc(j.company || '')}</option>`).join('')}</select><textarea id="roffer" style="min-height:60px" placeholder="Offer details if you have one (optional)"></textarea>`
      : `<input id="rtopic" placeholder="${{company: 'Siemens Healthineers', lab: 'Prof. X lab, PET physics, TU Munich', person: 'Name, role, institution', field: 'Total-body PET', country: 'Germany', question: 'Which EU fellowships fund a PET physics postdoc in industry?'}[k]}">`}
    ${quick.length && (k === 'company' || k === 'lab') ? `<div class="chips">${quick.map(c => `<span class="chip" data-q="${esc(c)}">${esc(c)}</span>`).join('')}</div><p class="note">From your saved opportunities.</p>` : ''}
    <button class="btn p" id="rgo">Research</button>
    <p class="note">${AGENT ? 'Searches the web (Claude, then Codex) and cites sources. Takes 1–3 minutes.' : 'Browser mode has no live web search: answers come from the model\'s knowledge, so check them.'}</p></div></div>
    <div class="card glass doc"><h3><span id="rwho">Brief</span><button class="btn" id="rcopy" style="padding:3px 9px">Copy</button></h3><div class="md" id="rout"><p class="note">Results appear here and are saved with your documents.</p></div></div></div></div>`;
  let last = '';
  $$('[data-rk]').forEach(b => b.onclick = () => { RS.kind = b.dataset.rk; V.research(); });
  $$('[data-q]').forEach(c => c.onclick = () => $('#rtopic').value = c.dataset.q);
  $('#rcopy').onclick = () => { navigator.clipboard.writeText(last); toast('Copied'); };
  $('#rgo').onclick = e => busy(e.target, async () => {
    const topic = ($('#rtopic') || {}).value?.trim(); let r;
    if (k !== 'salary' && !topic) return toast('What should I research?');
    if (AGENT) r = k === 'country' ? await agent('/api/country_brief', {country: topic}) : k === 'salary' ? await agent('/api/ai/salary_advisor', {job_id: $('#rjob').value, offer: $('#roffer').value}) : await agent('/api/research', {topic, kind: k});
    else r = {text: await ask('coach', `Write a brief about: ${topic} (${RKINDS[k]}). Say clearly what you are unsure of; you cannot browse.\n\nABOUT ME:\n${graphText().slice(0, 4000)}`), agent: providerFor('coach')};
    last = r.text; $('#rout').innerHTML = md(r.text); $('#rwho').textContent = 'Brief · by ' + (r.agent || 'model'); gain('research', 5);
  });
};

/* ---------- practice: mock interviews with scores, cheatsheets ---------- */
const PR = {id: null, log: []};
V.practice = async () => {
  const saved = AGENT ? await agent('/api/jobs?status=saved&limit=60').catch(() => []) : [];
  $('#v-practice').innerHTML = `<div class="wgrid"><div class="card glass"><div class="stack"><h3>Mock interview</h3>
    ${AGENT ? `<select id="pjob">${saved.map(j => `<option value="${esc(j.id)}">${esc(j.title)} · ${esc(j.company || '')}</option>`).join('')}</select>` : '<textarea id="pjd" placeholder="Paste the posting"></textarea>'}
    <select id="pstyle"><option value="mixed">Mixed</option><option value="behavioral">Behavioural</option><option value="technical">Technical</option><option value="research">Research talk / academic panel</option><option value="case">Case / product</option></select>
    <div class="hstack"><select id="pn" style="flex:1"><option>4</option><option selected>6</option><option>8</option></select><select id="plang" style="flex:1"><option>English</option><option>French</option></select></div>
    <button class="btn p" id="pstart">Start interview</button>
    ${AGENT ? '<button class="btn" id="pcheat">Cheatsheet for this role</button>' : ''}
    <p class="note">One question at a time; each answer is scored with feedback. Finish any time for a summary.</p></div></div>
   <div class="card glass doc"><h3>Interview <span class="score" id="pavg"></span></h3><div class="chat" id="pchat"><p class="note">Pick a role and press Start.</p></div>
    <div class="stack" style="margin-top:12px"><textarea id="pans" placeholder="Your answer…" style="min-height:80px"></textarea><div class="hstack"><button class="btn p" id="psend">Answer</button><button class="btn" id="pfin">Finish and summarise</button></div></div></div></div>`;
  const chat = $('#pchat'), add = (cls, html) => { chat.insertAdjacentHTML('beforeend', `<div class="msg ${cls}">${html}</div>`); chat.scrollTop = 1e9; };
  const scores = [], showAvg = () => { if (scores.length) $('#pavg').textContent = 'avg ' + (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) + '/10'; };
  $('#pstart').onclick = e => busy(e.target, async () => {
    chat.innerHTML = ''; scores.length = 0; PR.log = [];
    if (AGENT) { const r = await agent('/api/mock/start', {job_id: $('#pjob').value, style: $('#pstyle').value, questions: +$('#pn').value, language: $('#plang').value}); PR.id = r.id; add('iq', md(r.text)); }
    else { PR.id = 'local'; PR.log = [{role: 'system', text: `Interview me (${$('#pstyle').value}, ${$('#pn').value} questions, ${$('#plang').value}) for this posting. Ask ONE question at a time. After each answer give a score /10 as "Score: N/10", brief feedback, then the next question.\nPOSTING:\n${$('#pjd').value.slice(0, 5000)}\nME:\n${graphText().slice(0, 4000)}`}];
      const q = await ask('chat', PR.log[0].text); PR.log.push({role: 'q', text: q}); add('iq', md(q)); }
  });
  const answer = finish => busy(finish ? $('#pfin') : $('#psend'), async () => {
    if (!PR.id) return toast('Start an interview first.');
    const a = $('#pans').value.trim(); if (!a && !finish) return toast('Write your answer first.');
    if (a) add('ia', esc(a)); $('#pans').value = '';
    let r;
    if (AGENT) r = await agent('/api/mock/answer', {id: PR.id, answer: a || '(finishing)', finish});
    else { PR.log.push({role: 'a', text: a}); const t = await ask('chat', PR.log.map(m => (m.role === 'a' ? 'CANDIDATE: ' : m.role === 'q' ? 'INTERVIEWER: ' : '') + m.text).join('\n\n') + (finish ? '\n\nEnd the interview: overall score, 3 strengths, 3 fixes.' : ''));
      PR.log.push({role: 'q', text: t}); const m = t.match(/Score:\s*(\d+)/i); r = {text: t, scores: m ? [+m[1]] : [], done: finish}; }
    (r.scores || []).slice(-1).forEach(x => scores.push(x)); showAvg(); add('iq', md(r.text)); gain('practice', 10);
    if (r.done) PR.id = null;
  });
  $('#psend').onclick = () => answer(false); $('#pfin').onclick = () => answer(true);
  const ch = $('#pcheat'); if (ch) ch.onclick = e => busy(e.target, async () => { const r = await agent('/api/ai/cheatsheet', {job_id: $('#pjob').value}); chat.innerHTML = `<div class="md">${md(r.text)}</div>`; });
};

/* ---------- write: tailored resume + ATS check, cover letter, emails, LinkedIn ---------- */
const WRITE = {tool: 'resume', job: '', jd: ''};
const EMAILS = {recruiter_outreach: 'Recruiter / hiring manager outreach', referral_request: 'Ask for a referral', follow_up: 'Follow-up after applying',
  thank_you: 'Thank-you after interview', networking: 'Networking / informational interview', postdoc_inquiry: 'Postdoc inquiry to a PI',
  spontaneous: 'Spontaneous application', negotiation: 'Offer negotiation', withdraw: 'Withdraw from a process'};
const TOOLS = {resume: 'Tailored resume', ats: 'ATS check', letter: 'Cover letter', email: 'Email', linkedin: 'LinkedIn'};
V.write = async () => {
  const saved = AGENT ? await agent('/api/jobs?status=saved&limit=60').catch(() => []) : [];
  const t = WRITE.tool;
  $('#v-write').innerHTML = `<div class="stack" style="gap:16px"><div class="seg">${Object.entries(TOOLS).map(([k, l]) => `<button data-tool="${k}" class="${k === t ? 'on' : ''}">${l}</button>`).join('')}</div>
   <div class="wgrid"><div class="card glass"><div class="stack">
    <h3>For which opportunity?</h3>
    ${AGENT ? `<select id="wjob"><option value="">Paste a posting instead</option>${saved.map(j => `<option value="${esc(j.id)}" ${j.id === WRITE.job ? 'selected' : ''}>${esc(j.title)} · ${esc(j.company || '')}</option>`).join('')}</select>
      <p class="note">Your saved and starred cards from Discover.</p>` : ''}
    <textarea id="wjd" placeholder="Paste the posting text (job, PhD, postdoc, fellowship…)" class="${WRITE.job ? 'hidden' : ''}">${esc(WRITE.jd)}</textarea>
    ${t === 'resume' ? `<input id="wfocus" placeholder="Focus (optional): e.g. emphasise PET quantification and industry impact">` : ''}
    ${t === 'letter' ? `<input id="wtone" placeholder="Tone" value="confident, warm, concise"><select id="wlang"><option>English</option><option>French</option><option>German</option><option>Spanish</option></select>` : ''}
    ${t === 'email' ? `<select id="wkind">${Object.entries(EMAILS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input id="wto" placeholder="Recipient (name, role) - optional"><textarea id="wctx" style="min-height:60px" placeholder="Anything to mention (a paper of theirs, a mutual contact…)"></textarea>
      <select id="wlang"><option>English</option><option>French</option></select>` : ''}
    ${t === 'linkedin' ? `<select id="wli"><option value="about">About section</option><option value="headline">Headlines (5 options)</option><option value="post">Post about a project or paper</option></select>
      <input id="wtopic" placeholder="Topic for a post (e.g. my MuPET paper)">` : ''}
    <button class="btn p" id="wgo">Write it</button>
    <p class="note">Drafts use only facts from your resume and graph. You review, edit and send them yourself.</p></div></div>
    <div class="card glass doc"><h3><span id="wwho">Draft</span><span class="hstack"><button class="btn" id="wcopy" style="padding:3px 9px">Copy</button>${t === 'resume' && AGENT ? '<button class="btn" id="wprint" style="padding:3px 9px">Print / PDF</button>' : ''}</span></h3>
     <div class="md" id="wout"><p class="note">Pick a tool and an opportunity, then press Write it.</p></div></div></div></div>`;
  let last = '', docId = null;
  $$('[data-tool]').forEach(b => b.onclick = () => { WRITE.tool = b.dataset.tool; V.write(); });
  const wj = $('#wjob'); if (wj) wj.onchange = () => { WRITE.job = wj.value; $('#wjd').classList.toggle('hidden', !!wj.value); };
  $('#wjd').oninput = () => WRITE.jd = $('#wjd').value;
  $('#wcopy').onclick = () => { navigator.clipboard.writeText(last); toast('Copied'); };
  const pr = $('#wprint'); if (pr) pr.onclick = () => window.open(S.settings.agent.url.replace(/\/$/, '') + '/api/resume/export' + (docId ? '?id=' + docId : ''), '_blank');
  $('#wgo').onclick = e => busy(e.target, async () => {
    const job = WRITE.job, jd = $('#wjd').value.trim(), v = id => ($(id) || {}).value || '';
    if (!job && !jd && t !== 'linkedin') return toast('Pick a saved opportunity or paste a posting.');
    let r;
    if (AGENT) {
      const base = {job_id: job || undefined, jd};
      if (t === 'resume') r = await agent('/api/ai/tailor_resume', {...base, focus: v('#wfocus')});
      else if (t === 'ats') { const a = await agent('/api/ai/ats', base); r = {text: typeof a === 'string' ? a : a.text || '```\n' + JSON.stringify(a, null, 1) + '\n```', agent: a.agent}; }
      else if (t === 'letter') r = await agent('/api/ai/cover_letter', {...base, tone: v('#wtone'), language: v('#wlang')});
      else if (t === 'email') r = await agent('/api/ai/email', {...base, kind: v('#wkind'), recipient: v('#wto'), context: v('#wctx'), language: v('#wlang')});
      else r = await agent('/api/ai/raw', {prompt: liPrompt(v('#wli'), v('#wtopic'), jd), task: 'writing'});
      if (t === 'resume') { const d = await agent('/api/docs?kind=tailored_resume').catch(() => []); docId = (d[0] || {}).id; }
    } else {
      const facts = `MY GRAPH (only facts you may use):\n${graphText().slice(0, 6000)}`, post = jd ? `\n\nPOSTING:\n${jd.slice(0, 8000)}` : '';
      const prompts = {
        resume: `Write a tailored, ATS-friendly resume in Markdown for this posting. Use ONLY facts from my graph; reorder and rephrase, never invent. ${v('#wfocus')}`,
        ats: 'Act as an ATS and a recruiter. Score my fit /100 for this posting, list matched keywords, missing keywords, and the 5 most valuable edits. Markdown.',
        letter: `Write a cover letter in ${v('#wlang') || 'English'}, tone: ${v('#wtone')}. One page, specific to the posting, only true facts.`,
        email: `Write ${EMAILS[v('#wkind')]} in ${v('#wlang') || 'English'} to ${v('#wto') || 'the right person'}. Context: ${v('#wctx')}. Short, specific, only true facts. Include a subject line.`,
        linkedin: liPrompt(v('#wli'), v('#wtopic'), '')};
      r = {text: await ask(t === 'ats' ? 'coach' : 'chat', `${prompts[t]}\n\n${facts}${post}`), agent: providerFor('chat')};
    }
    last = r.text; $('#wout').innerHTML = md(r.text); $('#wwho').textContent = 'Draft · by ' + (r.agent || 'model'); gain('draft', 5);
  });
};
const liPrompt = (kind, topic, jd) => ({
  about: 'Write my LinkedIn About section (≤ 1,800 characters): first person, specific, no buzzwords, ending with what I am looking for. Only true facts from my resume and graph.',
  headline: 'Write 5 LinkedIn headline options (≤ 220 characters each), specific to my field and target roles. Only true facts.',
  post: `Write a LinkedIn post (≤ 1,300 characters) about: ${topic || 'my most recent project'}. Plain, human, no hype or emoji walls, one clear takeaway, a question at the end. Only true facts.`,
}[kind] + (jd ? `\n\nAim it at roles like:\n${jd.slice(0, 2000)}` : '') + `\n\nMY GRAPH (only facts you may use):\n${graphText().slice(0, 6000)}`);

/* ---------- discover: swipe through opportunities (local agent) ---------- */
const DECK = {cards: [], i: 0, scope: 'jobs', hist: [], stats: {like: 0, nope: 0, super: 0, later: 0}, remaining: 0};
const RAR = {legendary: 'Legendary', epic: 'Epic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common'};
const xj = (t, d) => { try { return JSON.parse(t || '') ?? d; } catch (e) { return d; } };
V.discover = async () => {
  if (!AGENT) { $('#v-discover').innerHTML = `<div class="card glass"><h3>Discover</h3><p class="sub">Opportunity scans run in the local agent on your computer
    (jobs, PhD and postdoc positions, labs, fellowships, hackathons). Pair it in ⚙ Settings, or check a single posting under ◇.</p></div>`; return; }
  $('#v-discover').innerHTML = `<div class="disc"><div class="deckzone">
     <div class="scope">${['jobs', 'academia', 'community', 'all'].map(x => `<button class="btn ${x === DECK.scope ? 'on' : ''}" data-scope="${x}">${x}</button>`).join('')}</div>
     <div class="deck" id="deck"></div>
     <div class="swipebar"><button class="nope" data-a="nope" title="Dismiss (←)">✕</button><button data-a="later" title="Later (↓)">↓</button>
      <button id="undo" title="Undo (Z)">↺</button><button class="super" data-a="super" title="Star (↑)">★</button><button class="like" data-a="like" title="Save (→)">♥</button></div>
     <div class="note" id="dstats"></div></div>
    <div class="stack" style="gap:16px;align-content:start">
     <div class="card glass hot"><h3>What's hot <button class="btn" id="hotb" style="padding:3px 9px">Refresh</button></h3><div id="hot"><span class="ld"></span></div></div>
     <div class="card glass"><h3>Keys</h3><p class="note">→ save · ← dismiss · ↑ star · ↓ later · Z undo. Every swipe trains your ranking.
      Dashed skills on a card are ones you lack: “+ learn” adds them as a goal with a plan.</p></div></div></div>`;
  $$('[data-scope]').forEach(b => b.onclick = () => { DECK.scope = b.dataset.scope; V.discover(); });
  $$('.swipebar [data-a]').forEach(b => b.onclick = () => swipe(b.dataset.a));
  $('#undo').onclick = undo;
  $('#hotb').onclick = e => busy(e.target, async () => { await agent('/api/radar', {categories: ['trends']}); toast("Searching what's hot in your field (2–4 min)"); });
  loadHot(); await loadDeck();
};
async function loadHot() {
  const hot = await agent('/api/jobs?kind=trend&limit=8&sort=new').catch(() => []);
  $('#hot').innerHTML = hot.map(h => `<div class="row"><div style="flex:1"><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a>
    <div class="note">${esc(h.company || '')} ${h.posted_at ? '· ' + esc(h.posted_at) : ''}</div></div></div>`).join('') || '<p class="note">Nothing yet. Refresh searches the web for trends in your field.</p>';
}
async function loadDeck() {
  const d = await agent(`/api/deck?scope=${DECK.scope}&n=30`); DECK.cards = d.cards; DECK.i = 0; DECK.remaining = d.remaining; renderDeck();
}
function dcard(j, k) {
  const x = xj(j.extra, {}), v = xj(j.ai_verdict, null), r = x.rarity || 'common', fit = Math.round(x.fit ?? j.score ?? 0);
  const have = xj(j.matched, []).slice(0, 6), miss = xj(j.missing, []).slice(0, 5), ver = x.verified || {};
  const blurb = (v && v.why) || (j.description || '').replace(/\s+/g, ' ').slice(0, 320);
  return `<div class="dcard glass r-${r}" data-k="${k}" style="z-index:${10 - k};transform:translateZ(${-k * 60}px) translateY(${k * 14}px) rotateX(${k * 2}deg);opacity:${1 - k * .25}">
    <div class="top"><span class="fit">${fit}</span><span class="rar">${RAR[r]}</span><span class="tag" style="margin-left:auto">${esc(j.kind || 'job')}</span></div>
    <h2>${esc(j.title)}</h2><div class="note">${esc(j.company || '')}${j.location ? ' · ' + esc(j.location) : ''}${j.deadline ? ' · deadline ' + esc(j.deadline) : ''}</div>
    <div class="note">${ver.status === 'open' ? '✓ verified open' : 'not yet verified'} · source ${esc(x.found_by || j.source || '')}</div>
    <p class="blurb">${esc(blurb)}</p>
    <div class="chipline">${have.map(h => `<span class="chip have">${esc(h)}</span>`).join('')}${miss.map(m => `<span class="chip miss" data-learn="${esc(m)}">${esc(m)} + learn</span>`).join('')}</div>
    <div class="hstack" style="margin-top:auto"><a class="btn" href="${esc(j.url)}" target="_blank" rel="noopener">Open posting ↗</a></div>
    <div class="stamp like">SAVE</div><div class="stamp nope">NOPE</div><div class="stamp super">STAR</div><div class="stamp later">LATER</div></div>`;
}
function renderDeck() {
  const el = $('#deck'); if (!el) return; const s = DECK.stats, rest = DECK.cards.slice(DECK.i, DECK.i + 3);
  $('#dstats').textContent = `${DECK.cards.length - DECK.i} in this deck · ${DECK.remaining} waiting · ♥ ${s.like} ★ ${s.super} ✕ ${s.nope} ↓ ${s.later}`;
  if (!rest.length) { el.innerHTML = `<div class="dcard glass r-common" style="align-items:center;justify-content:center"><h2>Deck cleared</h2><button class="btn p" id="more">Next deck</button></div>`; $('#more').onclick = loadDeck; return; }
  el.innerHTML = rest.map((j, k) => dcard(j, k)).reverse().join('');
  $$('#deck [data-learn]').forEach(c => c.onclick = e => { e.stopPropagation(); busy(c, async () => { const id = await store.desire(c.dataset.learn, 'skill', 'Asked for by ' + (DECK.cards[DECK.i].title || 'an opportunity'));
    gain('goal', XP.goal); toast(c.dataset.learn + ' added as a goal with a plan'); refreshQuests(); renderDock(); renderHUD(); }); });
  drag(el.querySelector('.dcard[data-k="0"]'));
}
function drag(card) {
  if (!card) return; let sx = 0, sy = 0, dx = 0, dy = 0, down = false;
  const dir = () => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'like' : 'nope') : (dy < 0 ? 'super' : 'later');
  card.onpointerdown = e => { if (e.target.closest('a,button,[data-learn]')) return; down = true; sx = e.clientX; sy = e.clientY; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; };
  card.onpointermove = e => { if (!down) return; dx = e.clientX - sx; dy = e.clientY - sy;
    card.style.transform = `translate3d(${dx}px,${dy}px,40px) rotateY(${dx / 14}deg) rotateX(${-dy / 18}deg) rotateZ(${dx / 30}deg)`;
    const d = dir(), k = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / 120); card.querySelectorAll('.stamp').forEach(s => s.style.opacity = s.classList.contains(d) ? k : 0); };
  card.onpointerup = () => { if (!down) return; down = false; card.style.transition = '';
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 110) swipe(dir()); else { card.style.transform = ''; card.querySelectorAll('.stamp').forEach(s => s.style.opacity = 0); } dx = dy = 0; };
}
async function swipe(action) {
  const j = DECK.cards[DECK.i]; if (!j) return;
  const card = $('#deck .dcard[data-k="0"]');
  if (card) { card.querySelector('.stamp.' + action).style.opacity = 1;
    card.style.transform = {like: 'translate3d(140%,0,0) rotateY(35deg)', nope: 'translate3d(-140%,0,0) rotateY(-35deg)', super: 'translate3d(0,-130%,120px) rotateX(25deg)', later: 'translate3d(0,130%,0) rotateX(-25deg)'}[action]; card.style.opacity = 0; }
  DECK.i++; DECK.stats[action]++; DECK.hist.push({id: j.id, action}); setTimeout(renderDeck, 260);
  if (action === 'like' || action === 'super') gain('swipe', action === 'super' ? 8 : 5); else gain('swipe', 2);
  try { await agent('/api/swipe', {id: j.id, action}); } catch (e) { toast('⚠ ' + e.message); }
}
async function undo() {
  const h = DECK.hist.pop(); if (!h) return toast('Nothing to undo');
  await agent('/api/swipe/undo', {id: h.id}); DECK.i = Math.max(0, DECK.i - 1); DECK.stats[h.action]--; renderDeck(); toast('Undone');
}
document.addEventListener('keydown', e => {
  if (!$('#v-discover.on') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const m = {ArrowRight: 'like', ArrowLeft: 'nope', ArrowUp: 'super', ArrowDown: 'later'}[e.key];
  if (m) { e.preventDefault(); swipe(m); } else if (e.key === 'z' || e.key === 'Z') undo();
});

/* ---------- onboarding: resume → graph ---------- */
async function readResume(file) {
  if (/\.pdf$/i.test(file.name)) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise; let t = '';
    for (let i = 1; i <= pdf.numPages; i++) t += (await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' ') + '\n';
    return t;
  }
  return file.text();
}
async function buildFromResume(text) {
  S.demo = false;
  if (AGENT) {  // the agent stores the resume and builds the graph in the background; wait for it
    await agent('/api/resume/text', {name: 'resume', text}); toast('Reading your resume… this takes a minute or two.');
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 5000)); const g = await agent('/api/kg'); if (g.nodes.some(n => n.kind === 'skill' || n.kind === 'tool')) return; }
    return; }
  S.nodes = []; S.edges = []; return store.ingest(text, 'resume');
}
function onboarding() {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="glass"><div style="position:relative;z-index:1"><div class="kind">ANIMUS · Career</div><h2>Synchronize your career memory</h2>
    <p class="sub" style="margin:8px 0 16px">Your resume becomes a 3D graph of your skills, methods, projects and roles. Add LinkedIn, GitHub, a portfolio or reports later; ANIMUS then suggests skills worth learning, each with a plan.
    Private by design: no account, no server, nothing stored outside this browser (or your own computer if you pair the local agent).</p>
    <div class="stack"><b style="font-size:13px">1 · Choose a model</b>
    <div class="hstack"><button class="btn p" data-q="browser">Try with no key (in-browser)</button><button class="btn" data-q="hf">Hugging Face token</button><button class="btn" data-q="ollama">Ollama on this computer (free)</button><button class="btn" data-q="key">Other API key</button><button class="btn" data-q="agent">I run the local agent</button></div>
    <div id="hfbox" class="hstack" style="display:none"><input id="hftok" type="password" placeholder="hf_… token (stays in this browser)" style="flex:1"><button class="btn" id="hfsave">Use it</button></div>
    <details class="note" style="margin-top:4px"><summary style="cursor:pointer">More ways to connect: API providers, download, CLI, MCP</summary>
    <div style="margin-top:8px;line-height:1.6">
    <b>API providers</b> (⚙ Settings → Models): Claude, OpenAI, Gemini, DeepSeek, OpenRouter, Hugging Face, or any OpenAI-compatible endpoint. Keys stay in this browser and go only to that provider.<br>
    <b>Local models</b>: Ollama (<span class="mono">OLLAMA_ORIGINS=* ollama serve</span>) or LM Studio with CORS on.<br>
    <b>Download the full career agent</b> (scans, tracker, deadlines, weekly brief, your Claude Code / Codex / Gemini subscriptions):<br>
    <span class="mono">git clone https://github.com/SaiKiranKumarNalla/animus-career && cd animus-career && ./scripts/install.sh</span><br>
    <b>CLI</b>: <span class="mono">animus open</span> · <span class="mono">animus scan</span> · <span class="mono">animus jobs</span> · <span class="mono">animus pair</span> (then paste the code under ⚙ Settings to link this page).<br>
    <b>MCP / API</b>: <span class="mono">animus mcp</span> exposes your career graph and tracker to Claude Code, Codex or any MCP client; the local agent also serves a REST API on 127.0.0.1:8765.
    </div></details>
    <b style="font-size:13px;margin-top:8px">2 · Add your resume</b><input type="file" id="rf" accept=".pdf,.txt,.md"><textarea id="rt" placeholder="…or paste it here"></textarea>
    <div class="hstack"><button class="btn p" id="rgo">Build my graph</button><button class="btn" id="demo">Explore a sample first</button></div><p class="note" id="rmsg"></p></div></div></div>`;
  document.body.appendChild(o);
  o.querySelector('[data-q="ollama"]').onclick = () => { (S.settings.providers.ollama = S.settings.providers.ollama || {}).on = true; save(); $('#rmsg').textContent = 'Ollama selected. Start it with OLLAMA_ORIGINS=* ollama serve and pull a model, e.g. ollama pull qwen3.'; };
  o.querySelector('[data-q="browser"]').onclick = () => { (S.settings.providers.browser = S.settings.providers.browser || {}).on = true; save();
    $('#rmsg').textContent = navigator.gpu ? 'In-browser model selected (Qwen2.5 1.5B). It downloads about 1 GB on first use, then stays cached. Nothing leaves your computer.' : 'This browser has no WebGPU: use Chrome or Edge, or pick another model.'; };
  o.querySelector('[data-q="hf"]').onclick = () => { o.querySelector('#hfbox').style.display = 'flex'; o.querySelector('#hftok').focus(); };
  o.querySelector('#hfsave').onclick = () => { const k = o.querySelector('#hftok').value.trim(); if (!k.startsWith('hf_')) return toast('That does not look like a Hugging Face token (hf_…).');
    (S.settings.providers.huggingface = S.settings.providers.huggingface || {}).key = k; save(); $('#rmsg').textContent = 'Hugging Face selected (model: Qwen/Qwen3-32B, change it in ⚙ Settings). Uses your HF inference credits.'; };
  o.querySelector('[data-q="key"]').onclick = () => { o.remove(); show('settings'); };
  o.querySelector('[data-q="agent"]').onclick = () => { o.remove(); show('settings'); };
  o.querySelector('#demo').onclick = () => { o.remove(); demo(); };
  o.querySelector('#rgo').onclick = e => busy(e.target, async () => {
    const f = o.querySelector('#rf').files[0], text = f ? await readResume(f) : o.querySelector('#rt').value;
    if ((text || '').trim().length < 200) return toast('That resume looks too short to read.');
    await buildFromResume(text); o.remove(); await boot(); toast('Graph built. Next: let ANIMUS suggest skills for your goals.');
  });
}
function demo() {
  const N = [['skill', 'Python'], ['skill', 'PyTorch'], ['skill', 'Computer vision'], ['skill', 'SQL'], ['tool', 'Docker'], ['project', 'Brain MRI segmentation'], ['project', 'Retina screening app'],
    ['role', 'ML Engineer · Startup'], ['education', 'MSc Biomedical Eng'], ['publication', 'MICCAI workshop paper'], ['domain', 'Climate tech']];
  S.nodes = [{id: 'me', kind: 'person', label: 'Sample person', source: 'resume', sync: 2}]; S.edges = [];
  N.forEach(([k, l, s]) => { const id = k + ':' + l.toLowerCase().replace(/[^a-z0-9]+/g, '-'); S.nodes.push({id, kind: k, label: l, detail: '', source: 'resume', sync: 2}); });
  S.nodes.push({id: 'skill:mlops', kind: 'skill', label: 'MLOps', source: 'goal', sync: 1, detail: 'Asked for in most of your matches',
    plan: [{text: 'Follow a free MLOps course (week 1)', done: true}, {text: 'Containerise your segmentation model', done: false}, {text: 'Add CI and a model registry', done: false}, {text: 'Publish the pipeline repo with a README', done: false}]});
  const id = l => S.nodes.find(n => n.label === l).id;
  [['me', 'Brain MRI segmentation'], ['me', 'Retina screening app'], ['me', 'ML Engineer · Startup'], ['me', 'MSc Biomedical Eng'], ['me', 'MICCAI workshop paper'], ['me', 'Climate tech'],
    ['Brain MRI segmentation', 'PyTorch'], ['Brain MRI segmentation', 'Computer vision'], ['Brain MRI segmentation', 'Python'], ['Retina screening app', 'Computer vision'], ['Retina screening app', 'Docker'],
    ['ML Engineer · Startup', 'SQL'], ['ML Engineer · Startup', 'Python'], ['MICCAI workshop paper', 'Brain MRI segmentation'], ['me', 'MLOps']]
    .forEach(([a, b]) => S.edges.push({src: a === 'me' ? 'me' : id(a), dst: id(b), rel: 'related_to'}));
  S.demo = true; save(); boot();
}

/* ---------- shell ---------- */
function mode() { return document.documentElement.dataset.mode || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function theme() {
  const p = PALETTES[S.settings.palette] || PALETTES.paris, m = mode(), t = Object.assign({}, p[m], (S.settings.custom || {})[m] || {});
  document.documentElement.dataset.mode = m;
  Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
  $('#legend').innerHTML = [['skill', 'Skill'], ['project', 'Project'], ['role', 'Role'], ['education', 'Education'], ['domain', 'Domain']]
    .map(([k, l]) => `<span><i style="background:var(${Graph3D.KIND[k]})"></i>${l}</span>`).join('') + '<span><i style="background:var(--gold)"></i>Learned goal</span><span><i style="border:1px dashed var(--muted)"></i>Goal, not yet synced</span>';
  Graph3D.paint();
}
function show(v) {
  $$('nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  $('#labels').style.display = v === 'core' ? '' : 'none';
  document.body.classList.toggle('wide', v !== 'core');
  if (V[v]) V[v]();
}
function redraw(id) { refreshQuests(); Graph3D.set(S.nodes, S.edges, id || sel); renderDock(); renderHUD(); }
async function boot() {
  AGENT = await detectAgent();
  try { await store.load(); } catch (e) { toast('Agent: ' + e.message); }
  redraw(sel); if (!S.nodes.length) onboarding();
}

$('#ak').innerHTML = KINDS.map(k => `<option ${k === 'project' ? 'selected' : ''}>${k}</option>`).join('');
$('#add').onclick = e => busy(e.target, async () => { const l = $('#al').value.trim(); if (!l) return; const id = await store.add($('#ak').value, l, '', sel, 'related_to');
  $('#al').value = ''; gain('node', XP.node); redraw(id); });
$$('nav [data-v]').forEach(b => b.onclick = () => show(b.dataset.v));
$('#modeBtn').onclick = () => { document.documentElement.dataset.mode = mode() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('animus.mode', document.documentElement.dataset.mode); } catch (e) {} theme(); if ($('#v-settings.on')) V.settings(); };
try { const m = localStorage.getItem('animus.mode'); if (m) document.documentElement.dataset.mode = m; } catch (e) {}
document.addEventListener('pointermove', e => { const g = e.target.closest && e.target.closest('.glass'); if (!g) return; const b = g.getBoundingClientRect();
  g.style.setProperty('--mx', (e.clientX - b.left) + 'px'); g.style.setProperty('--my', (e.clientY - b.top) + 'px');
  if (g.classList.contains('tilt')) { const x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5; g.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(4px)`; } });
document.addEventListener('pointerout', e => { const g = e.target.closest && e.target.closest('.tilt'); if (g && !g.contains(e.relatedTarget)) g.style.transform = ''; });
Graph3D.init($('#scene'), $('#labels'), {onSelect: renderNode, paused: () => !$('#v-core.on'),
  frame: () => { const c = $('.center').getBoundingClientRect(), top = $('header').getBoundingClientRect().bottom, dock = $('.dock').getBoundingClientRect();
    return {left: c.left, right: c.right, top, bottom: dock.height ? dock.top : c.bottom}; }});
theme(); boot();
