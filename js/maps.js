// ============ MAPS: definitions + realistic pre-rendered terrain ============
const WW = 1800, WH = 1200;
const SPAWNS = [{x:100, y:WH / 2, a:0}, {x:WW - 100, y:WH / 2, a:Math.PI}];

// k: c = concrete (solid), h = house (solid), s = sandbags (4 hits), b = crates (2 hits)
// Every map is mirrored through the centre, so both sides are identical.
const MAPS = [
  {id:'grass', name:'Grasslands', seed:1337,
   th:{ga:[92, 104, 56], gb:[60, 74, 36], dirt:[112, 94, 64], road:[132, 112, 80], relief:160, patch:.55, micro:9,
       tufts:['#3a4a20', '#566a30', '#6d7e3e', '#47582a', '#7c8a48'], rock:[118, 114, 104], crater:[70, 58, 40],
       con:[150, 150, 146], bag:['#c9b48a', '#8f7a52'], dust:'#8c7a58', deco:'grass'},
   roads:[{pts:[[-20,600],[300,572],[600,598],[900,600],[1200,602],[1500,628],[1820,600]], w:72},
          {pts:[[900,-20],[878,300],[900,600],[922,900],[900,1220]], w:62}],
   half:[{x:260,y:180,w:40,h:240,k:'c'}, {x:260,y:780,w:240,h:40,k:'c'}, {x:560,y:420,w:40,h:360,k:'c'},
         {x:700,y:140,w:320,h:40,k:'s'}, {x:860,y:520,w:80,h:40,k:'b'}, {x:480,y:960,w:40,h:160,k:'s'},
         {x:1100,y:300,w:40,h:160,k:'b'}]},
  {id:'desert', name:'Desert Outpost', seed:4242,
   th:{ga:[208, 178, 126], gb:[184, 150, 100], dirt:[166, 128, 84], road:[176, 146, 104], relief:200, patch:.45, micro:7,
       tufts:['#7a6c3c', '#8f7f48', '#6b6436'], rock:[150, 124, 96], crater:[120, 92, 60],
       con:[196, 180, 148], bag:['#dcc89a', '#a08657'], dust:'#c8a874', deco:'desert'},
   roads:[{pts:[[-20,300],[400,330],[900,600],[1400,870],[1820,900]], w:84}],
   half:[{x:240,y:220,w:200,h:40,k:'c'}, {x:240,y:260,w:40,h:160,k:'c'}, {x:520,y:480,w:40,h:240,k:'s'},
         {x:700,y:200,w:40,h:120,k:'b'}, {x:380,y:820,w:240,h:40,k:'s'}, {x:640,y:700,w:120,h:40,k:'b'},
         {x:820,y:420,w:160,h:40,k:'c'}, {x:1060,y:120,w:40,h:160,k:'s'}, {x:1250,y:240,w:80,h:80,k:'b'}]},
  {id:'winter', name:'Winter Town', seed:777,
   th:{ga:[236, 241, 246], gb:[212, 222, 232], dirt:[150, 146, 136], road:[146, 144, 142], relief:110, patch:.35, micro:4,
       tufts:['#7d7254', '#958a68', '#6a6248'], rock:[96, 98, 104], crater:[110, 110, 112],
       con:[160, 164, 168], bag:['#c4b898', '#857a5c'], dust:'#e8eef4', deco:'winter', snow:true, roof:[150, 66, 50]},
   roads:[{pts:[[-20,600],[1820,600]], w:92}, {pts:[[900,-20],[900,1220]], w:72}],
   half:[{x:220,y:140,w:180,h:130,k:'h'}, {x:220,y:880,w:130,h:180,k:'h'}, {x:560,y:440,w:40,h:320,k:'c'},
         {x:700,y:140,w:200,h:40,k:'s'}, {x:840,y:480,w:120,h:40,k:'b'}, {x:1020,y:260,w:180,h:120,k:'h'},
         {x:380,y:520,w:40,h:160,k:'b'}]},
];

let seed = 1;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;   // deterministic, so every player sees the same map
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------- noise ----------
function makeNoise(sd, P = 256) {   // value noise, tileable with period P
  let s = sd; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  const val = new Float32Array(P * P); for (let i = 0; i < val.length; i++) val[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    const a = val[y0 * P + x0], b = val[y0 * P + x1], c = val[y1 * P + x0], d = val[y1 * P + x1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct) { let s = 0, a = .5, t = 0; for (let i = 0; i < oct; i++) { s += n(x, y) * a; t += a; a *= .5; x *= 2; y *= 2; } return s / t; }
function texture(size, fn) {
  const c = mk(size, size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  for (let y = 0, i = 0; y < size; y++) for (let X = 0; X < size; X++, i += 4) { const p = fn(X, y); d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p[3] ?? 255; }
  x.putImageData(img, 0, 0); return c;
}
// tileable material textures (concrete, wood, fabric) — made once per theme
function materials(th, sd) {
  const g = mk(1, 1).getContext('2d'), n = makeNoise(sd, 16), n2 = makeNoise(sd + 5, 64);
  const con = texture(256, (x, y) => {
    const v = fbm(n, x / 16, y / 16, 4) * .55 + n2(x / 4, y / 4) * .3 + Math.random() * .15;
    const k = .78 + v * .4; return [th.con[0] * k, th.con[1] * k, th.con[2] * k];
  });
  const wood = texture(256, (x, y) => {
    const gr = fbm(n, x / 64, y / 8, 3), ring = Math.sin(gr * 38 + y * .02) * .5 + .5;
    const k = .72 + gr * .3 + ring * .12 + Math.random() * .06; return [150 * k, 104 * k, 62 * k];
  });
  const fabric = texture(64, (x, y) => {
    const w = ((x + y) % 4 < 2 ? 1 : .9) * ((x - y + 64) % 4 < 2 ? 1 : .94), v = (.85 + Math.random() * .15) * w;
    return [255 * v, 255 * v, 255 * v];
  });
  return {con:g.createPattern(con, 'repeat'), wood:g.createPattern(wood, 'repeat'), fabric:g.createPattern(fabric, 'repeat')};
}

// ---------- terrain ----------
function paintTerrain(g, M) {
  const th = M.th, n1 = makeNoise(M.seed), n2 = makeNoise(M.seed + 11), n3 = makeNoise(M.seed + 23);
  const mask = (draw) => { const c = mk(WW, WH), x = c.getContext('2d'); x.lineCap = x.lineJoin = 'round'; x.strokeStyle = '#fff'; x.shadowColor = '#fff'; draw(x); return x.getImageData(0, 0, WW, WH).data; };
  const path = (x, R, off) => { x.beginPath(); R.pts.forEach(([px, py], i) => { const dx = R.pts[Math.min(i + 1, R.pts.length - 1)][0] - R.pts[Math.max(i - 1, 0)][0], dy = R.pts[Math.min(i + 1, R.pts.length - 1)][1] - R.pts[Math.max(i - 1, 0)][1], l = Math.hypot(dx, dy) || 1; const qx = px - dy / l * off, qy = py + dx / l * off; i ? x.lineTo(qx, qy) : x.moveTo(qx, qy); }); };
  const road = mask(x => { x.shadowBlur = 16; for (const R of M.roads) { path(x, R, 0); x.lineWidth = R.w; x.stroke(); } });
  const rut = mask(x => { x.shadowBlur = 5; for (const R of M.roads) for (const o of [-R.w * .28, R.w * .28]) { path(x, R, o); x.lineWidth = 8; x.stroke(); } });
  const det = new Float32Array(WW * WH);
  for (let y = 0, i = 0; y < WH; y++) for (let x = 0; x < WW; x++, i++) det[i] = fbm(n2, x / 30, y / 30, 4);
  const img = g.createImageData(WW, WH), d = img.data;
  for (let y = 0, i = 0; y < WH; y++) for (let x = 0; x < WW; x++, i++) {
    const macro = fbm(n1, x / 240, y / 240, 4);
    const patch = smooth(.56, .72, fbm(n3, x / 110, y / 110, 3)) * th.patch;
    const t = clamp(macro * 1.6 - .3, 0, 1);
    let r = th.ga[0] + (th.gb[0] - th.ga[0]) * t, gg = th.ga[1] + (th.gb[1] - th.ga[1]) * t, b = th.ga[2] + (th.gb[2] - th.ga[2]) * t;
    r += (th.dirt[0] - r) * patch; gg += (th.dirt[1] - gg) * patch; b += (th.dirt[2] - b) * patch;
    const ra = road[i * 4] / 255;
    if (ra > 0) { const k = .86 + det[i] * .3; r += (th.road[0] * k - r) * ra; gg += (th.road[1] * k - gg) * ra; b += (th.road[2] * k - b) * ra; }
    const ru = rut[i * 4] / 255 * ra;
    const xl = x > 0 ? det[i - 1] : det[i], xr = x < WW - 1 ? det[i + 1] : det[i], yu = y > 0 ? det[i - WW] : det[i], yd = y < WH - 1 ? det[i + WW] : det[i];
    const shade = 1 + ((xl - xr) + (yu - yd)) * th.relief * .01 - ru * .28;   // light from the top-left
    const m = (Math.random() - .5) * th.micro;
    d[i * 4] = r * shade + m; d[i * 4 + 1] = gg * shade + m; d[i * 4 + 2] = b * shade + m; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
const nearRoad = (M, x, y, pad = 8) => M.roads.some(r => r.pts.some((p, i) => i && distSeg(x, y, r.pts[i - 1][0], r.pts[i - 1][1], p[0], p[1]) < r.w / 2 + pad));
const nearSpawn = (x, y, d = 90) => SPAWNS.some(s => Math.hypot(s.x - x, s.y - y) < d);
function softShadow(g, blur, ox, oy, a, draw) {
  g.save(); g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = blur; g.shadowOffsetX = ox + 4000; g.shadowOffsetY = oy;
  g.translate(-4000, 0); g.fillStyle = '#000'; draw(); g.restore();
}
function rock(g, x, y, r, col, snow) {
  const n = 7 + (rnd() * 3 | 0), pts = Array.from({length:n}, (_, k) => { const a = k / n * 6.283, d = r * (.65 + rnd() * .35); return [x + Math.cos(a) * d, y + Math.sin(a) * d]; });
  const poly = () => { g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); };
  softShadow(g, r * .6, r * .3, r * .4, .5, () => { poly(); g.fill(); });
  poly(); const gr = g.createLinearGradient(x - r, y - r, x + r, y + r);
  gr.addColorStop(0, rgb(col.map(v => v * 1.35))); gr.addColorStop(.5, rgb(col)); gr.addColorStop(1, rgb(col.map(v => v * .55)));
  g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .8; g.stroke();
  if (snow) { g.save(); poly(); g.clip(); g.fillStyle = 'rgba(248,251,255,.95)'; g.beginPath(); g.ellipse(x - r * .25, y - r * .35, r * .8, r * .5, -.3, 0, 7); g.fill(); g.restore(); }
}
function crater(g, x, y, r, th) {
  const c = th.crater;
  for (let i = 0; i < 18; i++) { const a = rnd() * 6.28, d = r * (1.05 + rnd() * .7); g.fillStyle = rgb(c.map(v => v * (.7 + rnd() * .5)), .55); g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.5 + rnd() * 3, 1 + rnd() * 2, a, 0, 7); g.fill(); }
  let gr = g.createRadialGradient(x, y, r * .6, x, y, r * 1.3);
  gr.addColorStop(0, rgb(c, .0)); gr.addColorStop(.45, rgb(c.map(v => v * 1.25), .45)); gr.addColorStop(1, rgb(c, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.3, 0, 7); g.fill();
  gr = g.createLinearGradient(x - r, y - r, x + r, y + r);   // bowl: dark on the lit side, lighter on the far side
  gr.addColorStop(0, 'rgba(20,14,8,.65)'); gr.addColorStop(.6, 'rgba(30,22,12,.45)'); gr.addColorStop(1, 'rgba(255,240,210,.12)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * .85, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,245,220,.18)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * .9, Math.PI * .1, Math.PI * 1.1, false); g.stroke();
}
function bush(g, x, y, s, cols) {
  softShadow(g, 8, 5, 7, .45, () => { g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); });
  for (let i = 0; i < 16; i++) {
    const a = rnd() * 6.28, d = rnd() * s * .7, r = s * (.3 + rnd() * .35), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    const gr = g.createRadialGradient(cx - r * .4, cy - r * .4, 1, cx, cy, r);
    const c = cols[i % cols.length]; gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
}
function decorate(g, M) {
  const th = M.th;
  const tufts = (n, len) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * WW, y = rnd() * WH; if (nearRoad(M, x, y)) continue;
      const blades = 3 + (rnd() * 5 | 0);
      for (let j = 0; j < blades; j++) {
        const a = -Math.PI / 2 + (rnd() - .5) * 1.6, l = len * (.5 + rnd()), bx = x + (rnd() - .5) * 3;
        g.strokeStyle = th.tufts[(rnd() * th.tufts.length) | 0]; g.globalAlpha = .55 + rnd() * .4; g.lineWidth = .9;
        g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + Math.cos(a) * l * .5, y + Math.sin(a) * l * .5, bx + Math.cos(a + .25) * l, y + Math.sin(a + .25) * l); g.stroke();
      }
    }
    g.globalAlpha = 1;
  };
  if (th.deco === 'grass') {
    tufts(9000, 6);
    for (let i = 0; i < 160; i++) { const x = rnd() * WW, y = rnd() * WH; if (nearRoad(M, x, y)) continue; g.fillStyle = rnd() < .5 ? 'rgba(250,250,235,.8)' : 'rgba(240,210,80,.8)'; g.beginPath(); g.arc(x, y, .9 + rnd(), 0, 7); g.fill(); }
    const greens = [['#6f8a3c', '#2e4018'], ['#5d7832', '#243414'], ['#7d9446', '#33461c']];
    for (let i = 0; i < 26; i++) { const x = 60 + rnd() * (WW - 120), y = 60 + rnd() * (WH - 120); if (nearRoad(M, x, y, 30) || nearSpawn(x, y, 140)) continue; bush(g, x, y, 10 + rnd() * 10, greens); }
  }
  if (th.deco === 'desert') {
    for (let i = 0; i < 420; i++) {   // wind ripples
      const x = rnd() * WW, y = rnd() * WH, l = 40 + rnd() * 70, b = (rnd() - .5) * 12;
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(130,96,56,.16)'; g.beginPath(); g.moveTo(x, y + 2.5); g.quadraticCurveTo(x + l / 2, y + 2.5 + b, x + l, y + 2.5); g.stroke();
      g.strokeStyle = 'rgba(255,240,205,.22)'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + b, x + l, y); g.stroke();
    }
    for (let i = 0; i < 900; i++) { const x = rnd() * WW, y = rnd() * WH; g.fillStyle = rgb(th.rock.map(v => v * (.6 + rnd() * .6)), .7); g.beginPath(); g.arc(x, y, .6 + rnd() * 1.4, 0, 7); g.fill(); }
    for (let i = 0; i < 100; i++) {   // dry shrubs
      const x = rnd() * WW, y = rnd() * WH; if (nearRoad(M, x, y)) continue;
      softShadow(g, 5, 3, 4, .35, () => { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); });
      g.lineWidth = 1; g.strokeStyle = '#5e4a2c';
      for (let j = 0; j < 9; j++) { const a = rnd() * 6.28, l = 4 + rnd() * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      for (let j = 0; j < 6; j++) { g.fillStyle = rnd() < .5 ? '#7d7a44' : '#958c52'; g.beginPath(); g.arc(x + (rnd() - .5) * 12, y + (rnd() - .5) * 10, 1.2 + rnd() * 1.6, 0, 7); g.fill(); }
    }
    tufts(500, 5);
  }
  if (th.deco === 'winter') {
    for (let i = 0; i < 16; i++) {   // frozen puddles
      const x = rnd() * WW, y = rnd() * WH, rx = 16 + rnd() * 26, ry = 10 + rnd() * 14, a = rnd() * 3;
      const gr = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
      gr.addColorStop(0, 'rgba(196,222,240,.75)'); gr.addColorStop(1, 'rgba(150,186,214,.75)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = .8;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * rx * 1.6, y + (rnd() - .5) * ry * 1.6); g.stroke(); }
    }
    for (let i = 0; i < 12; i++) {   // footprints
      let x = rnd() * WW, y = rnd() * WH; const a = rnd() * 6.28;
      for (let j = 0; j < 16; j++) {
        x += Math.cos(a) * 13; y += Math.sin(a) * 13; const s = j % 2 ? 4 : -4;
        g.fillStyle = 'rgba(120,140,165,.32)'; g.beginPath(); g.ellipse(x - Math.sin(a) * s, y + Math.cos(a) * s, 3.4, 1.9, a, 0, 7); g.fill();
      }
    }
    tufts(700, 5);
    const pines = [['#4d6b52', '#1d2e22'], ['#5a7a5c', '#22352a']];
    for (let i = 0; i < 14; i++) { const x = 60 + rnd() * (WW - 120), y = 60 + rnd() * (WH - 120); if (nearRoad(M, x, y, 30) || nearSpawn(x, y, 140)) continue; bush(g, x, y, 9 + rnd() * 7, pines); g.fillStyle = 'rgba(250,252,255,.85)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x - 3 + (rnd() - .5) * 12, y - 3 + (rnd() - .5) * 12, 2 + rnd() * 3, 0, 7); g.fill(); } }
  }
  for (let i = 0; i < 9; i++) { const x = rnd() * WW, y = rnd() * WH; if (nearSpawn(x, y)) continue; crater(g, x, y, 20 + rnd() * 26, th); }
  for (let i = 0; i < 60; i++) { const x = rnd() * WW, y = rnd() * WH; if (nearRoad(M, x, y)) continue; rock(g, x, y, 3 + rnd() * 7, th.rock.map(v => v * (.85 + rnd() * .3)), th.snow); }
}

// ---------- structures ----------
const snowNoise = makeNoise(9090);
function snowCap(g, x, y, w, h, cover = .55) {   // uneven snow layer with soft blue-grey edges
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const c = mk(w, h), cx = c.getContext('2d'), img = cx.createImageData(w, h), d = img.data, ox = rnd() * 500, oy = rnd() * 500;
  const v = (px, py) => fbm(snowNoise, (px + ox) / 9, (py + oy) / 9, 4) + Math.min(px, py, w - 1 - px, h - 1 - py) / Math.min(w, h) * .5;
  const th = 1 - cover;
  for (let py = 0, i = 0; py < h; py++) for (let px = 0; px < w; px++, i += 4) {
    const s = v(px, py), a = smooth(th - .04, th + .04, s);
    if (a <= 0) continue;
    const edge = smooth(th + .02, th + .14, s), shade = 214 + edge * 38 + (v(px - 1, py - 1) - s) * 300;
    d[i] = shade - 10 + edge * 8; d[i + 1] = shade - 4 + edge * 4; d[i + 2] = Math.min(255, shade + 8); d[i + 3] = a * 255;
  }
  cx.putImageData(img, 0, 0);
  g.save(); g.shadowColor = 'rgba(60,80,110,.35)'; g.shadowBlur = 2; g.shadowOffsetX = 1; g.shadowOffsetY = 1.5; g.drawImage(c, x, y); g.restore();
}
function block(g, x, y, w, h, th, mat) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = mat.con; g.fillRect(x, y, w, h);
  let gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  for (let i = 0; i < 2 + rnd() * 3; i++) {   // water stains
    const sx = x + rnd() * w, sw = 2 + rnd() * 7; gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, `rgba(40,36,30,${.12 + rnd() * .14})`); gr.addColorStop(1, 'rgba(40,36,30,0)');
    g.fillStyle = gr; g.fillRect(sx, y, sw, h * (.3 + rnd() * .7));
  }
  for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x + rnd() * w, y + rnd() * h, .8 + rnd() * 1.5, 0, 7); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.38)'; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 2, y + 2, w - 4, 2); g.fillRect(x + 2, y + 2, 2, h - 4);
  g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 2, y + h - 4, w - 4, 2); g.fillRect(x + w - 4, y + 2, 2, h - 4);
  if (rnd() < .65) {
    let cx = x + 4 + rnd() * (w - 8), cy = y + 4 + rnd() * (h - 8); const pts = [[cx, cy]];
    for (let j = 0; j < 5; j++) { cx = clamp(cx + (rnd() - .5) * 14, x + 3, x + w - 3); cy = clamp(cy + (rnd() - .5) * 14, y + 3, y + h - 3); pts.push([cx, cy]); }
    for (const [col, o] of [['rgba(255,255,255,.22)', .8], ['rgba(25,22,18,.6)', 0]]) { g.strokeStyle = col; g.lineWidth = .9; g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px + o, py + o) : g.moveTo(px + o, py + o)); g.stroke(); }
  }
  if (w > 18 && h > 18) for (const [bx, by] of [[x + w * .3, y + h * .5], [x + w * .7, y + h * .5]]) {   // lifting points
    const gr2 = g.createRadialGradient(bx - .8, by - .8, .5, bx, by, 3); gr2.addColorStop(0, 'rgba(0,0,0,.6)'); gr2.addColorStop(1, 'rgba(0,0,0,.05)');
    g.fillStyle = gr2; g.beginPath(); g.arc(bx, by, 3, 0, 7); g.fill();
  }
  if (th.snow) snowCap(g, x, y, w, h, .5);
}
function concrete(g, w, th, mat, segLen = 60) {
  const horiz = w.w >= w.h, len = horiz ? w.w : w.h, n = Math.max(1, Math.round(len / segLen)), seg = len / n;
  for (let i = 0; i < n; i++) {
    const x = horiz ? w.x + i * seg : w.x, y = horiz ? w.y : w.y + i * seg;
    block(g, x + 1, y + 1, (horiz ? seg : w.w) - 2, (horiz ? w.h : seg) - 2, th, mat);
  }
}
function hazard(g, bx, by, bw, bh) {
  g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip(); g.globalAlpha = .8;
  g.fillStyle = '#c9971f'; g.fillRect(bx, by, bw, bh);
  g.strokeStyle = '#1e1e1e'; g.lineWidth = 7;
  for (let d = -bh; d < bw + bh; d += 20) { g.beginPath(); g.moveTo(bx + d, by + bh); g.lineTo(bx + d + bh, by); g.stroke(); }
  g.globalAlpha = 1;
  for (let i = 0; i < (bw + bh) / 3; i++) { g.fillStyle = `rgba(150,145,135,${.3 + rnd() * .4})`; g.fillRect(bx + rnd() * bw, by + rnd() * bh, 1 + rnd() * 3, 1 + rnd() * 2); }
  g.restore();
}
function border(g, w, th, mat) {
  concrete(g, w, th, mat, 80);
  const t = 7;
  if (w.e === 'b') hazard(g, w.x + 30, w.y + w.h - t, w.w - 60, t);
  if (w.e === 't') hazard(g, w.x + 30, w.y, w.w - 60, t);
  if (w.e === 'r') hazard(g, w.x + w.w - t, w.y + 30, t, w.h - 60);
  if (w.e === 'l') hazard(g, w.x, w.y + 30, t, w.h - 60);
}
function house(g, w, th, mat) {
  const horiz = w.w >= w.h, rc = th.roof || [140, 62, 46];
  g.fillStyle = '#2a211c'; g.fillRect(w.x, w.y, w.w, w.h);
  const halves = horiz
    ? [[w.x + 3, w.y + 3, w.w - 6, w.h / 2 - 3, 1.12], [w.x + 3, w.y + w.h / 2, w.w - 6, w.h / 2 - 3, .78]]
    : [[w.x + 3, w.y + 3, w.w / 2 - 3, w.h - 6, 1.12], [w.x + w.w / 2, w.y + 3, w.w / 2 - 3, w.h - 6, .78]];
  for (const [x, y, ww, hh, light] of halves) {
    g.save(); g.beginPath(); g.rect(x, y, ww, hh); g.clip();
    const tw = 11, tl = 8, rows = Math.ceil((horiz ? hh : ww) / tl), cols = Math.ceil((horiz ? ww : hh) / tw) + 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = light * (.85 + rnd() * .3), off = (r % 2) * tw / 2;
      const tx = horiz ? x + c * tw - off : x + r * tl, ty = horiz ? y + r * tl : y + c * tw - off;
      const tW = horiz ? tw - 1 : tl - 1, tH = horiz ? tl - 1 : tw - 1;
      g.fillStyle = rgb(rc.map(v => v * k)); g.fillRect(tx, ty, tW, tH);
      g.fillStyle = 'rgba(0,0,0,.28)'; if (horiz) g.fillRect(tx, ty + tH - 1.5, tW, 1.5); else g.fillRect(tx + tW - 1.5, ty, 1.5, tH);
      g.fillStyle = 'rgba(255,255,255,.08)'; if (horiz) g.fillRect(tx, ty, tW, 1); else g.fillRect(tx, ty, 1, tH);
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(60,70,30,${.12 + rnd() * .1})`; g.beginPath(); g.arc(x + rnd() * ww, y + rnd() * hh, 4 + rnd() * 9, 0, 7); g.fill(); }
    g.restore();
  }
  g.fillStyle = rgb(rc.map(v => v * .6));
  if (horiz) g.fillRect(w.x + 3, w.y + w.h / 2 - 3, w.w - 6, 6); else g.fillRect(w.x + w.w / 2 - 3, w.y + 3, 6, w.h - 6);
  g.fillStyle = 'rgba(255,255,255,.22)';
  if (horiz) g.fillRect(w.x + 3, w.y + w.h / 2 - 3, w.w - 6, 1.5); else g.fillRect(w.x + w.w / 2 - 3, w.y + 3, 1.5, w.h - 6);
  const cx = horiz ? w.x + w.w * .72 : w.x + w.w * .22, cy = horiz ? w.y + w.h * .18 : w.y + w.h * .72;
  softShadow(g, 6, 7, 9, .5, () => g.fillRect(cx, cy, 16, 16));
  g.fillStyle = mat.con; g.fillRect(cx, cy, 16, 16);
  g.fillStyle = 'rgba(160,70,50,.35)'; g.fillRect(cx, cy, 16, 16);
  g.fillStyle = '#141010'; g.fillRect(cx + 3, cy + 3, 10, 10);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(cx, cy, 16, 1.5); g.fillRect(cx, cy, 1.5, 16);
  if (th.snow) snowCap(g, w.x + 2, w.y + 2, w.w - 4, w.h - 4, .62);
}
function bag(g, x, y, w, h, th, mat) {
  const r = Math.min(w, h) / 2.2;
  rr(g, x, y, w, h, r);
  const gr = g.createRadialGradient(x + w * .35, y + h * .3, 1, x + w / 2, y + h / 2, Math.max(w, h) * .7);
  gr.addColorStop(0, th.bag[0]); gr.addColorStop(1, th.bag[1]);
  g.fillStyle = gr; g.fill();
  g.save(); rr(g, x, y, w, h, r); g.clip(); g.globalAlpha = .28; g.globalCompositeOperation = 'multiply'; g.fillStyle = mat.fabric; g.fillRect(x, y, w, h); g.restore();
  g.strokeStyle = 'rgba(50,38,20,.65)'; g.lineWidth = 1; rr(g, x, y, w, h, r); g.stroke();
  g.strokeStyle = 'rgba(80,62,36,.45)'; g.lineWidth = .8;
  for (let i = 0; i < 2; i++) { g.beginPath(); if (w > h) { const px = x + w * (.25 + rnd() * .5); g.moveTo(px, y + 2); g.quadraticCurveTo(px + 3, y + h / 2, px - 1, y + h - 2); } else { const py = y + h * (.25 + rnd() * .5); g.moveTo(x + 2, py); g.quadraticCurveTo(x + w / 2, py + 3, x + w - 2, py - 1); } g.stroke(); }
  g.fillStyle = 'rgba(60,46,26,.5)'; if (w > h) g.fillRect(x + w - 4, y + 2, 1.5, h - 4); else g.fillRect(x + 2, y + h - 4, w - 4, 1.5);
}
function sandChunk(g, x0, y0, w, h, horiz, th, mat) {
  g.fillStyle = '#3a2f1e'; g.fillRect(x0, y0, w, h);
  const L = horiz ? w : h, T = horiz ? h : w, bl = L / Math.max(1, Math.round(L / 26)), bt = T / 3;
  for (let r = 0; r < 3; r++) {
    const off = r % 2 ? bl / 2 : 0;
    for (let s = -off; s < L; s += bl) {
      const a = Math.max(0, s), b = Math.min(L, s + bl); if (b - a < 7) continue;
      const [x, y, ww, hh] = horiz ? [x0 + a, y0 + r * bt, b - a, bt] : [x0 + r * bt, y0 + a, bt, b - a];
      bag(g, x + .5, y + .5, ww - 1, hh - 1, th, mat);
    }
  }
}
function crate(g, x, y, w, h, mat) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = mat.wood; g.fillRect(x, y, w, h);
  const n = 4;
  for (let i = 0; i < n; i++) { g.fillStyle = rnd() < .5 ? `rgba(0,0,0,${rnd() * .14})` : `rgba(255,230,190,${rnd() * .1})`; g.fillRect(x, y + i * h / n, w, h / n); }
  g.fillStyle = 'rgba(25,14,6,.6)'; for (let i = 1; i < n; i++) g.fillRect(x, y + i * h / n - .6, w, 1.3);
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(Math.atan2(h, w)); const L = Math.hypot(w, h);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-L / 2, 1, L, 7);
  g.fillStyle = mat.wood; g.fillRect(-L / 2, -3.5, L, 7); g.fillStyle = 'rgba(70,40,15,.25)'; g.fillRect(-L / 2, -3.5, L, 7);
  g.fillStyle = 'rgba(255,230,190,.2)'; g.fillRect(-L / 2, -3.5, L, 1); g.restore();
  g.fillStyle = 'rgba(55,32,12,.4)'; g.fillRect(x, y, w, 5); g.fillRect(x, y + h - 5, w, 5); g.fillRect(x, y, 5, h); g.fillRect(x + w - 5, y, 5, h);
  g.fillStyle = 'rgba(230,225,210,.28)'; g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.fillText(['7.62', '105', 'AMMO', 'MK2'][rnd() * 4 | 0], x + w / 2, y + h * .32);
  g.restore();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {   // steel corner brackets
    g.fillStyle = '#4e5357'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 9 * sx, cy); g.lineTo(cx + 9 * sx, cy + 3 * sy); g.lineTo(cx + 3 * sx, cy + 3 * sy); g.lineTo(cx + 3 * sx, cy + 9 * sy); g.lineTo(cx, cy + 9 * sy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(cx + (sx > 0 ? 0 : -9), cy + (sy > 0 ? 0 : -1), 9, 1);
    g.fillStyle = '#2a2d30'; g.beginPath(); g.arc(cx + 5.5 * sx, cy + 1.6 * sy, .9, 0, 7); g.arc(cx + 1.6 * sx, cy + 5.5 * sy, .9, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(255,235,200,.25)'; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + h - 1.5, w, 1.5); g.fillRect(x + w - 1.5, y, 1.5, h);
}
function blockSprite(t, th, mat) {
  const P = 24, c = mk(t.w + P * 2, t.h + P * 2), x = c.getContext('2d');
  softShadow(x, 16, 9, 11, .55, () => x.fillRect(P, P, t.w, t.h));
  softShadow(x, 4, 2, 3, .5, () => x.fillRect(P, P, t.w, t.h));
  if (t.k === 'b') crate(x, P + 1, P + 1, t.w - 2, t.h - 2, mat); else sandChunk(x, P, P, t.w, t.h, t.horiz, th, mat);
  if (th.snow) snowCap(x, P, P, t.w, t.h, .5);
  return c;
}

const mapCache = {};
function buildMap(i) {
  if (mapCache[i]) return mapCache[i];
  const M = MAPS[i], th = M.th; seed = M.seed;
  const mat = materials(th, M.seed);
  const all = [...M.half, ...M.half.map(w => ({...w, x:WW - w.x - w.w, y:WH - w.y - w.h}))];
  const walls = [
    {x:0, y:0, w:WW, h:30, k:'border', e:'b'}, {x:0, y:WH - 30, w:WW, h:30, k:'border', e:'t'},
    {x:0, y:0, w:30, h:WH, k:'border', e:'r'}, {x:WW - 30, y:0, w:30, h:WH, k:'border', e:'l'},
    ...all.filter(w => w.k === 'c' || w.k === 'h'),
  ];
  const tmpl = [];
  for (const w of all) {
    if (w.k === 'b') for (let x = w.x; x < w.x + w.w - 1; x += 40) for (let y = w.y; y < w.y + w.h - 1; y += 40)
      tmpl.push({x, y, w:40, h:40, k:'b', max:2});
    if (w.k === 's') {
      const horiz = w.w >= w.h, L = horiz ? w.w : w.h, n = Math.max(1, Math.round(L / 40)), seg = L / n;
      for (let j = 0; j < n; j++) tmpl.push(horiz ? {x:w.x + j * seg, y:w.y, w:seg, h:w.h, k:'s', max:4, horiz}
                                                  : {x:w.x, y:w.y + j * seg, w:w.w, h:seg, k:'s', max:4, horiz});
    }
  }
  const ground = mk(WW, WH), g = ground.getContext('2d');
  paintTerrain(g, M);
  decorate(g, M);
  ['79,195,247', '255,112,67'].forEach((col, k) => {   // painted spawn markings
    const s = SPAWNS[k];
    g.strokeStyle = `rgba(${col},.35)`; g.lineWidth = 3; g.setLineDash([10, 7]); g.beginPath(); g.arc(s.x, s.y, 46, 0, 7); g.stroke(); g.setLineDash([]);
  });
  for (const w of walls) {   // soft shadows + contact shadows (light from the top-left)
    softShadow(g, 20, 10, 13, .55, () => g.fillRect(w.x, w.y, w.w, w.h));
    softShadow(g, 5, 2, 3, .55, () => g.fillRect(w.x, w.y, w.w, w.h));
  }
  for (const w of walls) w.k === 'border' ? border(g, w, th, mat) : w.k === 'h' ? house(g, w, th, mat) : concrete(g, w, th, mat);
  for (const t of tmpl) { t.spr = blockSprite(t, th, mat); t.seed = 1 + (rnd() * 1e6 | 0); }
  return mapCache[i] = {ground, walls, tmpl, th, M};
}
