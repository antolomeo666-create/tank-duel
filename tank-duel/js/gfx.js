// ============ GRAPHICS: tank classes, sprites, particles, effects ============
const TS = 1.25;   // tank draw scale
const CLASSES = {
  scout:   {name:'Scout',      desc:'Fast and nimble, light shells',   hp:70,  speed:300, turn:4.3, reload:.7,  bspeed:560,  dmg:25, bounces:3, br:4, r:19,
            stats:[5, 2, 2, 5], g:{hl:18, hw:11, tr:9,  bl:23, bw:5,  taper:true}},
  striker: {name:'Striker',    desc:'The all-rounder',                 hp:100, speed:230, turn:3.4, reload:1.2, bspeed:540,  dmg:34, bounces:4, br:5, r:22,
            stats:[3, 3, 3, 3], g:{hl:21, hw:14, tr:11, bl:27, bw:7}},
  heavy:   {name:'Juggernaut', desc:'Thick armour, slow reload',       hp:150, speed:170, turn:2.6, reload:1.8, bspeed:470,  dmg:40, bounces:3, br:7, r:25,
            stats:[1, 5, 4, 1], g:{hl:23, hw:16, tr:13, bl:27, bw:10, skirt:true, fume:true, box:true}},
  sniper:  {name:'Lancer',     desc:'Rail shots, no ricochet',         hp:80,  speed:220, turn:3.2, reload:2.0, bspeed:1100, dmg:55, bounces:0, br:4, r:21,
            stats:[3, 2, 5, 1], g:{hl:20, hw:13, tr:10, bl:43, bw:5,  taper:true, collar:true}},
};
const CLASS_KEYS = Object.keys(CLASSES);
const PU_TYPES = {
  triple: {name:'TRIPLE SHOT', col:'#ffd54f', w:3},
  shield: {name:'SHIELD',      col:'#80deea', w:3},
  speed:  {name:'SPEED BOOST', col:'#69f0ae', w:3},
  bounce: {name:'+3 BOUNCES',  col:'#ce93d8', w:2},
  mine:   {name:'MINES x3',    col:'#ff8a80', w:2},
  repair: {name:'REPAIR',      col:'#aed581', w:2},
};
const PU_KEYS = Object.keys(PU_TYPES);
const PALS = [
  {base:'#3e6f99', light:'#7aacd6', dark:'#1d3a55', camo:'#24496a', stripe:'#c6ecff'},
  {base:'#b0602e', light:'#e39c66', dark:'#5a2a10', camo:'#783c16', stripe:'#ffe2c8'},
];
const WRECK = {base:'#2c2a28', light:'#4a4643', dark:'#141312', camo:'#1d1b1a', stripe:'#3a3633'};

// ---------- sprites (rendered once at 2x, then reused) ----------
const sprCache = {};
function hullSprite(G, p) {
  const hl = G.hl, hw = G.hw, CW = (hl + 12) * 2, CH = (hw + 10) * 2;
  const c = mk(CW * 2, CH * 2), x = c.getContext('2d'); x.scale(2, 2); x.translate(CW / 2, CH / 2);
  const shape = () => {
    if (G.taper) { x.beginPath(); x.moveTo(-hl, -hw + 4); x.quadraticCurveTo(-hl, -hw, -hl + 4, -hw); x.lineTo(hl - 7, -hw); x.lineTo(hl, -hw + 6);
      x.lineTo(hl, hw - 6); x.lineTo(hl - 7, hw); x.lineTo(-hl + 4, hw); x.quadraticCurveTo(-hl, hw, -hl, hw - 4); x.closePath(); }
    else rr(x, -hl, -hw, hl * 2, hw * 2, 5);
  };
  shape();
  const gr = x.createLinearGradient(0, -hw, 0, hw);
  gr.addColorStop(0, p.light); gr.addColorStop(.5, p.base); gr.addColorStop(1, p.dark);
  x.fillStyle = gr; x.fill();
  x.save(); x.clip(); x.globalAlpha = .35; x.fillStyle = p.camo;
  for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(-hl + rnd() * hl * 2, -hw + rnd() * hw * 2, 4 + rnd() * 7, 3 + rnd() * 4, rnd() * 3, 0, 7); x.fill(); }
  x.restore();
  shape(); x.lineWidth = 1.5; x.strokeStyle = p.dark; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.13)'; x.fillRect(hl - 8, -hw + 2, 7, hw * 2 - 4);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(hl - 8, -hw + 2); x.lineTo(hl - 8, hw - 2); x.moveTo(-hl + 13, -hw + 1); x.lineTo(-hl + 13, hw - 1); x.stroke();
  x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(-hl + 2, -hw + 5, 8, hw * 2 - 10);
  x.strokeStyle = 'rgba(255,255,255,.16)';
  for (let y = -hw + 7; y <= hw - 7; y += 3) { x.beginPath(); x.moveTo(-hl + 2, y); x.lineTo(-hl + 10, y); x.stroke(); }
  x.fillStyle = '#2a2a2a'; x.fillRect(-hl - 2, -hw + 2, 3, 4); x.fillRect(-hl - 2, hw - 6, 3, 4);
  x.fillStyle = 'rgba(0,0,0,.45)';
  for (let i = -hl + 3; i <= hl - 3; i += 6) for (const y of [-hw + 2, hw - 2]) { x.beginPath(); x.arc(i, y, 1.1, 0, 7); x.fill(); }
  x.fillStyle = '#ffe9a0'; x.fillRect(hl - 2, -hw + 3, 2, 4); x.fillRect(hl - 2, hw - 7, 2, 4);
  x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(-hl + 2, -hw + 1, hl * 2 - 4, 1.5);
  x.fillStyle = p.stripe; x.fillRect(-hl + 9, -hw + 1, 2, hw * 2 - 2);
  return {c, w:CW, h:CH};
}
function turretSprite(G, p) {
  const tr = G.tr, S = (tr + 9) * 2;
  const c = mk(S * 2, S * 2), x = c.getContext('2d'); x.scale(2, 2); x.translate(S / 2, S / 2);
  const rad = G.box ? tr * .35 : tr * .75;
  x.fillStyle = 'rgba(0,0,0,.35)'; rr(x, -tr, -tr + 2, tr * 2, tr * 2, rad); x.fill();
  rr(x, -tr - 2, -tr, tr * 2, tr * 2, rad);
  const gr = x.createRadialGradient(-tr * .6, -tr * .55, 2, -1, 0, tr * 1.6);
  gr.addColorStop(0, p.light); gr.addColorStop(.55, p.base); gr.addColorStop(1, p.dark);
  x.fillStyle = gr; x.fill(); x.strokeStyle = p.dark; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = p.dark; rr(x, tr - 3, -tr * .45, 5, tr * .9, 2); x.fill();
  x.beginPath(); x.arc(-tr * .38, -tr * .28, tr * .4, 0, 7); x.fillStyle = p.dark; x.fill();
  x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1; x.beginPath(); x.arc(-tr * .38, -tr * .28, tr * .28, Math.PI, 1.5 * Math.PI); x.stroke();
  x.fillStyle = '#a8dcff'; x.fillRect(tr * .25, -tr + 2, 3, 2); x.fillRect(tr * .25, tr - 4, 3, 2);
  x.fillStyle = p.base; rr(x, -tr - 6, -tr * .55, 5, tr * 1.1, 1.5); x.fill(); x.strokeStyle = p.dark; x.stroke();
  x.fillStyle = p.stripe; x.beginPath(); x.arc(-tr * .25, tr * .55, tr * .24, 0, 7); x.fill();
  return {c, w:S, h:S};
}
function tankSprites(ck, pal, key) {
  const k = ck + '|' + key;
  if (!sprCache[k]) { seed = 99 + key.length * 7 + ck.length; const G = CLASSES[ck].g; sprCache[k] = {hull:hullSprite(G, pal), turret:turretSprite(G, pal)}; }
  return sprCache[k];
}
const glows = {};
function glow(col) {
  if (!glows[col]) {
    const c = mk(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glows[col] = c;
  }
  return glows[col];
}

// ---------- particles & decals ----------
let particles = [];
const decal = mk(WW, WH), dc = decal.getContext('2d');   // tread marks, scorch marks (cleared each round)
function P(k, x, y, o) {
  if (particles.length > 800) return;
  const q = Object.assign({k, x, y, vx:0, vy:0, life:1, size:4, grow:0, drag:.92, rot:0, vr:0}, o);
  q.max = q.life; particles.push(q);
}
function spray(k, x, y, n, smin, smax, o = {}, ang = null, spread = Math.PI) {
  for (let i = 0; i < n; i++) {
    const a = ang === null ? Math.random() * 6.283 : ang + rand(-spread, spread), s = rand(smin, smax);
    const life = Array.isArray(o.life) ? rand(...o.life) : (o.life || 1), size = Array.isArray(o.size) ? rand(...o.size) : (o.size || 4);
    P(k, x, y, {...o, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life, size, vr:rand(-12, 12)});
  }
}
function updateParticles(dt) {
  for (const q of particles) {
    const d = Math.pow(q.drag, dt * 60);
    q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= d; q.vy *= d;
    q.life -= dt; q.size = Math.max(.1, q.size + q.grow * dt); q.rot += q.vr * dt * (Math.abs(q.vx) > 5 ? 1 : 0);
  }
  particles = particles.filter(q => q.life > 0);
}
function drawParticles(ctx, additive) {
  for (const q of particles) {
    const t = q.life / q.max;
    if (!additive) {
      if (q.k === 'smoke') { ctx.globalAlpha = t * .45; ctx.fillStyle = q.c || '#3c3c3c'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
      else if (q.k === 'dust') { ctx.globalAlpha = t * .45; ctx.fillStyle = q.c || '#a08a62'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
      else if (q.k === 'debris') { ctx.globalAlpha = Math.min(1, t * 3); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.c || '#1c1c1c'; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * .66); ctx.restore(); }
      else if (q.k === 'text') { ctx.globalAlpha = Math.min(1, t * 2.5); ctx.font = "18px 'Black Ops One', Impact, sans-serif"; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(q.txt, q.x + 2, q.y + 2); ctx.fillStyle = q.c; ctx.fillText(q.txt, q.x, q.y); }
    } else {
      if (q.k === 'fire') { ctx.globalAlpha = t; const s = q.size * 2.6; ctx.drawImage(glow(t > .5 ? '#ffd27a' : '#ff6a22'), q.x - s / 2, q.y - s / 2, s, s); }
      else if (q.k === 'boost') { ctx.globalAlpha = t * .8; const s = q.size * 2.4; ctx.drawImage(glow('#69f0ae'), q.x - s / 2, q.y - s / 2, s, s); }
      else if (q.k === 'spark') { ctx.globalAlpha = t; ctx.strokeStyle = q.c || '#ffe7a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * .025, q.y - q.vy * .025); ctx.stroke(); }
      else if (q.k === 'flash') { ctx.globalAlpha = t * .9; const s = q.size; ctx.drawImage(glow(q.c || '#fff1c4'), q.x - s / 2, q.y - s / 2, s, s); }
      else if (q.k === 'ring') { ctx.globalAlpha = t; ctx.strokeStyle = q.c; ctx.lineWidth = 3 * t + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.stroke(); }
    }
  }
  ctx.globalAlpha = 1;
}
function scorch(x, y, r) {
  const gr = dc.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(14,11,7,.8)'); gr.addColorStop(.6, 'rgba(20,16,10,.45)'); gr.addColorStop(1, 'rgba(20,16,10,0)');
  dc.fillStyle = gr; dc.fillRect(x - r, y - r, r * 2, r * 2);
  dc.strokeStyle = 'rgba(15,12,8,.45)'; dc.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283, l = rand(r * .6, r * 1.3); dc.beginPath(); dc.moveTo(x, y); dc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); dc.stroke(); }
}
function rubble(b) {
  for (let i = 0; i < 14; i++) {
    const x = b.x + Math.random() * b.w, y = b.y + Math.random() * b.h;
    dc.save(); dc.translate(x, y); dc.rotate(Math.random() * 3);
    if (b.k === 'b') { dc.fillStyle = Math.random() < .5 ? '#7a5128' : '#a8743d'; dc.fillRect(-6, -1.5, 12, 3); }
    else { dc.fillStyle = 'rgba(190,165,115,.8)'; dc.beginPath(); dc.ellipse(0, 0, 6, 4, 0, 0, 7); dc.fill(); }
    dc.restore();
  }
}
function treadMark(p) {
  const G = CLASSES[p.ck].g;
  dc.save(); dc.translate(p.x, p.y); dc.rotate(p.a); dc.scale(TS, TS); dc.fillStyle = 'rgba(32,26,14,.2)';
  dc.fillRect(-2, -G.hw - 6, 4, 8); dc.fillRect(-2, G.hw - 2, 4, 8); dc.restore();
}

// ---------- drawing ----------
function drawTank(ctx, p, t) {
  const C = CLASSES[p.ck], G = C.g, hl = G.hl, hw = G.hw;
  const spr = p.alive ? tankSprites(p.ck, p.pal, 'p' + p.idx) : tankSprites(p.ck, WRECK, 'wreck');
  ctx.save(); ctx.translate(p.x + 6, p.y + 8); ctx.rotate(p.a); ctx.scale(TS, TS);
  ctx.fillStyle = 'rgba(0,0,0,.38)'; rr(ctx, -hl - 4, -hw - 7, (hl + 4) * 2, (hw + 7) * 2, 8); ctx.fill(); ctx.restore();

  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(TS, TS);
  for (const [y0, v] of [[-hw - 7, p.tl], [hw - 2, p.tr]]) {      // animated treads, each side moves on its own
    ctx.fillStyle = p.alive ? '#16171a' : '#0d0d0d'; rr(ctx, -hl - 4, y0, (hl + 4) * 2, 9, 3.5); ctx.fill();
    ctx.fillStyle = p.alive ? '#35373c' : '#1c1c1c';
    const off = ((v % 6) + 6) % 6;
    for (let x = -hl - 4 + off; x < hl + 3; x += 6) ctx.fillRect(x, y0 + 1, 2.5, 7);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(-hl - 2, y0 + .5, hl * 2 + 4, 1.5);
    if (G.skirt) {
      ctx.fillStyle = p.alive ? p.pal.dark : '#1a1918'; ctx.fillRect(-hl + 1, y0 + 1, hl * 2 - 2, 7);
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
      for (let x = -hl + 1 + (hl * 2 - 2) / 4; x < hl - 1; x += (hl * 2 - 2) / 4) { ctx.beginPath(); ctx.moveTo(x, y0 + 1); ctx.lineTo(x, y0 + 8); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-hl + 1, y0 + 1, hl * 2 - 2, 1.5);
    }
  }
  ctx.drawImage(spr.hull.c, -spr.hull.w / 2, -spr.hull.h / 2, spr.hull.w, spr.hull.h);
  if (p.alive) {
    const aa = Math.PI + p.ant, ax = -hl + 8, ay = hw - 5, ex = ax + Math.cos(aa) * 22, ey = ay + Math.sin(aa) * 22;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, 7); ctx.fill();
  }
  if (p.flash > 0 && p.alive) { ctx.globalAlpha = p.flash / .15 * .7; ctx.fillStyle = '#fff'; rr(ctx, -hl, -hw, hl * 2, hw * 2, 5); ctx.fill(); ctx.globalAlpha = 1; }

  ctx.rotate(p.ta - p.a);                       // turret can point away from the hull
  const rc = p.recoil * 7, b0 = G.tr * .4 - rc, bl = G.bl - rc;
  ctx.fillStyle = p.alive ? '#2b3036' : '#1a1a1a'; ctx.fillRect(b0, -G.bw / 2, bl - b0, G.bw);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(b0, -G.bw / 2, bl - b0, G.bw * .3);
  if (G.fume) { ctx.fillStyle = p.alive ? '#23272c' : '#151515'; ctx.beginPath(); ctx.ellipse(G.bl * .62 - rc, 0, 4.5, G.bw / 2 + 1.5, 0, 0, 7); ctx.fill(); }
  if (G.collar) { ctx.fillStyle = '#1b1f23'; ctx.fillRect(G.bl * .55 - rc, -G.bw / 2 - 1, 3, G.bw + 2); }
  ctx.fillStyle = p.alive ? '#1b1f23' : '#111'; ctx.fillRect(bl - 5, -G.bw / 2 - 1.5, 6, G.bw + 3);
  if (p.muzzle > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(p.muzzle / .07, 0, 1);
    ctx.drawImage(glow('#ffc65a'), bl - 22, -28, 56, 56);
    ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.moveTo(bl + 1, -G.bw / 2 - 1); ctx.lineTo(bl + 20, 0); ctx.lineTo(bl + 1, G.bw / 2 + 1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(spr.turret.c, -spr.turret.w / 2, -spr.turret.h / 2, spr.turret.w, spr.turret.h);
  ctx.restore();

  if (p.alive && p.shield) {
    const r = C.r + 14 + Math.sin(t / 180) * 1.5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35;
    ctx.drawImage(glow('#80deea'), p.x - r * 1.4, p.y - r * 1.4, r * 2.8, r * 2.8);
    ctx.globalAlpha = .9; ctx.strokeStyle = '#a5f3ff'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t / 25;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke(); ctx.restore();
  }
}

function drawIcon(ctx, type, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.5, s * .17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (type === 'triple') { for (const a of [-.45, 0, .45]) { ctx.moveTo(0, s * .7); ctx.lineTo(Math.sin(a) * s * .9, -Math.cos(a) * s * .8); } ctx.stroke();
    for (const a of [-.45, 0, .45]) { ctx.beginPath(); ctx.arc(Math.sin(a) * s * .9, -Math.cos(a) * s * .8, s * .2, 0, 7); ctx.fill(); } }
  else if (type === 'shield') { ctx.moveTo(0, -s * .9); ctx.quadraticCurveTo(s * .55, -s * .6, s * .8, -s * .65); ctx.quadraticCurveTo(s * .8, s * .45, 0, s * .9);
    ctx.quadraticCurveTo(-s * .8, s * .45, -s * .8, -s * .65); ctx.quadraticCurveTo(-s * .55, -s * .6, 0, -s * .9); ctx.stroke(); }
  else if (type === 'speed') { for (const o of [-.45, .2]) { ctx.moveTo(s * o, -s * .7); ctx.lineTo(s * (o + .5), 0); ctx.lineTo(s * o, s * .7); } ctx.stroke(); }
  else if (type === 'bounce') { ctx.moveTo(-s * .8, -s * .6); ctx.lineTo(-s * .2, s * .6); ctx.lineTo(s * .3, -s * .3); ctx.lineTo(s * .8, s * .4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .8, s * .4); ctx.lineTo(s * .35, s * .35); ctx.moveTo(s * .8, s * .4); ctx.lineTo(s * .75, -s * .05); ctx.stroke(); }
  else if (type === 'mine') { ctx.arc(0, 0, s * .5, 0, 7); ctx.fill(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * .5, Math.sin(a) * s * .5); ctx.lineTo(Math.cos(a) * s * .9, Math.sin(a) * s * .9); ctx.stroke(); } }
  else if (type === 'repair') { ctx.moveTo(0, -s * .75); ctx.lineTo(0, s * .75); ctx.moveTo(-s * .75, 0); ctx.lineTo(s * .75, 0); ctx.lineWidth = s * .35; ctx.stroke(); }
  ctx.restore();
}
function drawPowerup(ctx, u, t) {
  const T = PU_TYPES[u.type], bob = Math.sin(t / 280 + u.id) * 3, y = u.y + bob;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + Math.sin(t / 200 + u.id) * .2;
  ctx.drawImage(glow(T.col), u.x - 42, y - 42, 84, 84); ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(u.x + 4, u.y + 16, 14, 5, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(u.x, y); ctx.rotate(Math.sin(t / 500 + u.id) * .15);
  ctx.fillStyle = 'rgba(14,18,24,.9)'; rr(ctx, -16, -16, 32, 32, 7); ctx.fill();
  ctx.strokeStyle = T.col; ctx.lineWidth = 2.5; ctx.stroke();
  drawIcon(ctx, u.type, 0, 0, 10, T.col);
  ctx.restore();
}
function drawMine(ctx, m, t, col) {
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(m.x + 2, m.y + 3, 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#4a5056'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.arc(m.x + Math.cos(a) * 5, m.y + Math.sin(a) * 5, 1.6, 0, 7); ctx.fill(); }
  const on = m.armed && (t / 250 | 0) % 2 === 0;
  ctx.fillStyle = on ? '#ff3d3d' : '#5a1d1d'; ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, 7); ctx.fill();
  if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ff3d3d'), m.x - 12, m.y - 12, 24, 24); ctx.restore(); }
}
function drawZone(ctx, z, t) {
  if (z.r > Math.hypot(WW, WH)) return;
  ctx.save(); ctx.beginPath(); ctx.rect(-60, -60, WW + 120, WH + 120); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(140,10,30,.3)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,100,.9)'; ctx.lineWidth = 4; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t / 40;
  ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,90,100,.25)'; ctx.lineWidth = 14; ctx.stroke();
  ctx.restore();
}
function drawPath(ctx, pts, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.lineCap = 'round';
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    ctx.globalAlpha = Math.max(.1, .75 - total / 900);
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (i < pts.length - 1) { ctx.setLineDash([]); ctx.globalAlpha *= .9; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 3, 0, 7); ctx.stroke(); ctx.setLineDash([3, 9]); }
  }
  ctx.restore();
}
function text(ctx, s, x, y, font, color = '#fff', align = 'center') {
  ctx.font = font; ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillText(s, x + 2, y + 3);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
// small tank preview for the menu cards
function tankPreview(canvas, ck, palIdx) {
  const x = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  x.clearRect(0, 0, w, h);
  const p = {ck, pal:PALS[palIdx], idx:palIdx, x:0, y:0, a:-Math.PI / 2, ta:-Math.PI / 2, alive:true, tl:0, tr:0, ant:0, recoil:0, muzzle:0, flash:0, color:'#fff'};
  x.save(); x.translate(w / 2, h / 2 + 14); x.scale(1.05, 1.05); drawTank(x, p, 0); x.restore();
}
