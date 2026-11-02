/* ANIMUS ambience: drifting memory shards, desync transitions, theme toggle, Hawk Vision. Tiny, no dependencies. */
(() => {
  const root = document.documentElement;
  const theme = () => { try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; } };
  root.classList.toggle('light', theme() === 'light');
  const btn = document.createElement('button'); btn.className = 'themebtn'; btn.title = 'Light / dark Animus (T) · Hawk Vision (V)'; btn.textContent = '◐';
  btn.onclick = () => { const l = !root.classList.contains('light'); root.classList.toggle('light', l); try { localStorage.setItem('theme', l ? 'light' : 'dark'); } catch {} };
  document.querySelector('.top')?.insertBefore(btn, document.querySelector('.clock'));

  // shards: slow low-poly fragments that drift and occasionally flicker
  const c = document.createElement('canvas'); c.id = 'void'; document.body.prepend(c);
  const x = c.getContext('2d'); let W, H, S = [];
  const size = () => { W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio;
    S = Array.from({length: Math.min(46, innerWidth / 30)}, () => ({x: Math.random() * W, y: Math.random() * H, r: (12 + Math.random() * 46) * devicePixelRatio,
      a: Math.random() * 6.3, va: (Math.random() - .5) * .004, vy: -(.08 + Math.random() * .25) * devicePixelRatio, k: Math.random() < .15 ? 'g' : 'c', f: 0})); };
  size(); addEventListener('resize', size);
  let mx = 0, my = 0; addEventListener('mousemove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
  const draw = () => {
    x.clearRect(0, 0, W, H);
    const light = root.classList.contains('light');
    for (const s of S) {
      s.y += s.vy; s.a += s.va; if (s.y < -s.r) { s.y = H + s.r; s.x = Math.random() * W; }
      if (Math.random() < .0008) s.f = 12;
      const px = s.x + mx * s.r * 1.4, py = s.y + my * s.r * 1.4, al = (s.f-- > 0 ? .5 : .12);
      x.beginPath();
      for (let i = 0; i < 3; i++) { const t = s.a + i * 2.1 + (i === 1 ? .4 : 0); x.lineTo(px + Math.cos(t) * s.r, py + Math.sin(t) * s.r * .8); }
      x.closePath();
      const col = s.k === 'g' ? '185,124,14' : light ? '11,141,181' : '63,224,255';
      x.fillStyle = `rgba(${col},${al * (light ? .35 : .5)})`; x.strokeStyle = `rgba(${col},${al})`; x.lineWidth = devicePixelRatio; x.fill(); x.stroke();
    }
    if (!document.hidden) requestAnimationFrame(draw); else setTimeout(() => requestAnimationFrame(draw), 500);
  };
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) draw();

  // desync transition on every view change
  const main = document.querySelector('#main');
  const go0 = window.go;
  if (go0) window.go = (...a) => { main.classList.remove('desync'); void main.offsetWidth; main.classList.add('desync'); return go0(...a); };
  new MutationObserver(() => document.querySelectorAll('.h h2:not([data-g])').forEach(h => h.dataset.g = h.textContent))
    .observe(main, {childList: true});

  // keys: V = Hawk Vision, T = theme (ignored while typing)
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || e.metaKey || e.ctrlKey) return;
    if (e.key === 'v' || e.key === 'V') {
      document.body.classList.toggle('hawk');
      document.querySelectorAll('.score').forEach(s => s.classList.toggle('hi', parseInt(s.textContent) >= 75));
    }
    if (e.key === 't' || e.key === 'T') btn.click();
  });
})();
