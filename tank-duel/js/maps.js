// ============ MAPS: definitions + pre-rendered ground ============
const WW = 1800, WH = 1200;
const SPAWNS = [{x:100, y:WH / 2, a:0}, {x:WW - 100, y:WH / 2, a:Math.PI}];

// k: c = concrete (solid), h = house (solid), s = sandbags (4 hits), b = crates (2 hits)
// Every map is mirrored through the centre, so both sides are identical.
const MAPS = [
  {id:'grass', name:'Grasslands', seed:1337,
   th:{base:'#56613a', blobs:['92,104,60','68,78,42'], dirt:'118,96,62', road:'#8a7451', roadHi:'175,150,108', roadEdge:'45,36,22', rut:'70,54,32',
       tufts:['rgba(38,50,22,.7)','rgba(118,136,74,.6)'], rockHue:'40,6%', rockL:38, speck:'255,255,230', crater:'150,128,92',
       con:['#9c9ea0','#686b6f'], bag:['#d8c597','#957f54'], deco:'grass'},
   roads:[{pts:[[-20,600],[300,572],[600,598],[900,600],[1200,602],[1500,628],[1820,600]], w:72, h:true},
          {pts:[[900,-20],[878,300],[900,600],[922,900],[900,1220]], w:62, h:false}],
   half:[{x:260,y:180,w:40,h:240,k:'c'}, {x:260,y:780,w:240,h:40,k:'c'}, {x:560,y:420,w:40,h:360,k:'c'},
         {x:700,y:140,w:320,h:40,k:'s'}, {x:860,y:520,w:80,h:40,k:'b'}, {x:480,y:960,w:40,h:160,k:'s'},
         {x:1100,y:300,w:40,h:160,k:'b'}]},
  {id:'desert', name:'Desert Outpost', seed:4242,
   th:{base:'#c8a46a', blobs:['216,186,130','178,142,90'], dirt:'160,118,70', road:'#a5845a', roadHi:'220,196,150', roadEdge:'110,80,45', rut:'125,92,55',
       tufts:['rgba(110,96,48,.55)','rgba(140,120,60,.5)'], rockHue:'28,18%', rockL:42, speck:'255,240,210', crater:'230,205,160',
       con:['#d2bd94','#9c8660'], bag:['#e6d2a2','#a88d5c'], deco:'desert'},
   roads:[{pts:[[-20,300],[400,330],[900,600],[1400,870],[1820,900]], w:84, h:true}],
   half:[{x:240,y:220,w:200,h:40,k:'c'}, {x:240,y:260,w:40,h:160,k:'c'}, {x:520,y:480,w:40,h:240,k:'s'},
         {x:700,y:200,w:40,h:120,k:'b'}, {x:380,y:820,w:240,h:40,k:'s'}, {x:640,y:700,w:120,h:40,k:'b'},
         {x:820,y:420,w:160,h:40,k:'c'}, {x:1060,y:120,w:40,h:160,k:'s'}, {x:1250,y:240,w:80,h:80,k:'b'}]},
  {id:'winter', name:'Winter Town', seed:777,
   th:{base:'#dde5ec', blobs:['244,247,250','196,207,218'], dirt:'170,178,188', road:'#8f949a', roadHi:'200,205,212', roadEdge:'120,128,138', rut:'95,100,108',
       tufts:['rgba(120,110,80,.55)','rgba(150,140,100,.45)'], rockHue:'210,8%', rockL:30, speck:'255,255,255', crater:'150,158,168',
       con:['#aeb3b9','#767b81'], bag:['#cfc3a5','#8d8163'], deco:'winter', snow:true, roof:['#9a4234','#642519']},
   roads:[{pts:[[-20,600],[1820,600]], w:92, h:true}, {pts:[[900,-20],[900,1220]], w:72, h:false}],
   half:[{x:220,y:140,w:180,h:130,k:'h'}, {x:220,y:880,w:130,h:180,k:'h'}, {x:560,y:440,w:40,h:320,k:'c'},
         {x:700,y:140,w:200,h:40,k:'s'}, {x:840,y:480,w:120,h:40,k:'b'}, {x:1020,y:260,w:180,h:120,k:'h'},
         {x:380,y:520,w:40,h:160,k:'b'}]},
];

let seed = 1;
const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;   // deterministic, so every player sees the same map
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function blob(g, x, y, r, rgb, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function nearRoad(M, x, y, pad = 8) {
  return M.roads.some(r => r.pts.some((p, i) => i && distSeg(x, y, r.pts[i - 1][0], r.pts[i - 1][1], p[0], p[1]) < r.w / 2 + pad));
}
function road(g, th, R) {
  const path = off => { g.beginPath(); R.pts.forEach(([x, y], i) => { const px = R.h ? x : x + off, py = R.h ? y + off : y; i ? g.lineTo(px, py) : g.moveTo(px, py); }); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  path(0); g.strokeStyle = `rgba(${th.roadEdge},.35)`; g.lineWidth = R.w + 18; g.stroke();
  path(0); g.strokeStyle = th.road; g.lineWidth = R.w; g.stroke();
  path(0); g.strokeStyle = `rgba(${th.roadHi},.35)`; g.lineWidth = R.w * .45; g.stroke();
  for (const o of [-R.w * .28, R.w * .28]) { path(o); g.strokeStyle = `rgba(${th.rut},.5)`; g.lineWidth = 6; g.stroke(); }
}
function snowCap(g, x, y, w, h, n = 8, maxR = 18) {
  g.save(); rr(g, x + 2, y + 2, w - 4, h - 4, 4); g.clip();
  for (let i = 0; i < n; i++) {
    const cx = x + rnd() * w, cy = y + rnd() * h, r = 4 + rnd() * Math.min(maxR, Math.max(w, h) / 3);
    g.fillStyle = 'rgba(160,178,196,.5)'; g.beginPath(); g.arc(cx + 1.5, cy + 2, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(247,250,253,.96)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
  g.restore();
}
function block(g, x, y, w, h, th) {
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, th.con[0]); gr.addColorStop(1, th.con[1]);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, h);
  g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x, y + h - 3, w, 3); g.fillRect(x + w - 3, y, 3, h);
  for (let i = 0; i < w * h / 25; i++) {
    g.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.1)';
    g.fillRect(x + rnd() * w, y + rnd() * h, 1.5, 1.5);
  }
  if (rnd() < .6) {
    g.strokeStyle = 'rgba(30,30,30,.5)'; g.lineWidth = 1; g.beginPath();
    let cx = x + rnd() * w, cy = y + rnd() * h; g.moveTo(cx, cy);
    for (let j = 0; j < 4; j++) {
      cx = clamp(cx + (rnd() - .5) * 16, x + 3, x + w - 3); cy = clamp(cy + (rnd() - .5) * 16, y + 3, y + h - 3); g.lineTo(cx, cy);
    }
    g.stroke();
  }
  if (w > 16 && h > 16) {
    g.fillStyle = 'rgba(35,35,35,.65)';
    for (const [bx, by] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) { g.beginPath(); g.arc(bx, by, 1.7, 0, 7); g.fill(); }
  }
  if (th.snow) snowCap(g, x, y, w, h, 3);
}
function concrete(g, w, th, segLen = 60) {
  const horiz = w.w >= w.h, len = horiz ? w.w : w.h, n = Math.max(1, Math.round(len / segLen)), seg = len / n;
  for (let i = 0; i < n; i++) {
    const x = horiz ? w.x + i * seg : w.x, y = horiz ? w.y : w.y + i * seg;
    block(g, x + 1, y + 1, (horiz ? seg : w.w) - 2, (horiz ? w.h : seg) - 2, th);
  }
}
function hazard(g, bx, by, bw, bh) {
  g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
  g.fillStyle = '#d6a222'; g.fillRect(bx, by, bw, bh);
  g.strokeStyle = '#1c1c1c'; g.lineWidth = 7;
  for (let d = -bh; d < bw + bh; d += 20) { g.beginPath(); g.moveTo(bx + d, by + bh); g.lineTo(bx + d + bh, by); g.stroke(); }
  g.restore();
}
function border(g, w, th) {
  concrete(g, w, th, 80);
  const t = 7;
  if (w.e === 'b') hazard(g, w.x + 30, w.y + w.h - t, w.w - 60, t);
  if (w.e === 't') hazard(g, w.x + 30, w.y, w.w - 60, t);
  if (w.e === 'r') hazard(g, w.x + w.w - t, w.y + 30, t, w.h - 60);
  if (w.e === 'l') hazard(g, w.x, w.y + 30, t, w.h - 60);
}
function house(g, w, th) {
  const horiz = w.w >= w.h, [c1, c2] = th.roof || ['#8e3b2f', '#5f241b'];
  g.fillStyle = '#2e2420'; g.fillRect(w.x, w.y, w.w, w.h);
  const halves = horiz
    ? [[w.x + 3, w.y + 3, w.w - 6, w.h / 2 - 3, c1], [w.x + 3, w.y + w.h / 2, w.w - 6, w.h / 2 - 3, c2]]
    : [[w.x + 3, w.y + 3, w.w / 2 - 3, w.h - 6, c1], [w.x + w.w / 2, w.y + 3, w.w / 2 - 3, w.h - 6, c2]];
  for (const [x, y, ww, hh, col] of halves) {
    g.fillStyle = col; g.fillRect(x, y, ww, hh);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1;
    if (horiz) for (let yy = y + 7; yy < y + hh; yy += 7) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + ww, yy); g.stroke();
      for (let xx = x + ((yy / 7 | 0) % 2) * 6; xx < x + ww; xx += 12) { g.beginPath(); g.moveTo(xx, yy - 7); g.lineTo(xx, yy); g.stroke(); } }
    else for (let xx = x + 7; xx < x + ww; xx += 7) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + hh); g.stroke();
      for (let yy = y + ((xx / 7 | 0) % 2) * 6; yy < y + hh; yy += 12) { g.beginPath(); g.moveTo(xx - 7, yy); g.lineTo(xx, yy); g.stroke(); } }
  }
  g.fillStyle = 'rgba(255,255,255,.25)';
  if (horiz) g.fillRect(w.x + 3, w.y + w.h / 2 - 2, w.w - 6, 3); else g.fillRect(w.x + w.w / 2 - 2, w.y + 3, 3, w.h - 6);
  const cx = horiz ? w.x + w.w * .72 : w.x + w.w * .25, cy = horiz ? w.y + w.h * .22 : w.y + w.h * .72;
  g.fillStyle = '#4b3a33'; g.fillRect(cx, cy, 16, 16); g.fillStyle = '#1a1310'; g.fillRect(cx + 3, cy + 3, 10, 10);
  if (th.snow) { snowCap(g, w.x, w.y, w.w, w.h, 34, 10); snowCap(g, w.x, w.y + (horiz ? w.h / 2 - 6 : 0), horiz ? w.w : w.w, horiz ? 12 : w.h, 16, 7); }
}
function bag(g, x, y, w, h, th) {
  rr(g, x, y, w, h, Math.min(w, h) / 2.3);
  const gr = g.createLinearGradient(x, y, x + w * .4, y + h);
  gr.addColorStop(0, th.bag[0]); gr.addColorStop(1, th.bag[1]);
  g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(60,46,26,.75)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(95,76,46,.6)'; g.beginPath();
  if (w > h) { g.moveTo(x + w * .82, y + 2); g.lineTo(x + w * .82, y + h - 2); } else { g.moveTo(x + 2, y + h * .82); g.lineTo(x + w - 2, y + h * .82); }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x + w * .35, y + h * .32, w * .2, h * .14, 0, 0, 7); g.fill();
}
function sandChunk(g, x0, y0, w, h, horiz, th) {
  g.fillStyle = '#433826'; g.fillRect(x0, y0, w, h);
  const L = horiz ? w : h, T = horiz ? h : w, bl = L / Math.max(1, Math.round(L / 26)), bt = T / 3;
  for (let r = 0; r < 3; r++) {
    const off = r % 2 ? bl / 2 : 0;
    for (let s = -off; s < L; s += bl) {
      const a = Math.max(0, s), b = Math.min(L, s + bl); if (b - a < 7) continue;
      const [x, y, ww, hh] = horiz ? [x0 + a, y0 + r * bt, b - a, bt] : [x0 + r * bt, y0 + a, bt, b - a];
      bag(g, x + .5, y + .5, ww - 1, hh - 1, th);
    }
  }
}
function crate(g, x, y, w, h) {
  g.fillStyle = '#a8743d'; g.fillRect(x, y, w, h);
  for (let i = 0; i < 30; i++) { g.fillStyle = rnd() < .5 ? 'rgba(90,55,20,.25)' : 'rgba(255,220,170,.12)'; g.fillRect(x + rnd() * w, y + rnd() * h, rnd() * 8, 1); }
  g.strokeStyle = 'rgba(80,48,18,.5)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x, y + h * i / 4); g.lineTo(x + w, y + h * i / 4); g.stroke(); }
  g.strokeStyle = '#6c431d'; g.lineWidth = 5; g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + w - 4, y + h - 4); g.stroke();
  g.strokeStyle = 'rgba(255,225,170,.3)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x + 1, y + h - 1); g.lineTo(x + 1, y + 1); g.lineTo(x + w - 1, y + 1); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  g.fillStyle = '#2e2214';
  for (const [nx, ny] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) { g.beginPath(); g.arc(nx, ny, 1.3, 0, 7); g.fill(); }
}
function blockSprite(t, th) {
  const P = 24, c = mk(t.w + P * 2, t.h + P * 2), x = c.getContext('2d');
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 14; x.shadowOffsetX = 7; x.shadowOffsetY = 9;
  x.fillStyle = '#000'; x.fillRect(P, P, t.w, t.h); x.restore();
  if (t.k === 'b') crate(x, P + 1, P + 1, t.w - 2, t.h - 2); else sandChunk(x, P, P, t.w, t.h, t.horiz, th);
  if (th.snow) snowCap(x, P, P, t.w, t.h, 4);
  return c;
}

function decorate(g, M) {
  const th = M.th;
  const tufts = (n, cols) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * WW, y = rnd() * WH; if (nearRoad(M, x, y)) continue;
      g.strokeStyle = cols[rnd() < .5 ? 0 : 1]; g.lineWidth = 1.2; g.beginPath();
      for (let j = 0; j < 4; j++) { const a = -Math.PI / 2 + (rnd() - .5) * 1.5, l = 4 + rnd() * 6; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      g.stroke();
    }
  };
  if (th.deco === 'grass') tufts(1500, th.tufts);
  if (th.deco === 'desert') {
    for (let i = 0; i < 320; i++) {          // wind ripples in the sand
      const x = rnd() * WW, y = rnd() * WH, l = 30 + rnd() * 50, b = (rnd() - .5) * 10;
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(150,112,64,.22)'; g.beginPath(); g.moveTo(x, y + 3); g.quadraticCurveTo(x + l / 2, y + 3 + b, x + l, y + 3); g.stroke();
      g.strokeStyle = 'rgba(255,242,210,.35)'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + b, x + l, y); g.stroke();
    }
    for (let i = 0; i < 120; i++) {          // dry shrubs
      const x = rnd() * WW, y = rnd() * WH; if (nearRoad(M, x, y)) continue;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + 3, y + 4, 9, 6, 0, 0, 7); g.fill();
      for (let j = 0; j < 7; j++) { g.fillStyle = rnd() < .5 ? '#6f6a3a' : '#8c8046'; g.beginPath(); g.arc(x + (rnd() - .5) * 12, y + (rnd() - .5) * 9, 2 + rnd() * 3, 0, 7); g.fill(); }
    }
    tufts(300, th.tufts);
  }
  if (th.deco === 'winter') {
    for (let i = 0; i < 70; i++) blob(g, rnd() * WW, rnd() * WH, 30 + rnd() * 110, '255,255,255', .65);
    for (let i = 0; i < 14; i++) {           // frozen puddles
      const x = rnd() * WW, y = rnd() * WH, rx = 16 + rnd() * 26, ry = 10 + rnd() * 14, a = rnd() * 3;
      g.fillStyle = 'rgba(170,210,240,.42)'; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x - rx * .4, y - ry * .2); g.lineTo(x + rx * .2, y - ry * .4); g.stroke();
    }
    for (let i = 0; i < 10; i++) {           // footprints
      let x = rnd() * WW, y = rnd() * WH; const a = rnd() * 6.28;
      for (let j = 0; j < 14; j++) {
        x += Math.cos(a) * 14; y += Math.sin(a) * 14; const s = j % 2 ? 4 : -4;
        g.fillStyle = 'rgba(140,155,175,.35)'; g.beginPath(); g.ellipse(x - Math.sin(a) * s, y + Math.cos(a) * s, 3.5, 2, a, 0, 7); g.fill();
      }
    }
    tufts(450, th.tufts);
  }
  for (let i = 0; i < 10; i++) {             // old craters
    const x = rnd() * WW, y = rnd() * WH, r = 22 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, r * .5, x, y, r * 1.35);
    gr.addColorStop(0, `rgba(${th.crater},0)`); gr.addColorStop(.6, `rgba(${th.crater},.5)`); gr.addColorStop(1, `rgba(${th.crater},0)`);
    g.fillStyle = gr; g.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    blob(g, x, y, r, '28,22,14', .55);
  }
  for (let i = 0; i < 70; i++) {             // rocks
    const x = rnd() * WW, y = rnd() * WH, r = 3 + rnd() * 7, n = 6 + (rnd() * 3 | 0);
    const pts = Array.from({length:n}, (_, k) => { const a = k / n * 6.283, d = r * (.7 + rnd() * .3); return [Math.cos(a) * d, Math.sin(a) * d]; });
    const poly = (ox, oy) => { g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(x + px + ox, y + py + oy) : g.moveTo(x + px + ox, y + py + oy)); g.closePath(); };
    poly(2, 3); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
    poly(0, 0); g.fillStyle = `hsl(${th.rockHue},${th.rockL + rnd() * 22}%)`; g.fill();
    g.fillStyle = th.snow ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .4, 0, 7); g.fill();
  }
}

const mapCache = {};
function buildMap(i) {
  if (mapCache[i]) return mapCache[i];
  const M = MAPS[i], th = M.th; seed = M.seed;
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
  g.fillStyle = th.base; g.fillRect(0, 0, WW, WH);
  for (let k = 0; k < 140; k++) blob(g, rnd() * WW, rnd() * WH, 60 + rnd() * 220, th.blobs[rnd() < .5 ? 0 : 1], .55);
  for (let k = 0; k < 45; k++) blob(g, rnd() * WW, rnd() * WH, 40 + rnd() * 120, th.dirt, .4);
  for (const R of M.roads) road(g, th, R);
  for (let k = 0; k < 45000; k++) {
    const v = rnd() < .5 ? '0,0,0' : th.speck;
    g.fillStyle = `rgba(${v},${.03 + rnd() * .06})`; g.fillRect(rnd() * WW, rnd() * WH, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  decorate(g, M);
  ['#4fc3f7', '#ff7043'].forEach((col, k) => {
    const s = SPAWNS[k];
    g.globalAlpha = .5; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(s.x, s.y, 42, 0, 7); g.stroke();
    g.setLineDash([8, 8]); g.lineWidth = 2; g.beginPath(); g.arc(s.x, s.y, 54, 0, 7); g.stroke(); g.setLineDash([]);
    g.globalAlpha = 1;
  });
  for (const w of walls) {
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 16; g.shadowOffsetX = 8; g.shadowOffsetY = 10;
    g.fillStyle = '#000'; g.fillRect(w.x, w.y, w.w, w.h); g.restore();
  }
  for (const w of walls) w.k === 'border' ? border(g, w, th) : w.k === 'h' ? house(g, w, th) : concrete(g, w, th);
  for (const t of tmpl) { t.spr = blockSprite(t, th); t.seed = 1 + (rnd() * 1e6 | 0); }
  return mapCache[i] = {ground, walls, tmpl, th, M};
}
