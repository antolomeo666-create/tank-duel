// ============ GAME: rules, input, rounds, HUD, menu, main loop ============
const cvs = document.getElementById('c'), ctx = cvs.getContext('2d');
const W = cvs.width, H = cvs.height;
const FONT = "'Black Ops One', Impact, system-ui, sans-serif";
const WIN_ROUNDS = 3, TURRET_SPEED = 4.5;
const ZONE_DELAY = 45, ZONE_TIME = 50, ZONE_MIN = 170, ZONE_DPS = 12, ZONE_R0 = Math.hypot(WW, WH) / 2 + 40;
const TEAM = [{name:'BLUE', color:'#4fc3f7', ui:'#a9e4ff'}, {name:'ORANGE', color:'#ff7043', ui:'#ffb08f'}];
const KEYSETS = [
  {f:['KeyW'], b:['KeyS'], l:['KeyA'], r:['KeyD'], tl:['KeyQ'], tr:['KeyE'], fire:['Space'], sp:['KeyF', 'ShiftLeft']},
  {f:['ArrowUp'], b:['ArrowDown'], l:['ArrowLeft'], r:['ArrowRight'], tl:['Comma'], tr:['Period'], fire:['Enter', 'NumpadEnter'], sp:['ShiftRight', 'Slash']},
];
const NOINPUT = Object.freeze({turn:0, move:0, tturn:0, aim:null, fire:false, special:false});

// ---------- settings (remembered between visits) ----------
const settings = {mode:'local', diff:'medium', map:'random', turret:'fixed', aim:'on', sound:'on', p1:'striker', p2:'striker'};
try { Object.assign(settings, JSON.parse(localStorage.getItem('tankduel-v2') || '{}')); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('tankduel-v2', JSON.stringify(settings)); } catch (e) {} };
let opts = {turret:'free', map:'random', aim:'off'};   // options of the running match

// ---------- state ----------
let mode = 'demo', state = 'countdown', timer = 0, msg = '', msgIdx = -1, paused = false, roundNo = 0;
let mapIdx = 0, MAP = null, walls = [], blocks = [];
let bullets = [], powerups = [], mines = [], puTimer = 0, rt = 0, zoneWarned = false, nextId = 1, lastBeep = 0;
const zone = {x:WW / 2, y:WH / 2, r:ZONE_R0};
const cam = {x:WW / 2, y:WH / 2, z:Math.min(W / WW, H / WH)};
let shake = 0, events = [];
const players = [0, 1].map(i => ({idx:i, ...TEAM[i], pal:PALS[i], wins:0, ck:'striker', fx:{triple:0, speed:0, bounce:0}, ai:{}, hp:100, maxhp:100}));
const myIdx = () => Net.role === 'guest' ? 1 : 0;
const vig = mk(W, H); {
  const v = vig.getContext('2d'), gr = v.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); v.fillStyle = gr; v.fillRect(0, 0, W, H);
}

// ---------- collision ----------
function circleRect(x, y, r, w) {
  const cx = Math.max(w.x, Math.min(x, w.x + w.w)), cy = Math.max(w.y, Math.min(y, w.y + w.h));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}
function obstacleAt(x, y, r) {
  for (const w of walls) if (circleRect(x, y, r, w)) return w;
  for (const b of blocks) if (b.hp > 0 && circleRect(x, y, r, b)) return b;
  return null;
}
function blocked(x, y, r, self) {
  if (obstacleAt(x, y, r)) return true;
  return players.some(p => p !== self && p.alive && Math.hypot(p.x - x, p.y - y) < r + CLASSES[p.ck].r);
}
function barrelBlocked(p, a) {
  const L = CLASSES[p.ck].g.bl * TS + 4;
  for (let s = 12; s <= L; s += 7) if (obstacleAt(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s, 2)) return true;
  return false;
}
// traces a shell's path with ricochets (used for the aim line and by the CPU)
function simulatePath(x, y, a, br, bounces, maxLen, step, tg) {
  let vx = Math.cos(a), vy = Math.sin(a), len = 0, bc = 0;
  const pts = [[x, y]];
  while (len < maxLen) {
    x += vx * step; if (obstacleAt(x, y, br)) { x -= vx * step; vx = -vx; bc++; pts.push([x, y]); if (bc > bounces) return {pts, hit:null, len, bounces:bc}; }
    y += vy * step; if (obstacleAt(x, y, br)) { y -= vy * step; vy = -vy; bc++; pts.push([x, y]); if (bc > bounces) return {pts, hit:null, len, bounces:bc}; }
    len += step;
    if (tg) {
      if (Math.hypot(x - tg.foe.x, y - tg.foe.y) < CLASSES[tg.foe.ck].r + br) return {pts, hit:'foe', len, bounces:bc};
      if (bc > 0 && Math.hypot(x - tg.me.x, y - tg.me.y) < CLASSES[tg.me.ck].r + br + 8) return {pts, hit:'self', len, bounces:bc};
    }
  }
  pts.push([x, y]);
  return {pts, hit:null, len, bounces:bc};
}

// ---------- effects (also sent to the online guest as events) ----------
const pan = x => clamp((x - cam.x) * cam.z / (W / 2), -1, 1) * .8;
const FX = {
  fire(x, y, a, pi) {
    const p = players[pi]; p.recoil = 1; p.muzzle = .07;
    spray('spark', x, y, 6, 150, 380, {life:[.1, .3]}, a, .35);
    spray('smoke', x, y, 4, 10, 60, {size:[5, 9], grow:26, life:[.5, .9], drag:.92, c:'#6a6a6a'}, a, .6);
    if (CLASSES[p.ck].bounces === 0) Sfx.rail(pan(x)); else Sfx.fire(pan(x), p.ck === 'heavy');
    shake = Math.max(shake, p.ck === 'heavy' ? 5 : 3);
  },
  bounce(x, y) {
    spray('spark', x, y, 8, 80, 300, {life:[.15, .4]});
    spray('dust', x, y, 3, 10, 50, {size:[4, 7], grow:20, life:[.4, .8], drag:.92, c:MAP.th.snow ? '#eef3f8' : undefined});
    dc.fillStyle = 'rgba(20,16,10,.35)'; dc.beginPath(); dc.arc(x, y, 4, 0, 7); dc.fill();
    Sfx.ricochet(pan(x));
  },
  hit(x, y, pi) {
    players[pi].flash = .15; shake = Math.max(shake, 10);
    spray('spark', x, y, 16, 120, 420, {life:[.15, .45]});
    spray('fire', x, y, 5, 20, 90, {size:[6, 12], grow:-14, life:[.2, .4]});
    spray('smoke', x, y, 4, 10, 60, {size:[6, 10], grow:24, life:[.6, 1.1], drag:.93, c:'#3a3a3a'});
    spray('debris', x, y, 4, 100, 250, {size:[2, 4], life:[1.5, 2.5], drag:.88});
    Sfx.hit(pan(x));
  },
  shield(x, y) {
    P('ring', x, y, {size:30, grow:140, life:.4, c:'#a5f3ff', drag:1});
    spray('spark', x, y, 22, 100, 320, {life:[.2, .5], c:'#a5f3ff'});
    Sfx.shieldPop(pan(x));
  },
  boom(x, y) {
    P('flash', x, y, {size:320, life:.3});
    spray('fire', x, y, 28, 40, 230, {size:[16, 36], grow:-28, life:[.3, .75], drag:.9});
    spray('smoke', x, y, 26, 20, 130, {size:[14, 28], grow:38, life:[1.2, 2.4], drag:.95, c:'#2b2b2b'});
    spray('debris', x, y, 20, 150, 420, {size:[2, 6], life:[2, 3.5], drag:.88});
    spray('spark', x, y, 34, 200, 650, {life:[.2, .5], drag:.9});
    scorch(x, y, 60); shake = 24; Sfx.explode(pan(x));
  },
  mine(x, y) {
    P('flash', x, y, {size:260, life:.25, c:'#ffd9a0'});
    P('ring', x, y, {size:20, grow:320, life:.3, c:'#ffcf8a', drag:1});
    spray('fire', x, y, 20, 40, 200, {size:[12, 26], grow:-24, life:[.25, .6], drag:.9});
    spray('smoke', x, y, 18, 20, 110, {size:[10, 22], grow:32, life:[1, 2], drag:.95, c:'#333'});
    spray('spark', x, y, 26, 200, 550, {life:[.2, .45], drag:.9});
    scorch(x, y, 48); shake = Math.max(shake, 18); Sfx.mine(pan(x));
  },
  bhit(j) {
    const b = blocks[j]; if (!b) return; const x = b.x + b.w / 2, y = b.y + b.h / 2;
    if (b.k === 'b') { spray('debris', x, y, 5, 60, 200, {size:[2, 5], life:[1, 2], drag:.88, c:'#8a5a2b'}); Sfx.wood(pan(x)); }
    else { spray('dust', x, y, 6, 20, 90, {size:[5, 9], grow:22, life:[.5, 1], drag:.92, c:'#c9b27f'}); Sfx.sand(pan(x)); }
  },
  bbreak(j) {
    const b = blocks[j]; if (!b) return; b.hp = 0; navDirty = true;
    const x = b.x + b.w / 2, y = b.y + b.h / 2;
    if (b.k === 'b') { spray('debris', x, y, 18, 80, 320, {size:[3, 8], life:[1.5, 3], drag:.88, c:'#9a6a35'}); spray('dust', x, y, 6, 20, 80, {size:[6, 12], grow:24, life:[.6, 1.2], drag:.93}); Sfx.woodBreak(pan(x)); }
    else { spray('dust', x, y, 16, 30, 160, {size:[8, 16], grow:30, life:[.8, 1.6], drag:.93, c:'#cdb685'}); spray('debris', x, y, 8, 60, 200, {size:[3, 6], life:[1, 2], drag:.88, c:'#b89e6a'}); Sfx.sandBreak(pan(x)); }
    rubble(b);
  },
  pick(x, y, ti, pi) {
    const T = PU_TYPES[PU_KEYS[ti]];
    P('ring', x, y, {size:16, grow:170, life:.45, c:T.col, drag:1});
    spray('spark', x, y, 16, 80, 260, {life:[.2, .5], c:T.col});
    P('text', x, y - 30, {vy:-45, drag:.96, life:1.4, txt:T.name, c:T.col});
    Sfx.pickup(pan(x));
  },
  spawnpu(x, y) { P('ring', x, y, {size:60, grow:-90, life:.55, c:'#ffffff', drag:1}); Sfx.spawn(); },
  minedrop(x, y) { Sfx.mineDrop(pan(x)); },
  zone() { Sfx.zone(); },
  beep(hi) { Sfx.beep(hi); },
  win() { Sfx.win(); },
};
function fx(name, ...a) {
  FX[name](...a);
  if (mode === 'online' && Net.role === 'host') events.push([name, ...a.map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v)]);
}

// ---------- rounds ----------
function startMatch(m, o) {
  mode = m; opts = {...o}; paused = false; roundNo = 0;
  players.forEach(p => p.wins = 0);
  players[0].name = 'BLUE'; players[1].name = m === 'cpu' ? 'CPU' : 'ORANGE';
  Sfx.setEnabled(settings.sound === 'on' && m !== 'demo'); Sfx.setMuted(false);
  hidePause(); updateHelp();
  newRound();
}
function startDemo() {
  players[0].ck = CLASS_KEYS[Math.random() * 4 | 0]; players[1].ck = CLASS_KEYS[Math.random() * 4 | 0];
  startMatch('demo', {turret:'free', map:'random', aim:'off'});
}
function newRound() {
  roundNo++;
  const fixed = MAPS.findIndex(m => m.id === opts.map);
  loadMap(fixed >= 0 ? fixed : Math.random() * MAPS.length | 0);
  players.forEach(resetPlayer);
  bullets = []; powerups = []; mines = []; particles = []; events = [];
  puTimer = rand(5, 8); rt = 0; zone.r = ZONE_R0; zoneWarned = false;
  state = 'countdown'; timer = 3.4; lastBeep = 4; msgIdx = -1;
}
function loadMap(i) {
  mapIdx = i; MAP = buildMap(i); walls = MAP.walls;
  blocks = MAP.tmpl.map((t, j) => ({...t, hp:t.max, j}));
  dc.clearRect(0, 0, WW, WH); navDirty = true;
}
function resetPlayer(p) {
  const C = CLASSES[p.ck], s = SPAWNS[p.idx];
  Object.assign(p, {x:s.x, y:s.y, a:s.a, ta:s.a, hp:C.hp, maxhp:C.hp, alive:true, cool:0, flash:0, recoil:0, muzzle:0, shield:false, mines:0,
    fx:{triple:0, speed:0, bounce:0}, vx:0, vy:0, tl:0, tr:0, ant:0, mark:0, cx:s.x, cy:s.y, ca:s.a, spd:0, lastSp:false, ai:{}, hurtT:0, snapReset:true});
}

// ---------- input ----------
const keys = {}, tapped = {};   // tapped: keys pressed since the last frame, so very quick taps are never missed
const anyKey = arr => arr.some(k => keys[k] || tapped[k]);
function keyInput(set) {
  return {turn:(anyKey(set.r) ? 1 : 0) - (anyKey(set.l) ? 1 : 0), move:(anyKey(set.f) ? 1 : 0) - (anyKey(set.b) ? .6 : 0),
    tturn:(anyKey(set.tr) ? 1 : 0) - (anyKey(set.tl) ? 1 : 0), aim:null, fire:anyKey(set.fire), special:anyKey(set.sp)};
}
function merge(a, b) {
  return {turn:clamp(a.turn + b.turn, -1, 1), move:clamp(a.move + b.move, -.6, 1), tturn:clamp(a.tturn + b.tturn, -1, 1),
    aim:a.aim ?? b.aim, fire:a.fire || b.fire, special:a.special || b.special};
}
let pads = [], padPrev = [];
function padInput(g, p) {
  if (!g || !p) return NOINPUT;
  const btn = i => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > .5));
  const lx = g.axes[0] || 0, ly = g.axes[1] || 0, rx = g.axes[2] || 0, ry = g.axes[3] || 0, mag = Math.hypot(lx, ly);
  let turn = 0, move = 0;
  if (mag > .25) {   // twin-stick: push the stick where you want to drive
    const target = Math.atan2(ly, lx); let d = angDiff(target, p.a), dir = 1;
    if (Math.abs(d) > 2.2) { d = angDiff(target + Math.PI, p.a); dir = -.6; }
    turn = clamp(d * 2.5, -1, 1); move = Math.abs(d) < 1.1 ? Math.min(1, mag) * dir : 0;
  }
  if (btn(12)) move = 1; if (btn(13)) move = -.6; if (btn(14)) turn = -1; if (btn(15)) turn = 1;
  const aim = Math.hypot(rx, ry) > .4 ? Math.atan2(ry, rx) : null;
  return {turn, move, tturn:0, aim, fire:btn(0) || btn(5) || btn(7), special:btn(1) || btn(4) || btn(6)};
}
const localInput = p => merge(merge(keyInput(KEYSETS[0]), keyInput(KEYSETS[1])), padInput(pads[0], p));
function sanitize(i) {
  if (!i) return NOINPUT;
  return {turn:clamp(+i.turn || 0, -1, 1), move:clamp(+i.move || 0, -.6, 1), tturn:clamp(+i.tturn || 0, -1, 1),
    aim:typeof i.aim === 'number' && isFinite(i.aim) ? i.aim : null, fire:!!i.fire, special:!!i.special};
}
function getInput(p, dt) {
  const foe = players[1 - p.idx];
  if (mode === 'demo') return aiThink(p, foe, dt, AI_DIFF.medium);
  if (mode === 'cpu') return p.idx === 1 ? aiThink(p, foe, dt, AI_DIFF[settings.diff]) : localInput(p);
  if (mode === 'online') return p.idx === 0 ? localInput(p) : sanitize(Net.remoteIn);
  return merge(keyInput(KEYSETS[p.idx]), padInput(pads[p.idx], p));
}

// ---------- simulation ----------
function update(dt) {
  if (dt <= 0) return;
  if (state === 'countdown') {
    timer -= dt;
    const n = Math.ceil(timer - .4);
    if (n < lastBeep && n > 0) { lastBeep = n; fx('beep', 0); }
    if (timer <= .4 && lastBeep > 0) { lastBeep = 0; fx('beep', 1); }
    if (timer <= 0) state = 'play';
  } else if (state === 'roundover') { timer -= dt; if (timer <= 0) newRound(); }
  else if (state === 'matchover') { timer -= dt; if (mode === 'demo' && timer <= 0) startDemo(); }

  if (state === 'play') {
    rt += dt;
    zone.r = ZONE_R0 + (ZONE_MIN - ZONE_R0) * clamp((rt - ZONE_DELAY) / ZONE_TIME, 0, 1);
    if (rt >= ZONE_DELAY && !zoneWarned) { zoneWarned = true; fx('zone'); }
    puTimer -= dt;
    if (puTimer <= 0) { puTimer = rand(7, 11); if (powerups.length < 2) spawnPU(); }
  }
  for (const p of players) simPlayer(p, state === 'play' ? getInput(p, dt) : NOINPUT, dt);
  updateBullets(dt); updateMines(dt); pickups(); checkRoundEnd();
}
function simPlayer(p, inp, dt) {
  p.cool -= dt; p.hurtT -= dt;
  for (const k in p.fx) p.fx[k] = Math.max(0, p.fx[k] - dt);
  if (!p.alive) return;
  const C = CLASSES[p.ck], boost = p.fx.speed > 0;
  const da = inp.turn * C.turn * (boost ? 1.25 : 1) * dt; p.a += da;
  const mv = clamp(inp.move, -.6, 1), sp = C.speed * (boost ? 1.5 : 1);
  const ox = p.x, oy = p.y, nx = p.x + Math.cos(p.a) * sp * mv * dt, ny = p.y + Math.sin(p.a) * sp * mv * dt;
  if (!blocked(nx, p.y, C.r, p)) p.x = nx;
  if (!blocked(p.x, ny, C.r, p)) p.y = ny;
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
  if (opts.turret === 'free') {
    p.ta += da;
    if (inp.aim !== null) p.ta += clamp(angDiff(inp.aim, p.ta), -TURRET_SPEED * dt, TURRET_SPEED * dt);
    else p.ta += inp.tturn * TURRET_SPEED * dt;
  } else p.ta = p.a;
  if (state === 'play' && Math.hypot(p.x - zone.x, p.y - zone.y) > zone.r) {
    p.hp -= ZONE_DPS * dt; p.hurtT = .3;
    if (p.hp <= 0) kill(p);
  }
  if (inp.fire && p.cool <= 0 && state === 'play') fire(p);
  if (inp.special && !p.lastSp && state === 'play') dropMine(p);
  p.lastSp = inp.special;
}
function fire(p) {
  const C = CLASSES[p.ck]; p.cool = C.reload;
  const L = C.g.bl * TS + 4, a = p.ta, bx = p.x + Math.cos(a) * L, by = p.y + Math.sin(a) * L;
  fx('fire', bx, by, a, p.idx);
  if (barrelBlocked(p, a) || obstacleAt(bx, by, C.br)) return;   // barrel pressed into a wall
  for (const s of p.fx.triple > 0 ? [-.16, 0, .16] : [0])
    bullets.push({id:nextId++, x:bx, y:by, vx:Math.cos(a + s) * C.bspeed, vy:Math.sin(a + s) * C.bspeed, o:p.idx,
      bounces:C.bounces + (p.fx.bounce > 0 ? 3 : 0), life:C.bspeed > 800 ? 2.2 : 4, dmg:C.dmg, br:C.br, trail:[], bounced:false});
}
function hitObstacle(b, o, axis, dt) {
  if (o.max) {   // destructible: the hit that breaks it lets the shell fly through
    if (o.hp <= 1) { damageBlock(o, 1); return; }
    damageBlock(o, 1);
  }
  if (axis === 'x') { b.x -= b.vx * dt; b.vx = -b.vx; } else { b.y -= b.vy * dt; b.vy = -b.vy; }
  b.bounced = true; b.bounces--;
  if (b.bounces < 0) b.life = 0;
  fx('bounce', b.x, b.y);
}
function moveBullet(b, dt) {
  b.x += b.vx * dt; let o = obstacleAt(b.x, b.y, b.br); if (o) hitObstacle(b, o, 'x', dt);
  if (b.life <= 0) return;
  b.y += b.vy * dt; o = obstacleAt(b.x, b.y, b.br); if (o) hitObstacle(b, o, 'y', dt);
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.life -= dt;
    b.trail.push({x:b.x, y:b.y}); if (b.trail.length > 10) b.trail.shift();
    const steps = Math.max(2, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6));
    for (let i = 0; i < steps && b.life > 0; i++) {
      moveBullet(b, dt / steps);
      if (b.life <= 0) break;
      for (const p of players) {
        if (!p.alive || (p.idx === b.o && !b.bounced)) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < CLASSES[p.ck].r + b.br) { b.life = 0; damage(p, b.dmg, b.x, b.y); break; }
      }
      if (b.life <= 0) break;
      for (const m of mines) if (!m.dead && Math.hypot(m.x - b.x, m.y - b.y) < b.br + 9) { b.life = 0; detonate(m); break; }
    }
  }
  bullets = bullets.filter(b => b.life > 0);
}
function damageBlock(o, n) {
  if (o.hp <= 0) return;
  o.hp -= n;
  if (o.hp <= 0) { o.hp = 0; fx('bbreak', o.j); } else fx('bhit', o.j);
}
function damage(p, amt, x, y) {
  if (!p.alive) return;
  if (p.shield) { p.shield = false; fx('shield', p.x, p.y); return; }
  p.hp -= amt; fx('hit', x, y, p.idx);
  if (p.hp <= 0) kill(p);
}
function kill(p) { if (!p.alive) return; p.alive = false; p.hp = 0; fx('boom', p.x, p.y); }
function dropMine(p) {
  if (p.mines <= 0) return;
  const C = CLASSES[p.ck], d = C.g.hl * TS + 18, x = p.x - Math.cos(p.a) * d, y = p.y - Math.sin(p.a) * d;
  if (obstacleAt(x, y, 9)) return;
  p.mines--; mines.push({id:nextId++, x, y, o:p.idx, arm:.9, armed:false});
  fx('minedrop', x, y);
}
function updateMines(dt) {
  for (const m of mines) {
    if (m.dead) continue;
    m.arm -= dt; m.armed = m.arm <= 0;
    if (m.armed) for (const p of players) if (p.alive && Math.hypot(p.x - m.x, p.y - m.y) < CLASSES[p.ck].r + 10) { detonate(m); break; }
  }
  mines = mines.filter(m => !m.dead);
}
function detonate(m) {
  if (m.dead) return; m.dead = true;
  fx('mine', m.x, m.y);
  for (const p of players) { const d = Math.hypot(p.x - m.x, p.y - m.y); if (p.alive && d < 100) damage(p, Math.round(60 * (1 - .6 * d / 100)), p.x, p.y); }
  for (const b of blocks) if (b.hp > 0 && Math.hypot(b.x + b.w / 2 - m.x, b.y + b.h / 2 - m.y) < 75) damageBlock(b, 3);
  for (const o of mines) if (!o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 90) detonate(o);
}
function spawnPU() {
  let best = null, bs = 1e9;
  for (let t = 0; t < 60; t++) {
    const x = rand(140, WW - 140), y = rand(110, WH - 110);
    if (obstacleAt(x, y, 36) || players.some(p => Math.hypot(p.x - x, p.y - y) < 240)) continue;
    if (Math.hypot(x - zone.x, y - zone.y) > zone.r - 80 || powerups.some(u => Math.hypot(u.x - x, u.y - y) < 220)) continue;
    const s = Math.hypot(x - WW / 2, y - WH / 2) * rand(.5, 1.5);   // favour the middle of the map
    if (s < bs) { bs = s; best = [x, y]; }
  }
  if (!best) return;
  let tot = 0; for (const k of PU_KEYS) tot += PU_TYPES[k].w;
  let r = Math.random() * tot, type = PU_KEYS[0];
  for (const k of PU_KEYS) { r -= PU_TYPES[k].w; if (r <= 0) { type = k; break; } }
  powerups.push({id:nextId++, type, x:best[0], y:best[1]});
  fx('spawnpu', best[0], best[1]);
}
function pickups() {
  for (const u of powerups) for (const p of players) {
    if (!p.alive || u.dead || Math.hypot(p.x - u.x, p.y - u.y) > CLASSES[p.ck].r + 18) continue;
    const t = u.type; u.dead = true;
    if (t === 'triple') p.fx.triple = 8; else if (t === 'shield') p.shield = true; else if (t === 'speed') p.fx.speed = 6;
    else if (t === 'bounce') p.fx.bounce = 10; else if (t === 'mine') p.mines = Math.min(6, p.mines + 3);
    else if (t === 'repair') p.hp = Math.min(p.maxhp, p.hp + p.maxhp * .4);
    fx('pick', u.x, u.y, PU_KEYS.indexOf(t), p.idx);
  }
  powerups = powerups.filter(u => !u.dead);
}
function checkRoundEnd() {
  if (state !== 'play') return;
  const alive = players.filter(p => p.alive);
  if (alive.length === 2) return;
  if (alive.length === 1) {
    const w = alive[0]; w.wins++; msgIdx = w.idx;
    if (w.wins >= WIN_ROUNDS) { state = 'matchover'; timer = 6; msg = `${w.name} WINS THE MATCH`; fx('win'); }
    else { state = 'roundover'; timer = 3; msg = `${w.name} WINS THE ROUND`; }
  } else { state = 'roundover'; timer = 3; msg = 'DRAW'; msgIdx = -1; }
}

// ---------- online sync (host sends snapshots, guest renders them) ----------
const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;
function snapshot() {
  return {t:'s', st:state, tm:r1(timer), msg, mc:msgIdx, m:mapIdx, rn:roundNo, rt:r1(rt), zr:r1(zone.r), w:players.map(p => p.wins),
    p:players.map(p => [r1(p.x), r1(p.y), r3(p.a), r3(p.ta), r1(p.hp), p.alive ? 1 : 0, r1(p.cool), p.shield ? 1 : 0, p.mines,
      r1(p.fx.triple), r1(p.fx.speed), r1(p.fx.bounce), p.ck, p.hurtT > 0 ? 1 : 0]),
    b:bullets.map(b => [b.id, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.o, b.br]),
    k:blocks.map(b => b.hp), u:powerups.map(u => [u.id, u.type, r1(u.x), r1(u.y)]),
    n:mines.map(m => [m.id, r1(m.x), r1(m.y), m.o, m.armed ? 1 : 0]), e:events.splice(0)};
}
function applySnap(s) {
  if (s.m !== mapIdx || s.rn !== roundNo) {
    roundNo = s.rn; loadMap(s.m); particles = []; bullets = [];
    players.forEach(p => { p.snapReset = true; p.ai = {}; });
  }
  state = s.st; timer = s.tm; msg = s.msg; msgIdx = s.mc; rt = s.rt; zone.r = s.zr;
  players.forEach((p, i) => {
    const a = s.p[i]; p.wins = s.w[i];
    if (p.ck !== a[12]) { p.ck = a[12]; }
    p.maxhp = CLASSES[p.ck].hp;
    [p.tx, p.ty, p.taa, p.tta, p.hp] = a; p.alive = !!a[5]; p.cool = a[6]; p.shield = !!a[7]; p.mines = a[8];
    p.fx.triple = a[9]; p.fx.speed = a[10]; p.fx.bounce = a[11]; p.hurtT = a[13] ? .3 : 0;
    if (p.snapReset) { p.x = p.cx = p.tx; p.y = p.cy = p.ty; p.a = p.ca = p.taa; p.ta = p.tta; p.snapReset = false; }
  });
  const old = {}; for (const b of bullets) old[b.id] = b;
  bullets = s.b.map(([id, x, y, vx, vy, o, br]) => ({id, x, y, vx, vy, o, br, trail:old[id] ? old[id].trail : []}));
  blocks.forEach((b, i) => { if (s.k[i] !== undefined) b.hp = s.k[i]; });
  powerups = s.u.map(([id, type, x, y]) => ({id, type, x, y}));
  mines = s.n.map(([id, x, y, o, armed]) => ({id, x, y, o, armed:!!armed}));
  for (const e of s.e) if (FX[e[0]]) FX[e[0]](...e.slice(1));
}
let inSendT = 0;
function guestTick(dt) {
  inSendT -= dt;
  let sent = false;
  if (inSendT <= 0) { inSendT = 1 / 30; sent = true; Net.send({t:'in', i:state === 'play' && !paused ? localInput(players[1]) : NOINPUT}); }
  const k = Math.min(1, dt * 18);
  for (const p of players) {
    if (p.tx === undefined) continue;
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    p.a += angDiff(p.taa, p.a) * k; p.ta += angDiff(p.tta, p.ta) * k;
    p.cool -= dt;
  }
  for (const b of bullets) { b.trail.push({x:b.x, y:b.y}); if (b.trail.length > 10) b.trail.shift(); b.x += b.vx * dt; b.y += b.vy * dt; }
  return sent;
}

// ---------- cosmetic per-frame stuff (runs on host and guest) ----------
function cosmetics(dt) {
  for (const p of players) {
    p.flash -= dt; p.muzzle -= dt; p.recoil = Math.max(0, p.recoil - dt * 5);
    const dx = p.x - p.cx, dy = p.y - p.cy, dist = Math.hypot(dx, dy);
    if (dist > 80 || dt <= 0) { p.cx = p.x; p.cy = p.y; p.ca = p.a; continue; }
    const moved = dist * Math.sign(dx * Math.cos(p.a) + dy * Math.sin(p.a)), spin = angDiff(p.a, p.ca) * 16;
    p.tl += moved - spin; p.tr += moved + spin; p.spd = dist / dt;
    p.ant += ((-clamp(moved / dt / 220, -1, 1) * .5 - clamp(spin / dt / 60, -1, 1) * .35) - p.ant) * Math.min(1, dt * 6);
    p.mark += Math.abs(moved) + Math.abs(spin) * .6;
    if (p.mark > 6) { p.mark = 0; if (p.alive) treadMark(p); }
    const back = CLASSES[p.ck].g.hl * TS + 6, rx = p.x - Math.cos(p.a) * back, ry = p.y - Math.sin(p.a) * back;
    if (p.alive) {
      if (Math.abs(moved) > .5 && Math.random() < dt * 12) P('dust', rx, ry, {vx:rand(-15, 15), vy:rand(-15, 15), size:rand(4, 8), grow:16, life:rand(.5, .9), drag:.95, c:MAP.th.snow ? '#f2f6fa' : undefined});
      if (p.fx.speed > 0 && Math.abs(moved) > .5) P('boost', rx, ry, {vx:-Math.cos(p.a) * 60 + rand(-10, 10), vy:-Math.sin(p.a) * 60 + rand(-10, 10), size:rand(4, 7), grow:-6, life:rand(.2, .4)});
      if (p.hp < p.maxhp * .35 && Math.random() < dt * 9) P('smoke', rx, ry, {vx:rand(-10, 10), vy:rand(-25, -5), size:rand(5, 9), grow:14, life:rand(.8, 1.5), drag:.97, c:'#4a4a4a'});
    } else {
      if (Math.random() < dt * 16) P('smoke', p.x + rand(-8, 8), p.y + rand(-8, 8), {vx:rand(-10, 10), vy:rand(-30, -10), size:rand(8, 14), grow:18, life:rand(1.2, 2.2), drag:.97, c:'#222'});
      if (Math.random() < dt * 9) P('fire', p.x + rand(-10, 10), p.y + rand(-8, 8), {vy:-20, size:rand(6, 11), grow:-8, life:rand(.3, .6)});
    }
    p.cx = p.x; p.cy = p.y; p.ca = p.a;
  }
}
function updateCamera(dt) {
  const fit = Math.min(W / WW, H / WH);
  let tx = WW / 2, ty = WH / 2, tz = fit;
  const live = players.filter(p => p.alive);
  if (live.length) {
    const xs = live.map(p => p.x), ys = live.map(p => p.y);
    const dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
    tx = (Math.max(...xs) + Math.min(...xs)) / 2; ty = (Math.max(...ys) + Math.min(...ys)) / 2;
    tz = Math.max(fit, Math.min(1.15, W / (dx + 600), H / (dy + 460)));
  }
  const k = Math.min(1, dt * 4);
  cam.z += (tz - cam.z) * k;
  const hw = W / 2 / cam.z, hh = H / 2 / cam.z;
  tx = WW > hw * 2 ? clamp(tx, hw, WW - hw) : WW / 2;
  ty = WH > hh * 2 ? clamp(ty, hh, WH - hh) : WH / 2;
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
}

// ---------- drawing ----------
const isHuman = p => mode === 'local' || (mode === 'cpu' && p.idx === 0) || (mode === 'online' && p.idx === myIdx());
function drawBlockDamage(b) {
  const f = b.hp / b.max; if (f >= 1) return;
  let s = b.seed; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  ctx.fillStyle = `rgba(0,0,0,${(1 - f) * .3})`; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = b.k === 'b' ? 'rgba(40,22,8,.85)' : 'rgba(70,52,28,.8)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < (b.max - b.hp) * 2; i++) {
    let x = b.x + 4 + r() * (b.w - 8), y = b.y + 4 + r() * (b.h - 8);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) { x = clamp(x + (r() - .5) * 18, b.x + 2, b.x + b.w - 2); y = clamp(y + (r() - .5) * 18, b.y + 2, b.y + b.h - 2); ctx.lineTo(x, y); }
    ctx.stroke();
  }
}
function drawBullets() {
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const b of bullets) {
    const col = players[b.o].color, pts = [...b.trail, {x:b.x, y:b.y}];
    ctx.strokeStyle = col;
    for (let i = 1; i < pts.length; i++) {
      ctx.globalAlpha = i / pts.length * .6; ctx.lineWidth = b.br * 1.8 * i / pts.length;
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    ctx.globalAlpha = .9; const s = b.br * 9; ctx.drawImage(glow(col), b.x - s / 2, b.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  for (const b of bullets) {
    ctx.fillStyle = players[b.o].color; ctx.beginPath(); ctx.arc(b.x, b.y, b.br, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.br * .5, 0, 7); ctx.fill();
  }
}
function tankBars(p) {
  const C = CLASSES[p.ck], w = 46, x = p.x - w / 2, y = p.y - C.r - 30;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, x - 3, y - 3, w + 6, 16, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = p.color; ctx.fillRect(x, y, w * clamp(p.hp / p.maxhp, 0, 1), 4);
  const r = 1 - Math.max(0, p.cool) / C.reload;
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y + 7, w, 3);
  ctx.fillStyle = r >= 1 ? '#ffd54f' : 'rgba(255,255,255,.6)'; ctx.fillRect(x, y + 7, w * clamp(r, 0, 1), 3);
}
function drawMinimap() {
  const mw = 220, s = mw / WW, mh = WH * s, mx = W - mw - 18, my = H - mh - 18;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,14,.88)'; rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.drawImage(MAP.ground, mx, my, mw, mh); ctx.drawImage(decal, mx, my, mw, mh);
  for (const b of blocks) if (b.hp > 0) { ctx.fillStyle = b.k === 'b' ? '#b07a40' : '#cdb685'; ctx.fillRect(mx + b.x * s, my + b.y * s, b.w * s, b.h * s); }
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(mx, my, mw, mh);
  if (zone.r < ZONE_R0) {
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.arc(mx + zone.x * s, my + zone.y * s, zone.r * s, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(160,20,40,.45)'; ctx.fill();
  }
  for (const u of powerups) { ctx.fillStyle = PU_TYPES[u.type].col; ctx.fillRect(mx + u.x * s - 3, my + u.y * s - 3, 6, 6); }
  for (const m of mines) { ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(mx + m.x * s, my + m.y * s, 2, 0, 7); ctx.fill(); }
  for (const b of bullets) { ctx.fillStyle = players[b.o].color; ctx.beginPath(); ctx.arc(mx + b.x * s, my + b.y * s, 1.8, 0, 7); ctx.fill(); }
  for (const p of players) {
    const px = mx + p.x * s, py = my + p.y * s;
    if (!p.alive) { ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4); ctx.moveTo(px + 4, py - 4); ctx.lineTo(px - 4, py + 4); ctx.stroke(); continue; }
    ctx.save(); ctx.translate(px, py); ctx.rotate(p.a);
    ctx.fillStyle = p.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5.5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5.5); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  const hw = W / 2 / cam.z, hh = H / 2 / cam.z;
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
  ctx.strokeRect(mx + Math.max(0, cam.x - hw) * s, my + Math.max(0, cam.y - hh) * s, Math.min(WW, hw * 2) * s, Math.min(WH, hh * 2) * s);
  ctx.restore();
  text(ctx, MAPS[mapIdx].name.toUpperCase(), mx, my - 12, '700 11px system-ui', '#cfd6dd', 'left');
}
function panel(p, right) {
  const w = 300, h = 102, x = right ? W - w - 18 : 18, y = 16, C = CLASSES[p.ck];
  ctx.fillStyle = 'rgba(10,13,18,.82)'; rr(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = p.hurtT > 0 ? '#ff5a64' : p.color; ctx.globalAlpha = p.hurtT > 0 ? .9 : .5; ctx.lineWidth = p.hurtT > 0 ? 2.5 : 1.5; ctx.stroke(); ctx.globalAlpha = 1;
  const you = mode === 'online' && p.idx === myIdx() ? ' (YOU)' : '';
  text(ctx, p.name + you, x + 14, y + 25, `19px ${FONT}`, p.ui, 'left');
  text(ctx, C.name.toUpperCase(), x + 14, y + 41, '700 10px system-ui', '#8a94a0', 'left');
  for (let i = 0; i < WIN_ROUNDS; i++) {
    const cx = x + w - 20 - i * 22, cy = y + 20;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fillStyle = i < p.wins ? p.color : 'rgba(255,255,255,.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
  }
  const bx = x + 14, bw = w - 70, by = y + 49, f = clamp(p.hp / p.maxhp, 0, 1);
  rr(ctx, bx, by, bw, 12, 4); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
  if (f > 0) { rr(ctx, bx, by, Math.max(8, bw * f), 12, 4); const gr = ctx.createLinearGradient(0, by, 0, by + 12); gr.addColorStop(0, p.ui); gr.addColorStop(1, p.color); ctx.fillStyle = gr; ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  for (let v = 25; v < p.maxhp; v += 25) ctx.fillRect(bx + bw * v / p.maxhp - .5, by, 1.5, 12);
  text(ctx, String(Math.max(0, Math.ceil(p.hp))), x + w - 14, by + 11, '700 14px system-ui', '#e8e8e8', 'right');
  const r = p.alive ? clamp(1 - Math.max(0, p.cool) / C.reload, 0, 1) : 0, ready = r >= 1;
  text(ctx, ready ? 'READY' : 'RELOADING', x + 14, y + 76, '700 10px system-ui', ready ? '#ffd54f' : '#9aa', 'left');
  const rx = x + 90, rw = w - 104;
  ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, rx, y + 69, rw, 6, 3); ctx.fill();
  ctx.fillStyle = ready ? '#ffd54f' : 'rgba(255,255,255,.6)'; rr(ctx, rx, y + 69, Math.max(6, rw * r), 6, 3); ctx.fill();
  let ix = x + 14; const iy = y + 91;
  const chip = (type, label) => {
    const col = PU_TYPES[type].col, cw = label ? 54 : 24;
    ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(ctx, ix, iy - 9, cw, 18, 5); ctx.fill();
    drawIcon(ctx, type, ix + 12, iy, 5.5, col);
    if (label) text(ctx, label, ix + 24, iy + 4, '700 11px system-ui', col, 'left');
    ix += cw + 6;
  };
  if (p.shield) chip('shield');
  if (p.fx.triple > 0) chip('triple', Math.ceil(p.fx.triple) + 's');
  if (p.fx.speed > 0) chip('speed', Math.ceil(p.fx.speed) + 's');
  if (p.fx.bounce > 0) chip('bounce', Math.ceil(p.fx.bounce) + 's');
  if (p.mines > 0) chip('mine', 'x' + p.mines);
}
function banner(h) {
  const gr = ctx.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, H / 2 - h / 2, W, h);
}
function draw(t) {
  ctx.fillStyle = '#0b0d11'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(MAP.ground, 0, 0); ctx.drawImage(decal, 0, 0);
  for (const b of blocks) if (b.hp > 0) { ctx.drawImage(b.spr, b.x - 24, b.y - 24); drawBlockDamage(b); }
  for (const m of mines) drawMine(ctx, m, t, players[m.o].color);
  for (const u of powerups) drawPowerup(ctx, u, t);
  if (opts.aim === 'on' && (state === 'play' || state === 'countdown'))
    for (const p of players) if (p.alive && isHuman(p)) {
      const C = CLASSES[p.ck], L = C.g.bl * TS + 4;
      if (barrelBlocked(p, p.ta)) continue;
      const r = simulatePath(p.x + Math.cos(p.ta) * L, p.y + Math.sin(p.ta) * L, p.ta, C.br, C.bounces + (p.fx.bounce > 0 ? 3 : 0), 900, 6);
      drawPath(ctx, r.pts, p.color);
    }
  for (const p of players) drawTank(ctx, p, t);
  drawParticles(ctx, false);
  drawBullets();
  ctx.globalCompositeOperation = 'lighter'; drawParticles(ctx, true); ctx.globalCompositeOperation = 'source-over';
  drawZone(ctx, zone, t);
  if (mode !== 'demo') for (const p of players) if (p.alive) tankBars(p);
  ctx.restore();
  ctx.drawImage(vig, 0, 0);
  if (players.some(p => p.hurtT > 0 && isHuman(p))) { ctx.fillStyle = `rgba(200,20,40,${.12 + Math.sin(t / 90) * .05})`; ctx.fillRect(0, 0, W, H); }
  if (mode === 'demo') return;

  drawMinimap(); panel(players[0], false); panel(players[1], true);
  const round = Math.min(WIN_ROUNDS * 2 - 1, players[0].wins + players[1].wins + (state === 'roundover' || state === 'matchover' ? 0 : 1));
  text(ctx, `ROUND ${round}`, W / 2, 42, `22px ${FONT}`, '#e8e2cf');
  if (state === 'play' || state === 'countdown') {
    if (rt < ZONE_DELAY) text(ctx, `zone closes in ${Math.ceil(ZONE_DELAY - rt)}s`, W / 2, 63, '600 13px system-ui', '#9aa');
    else text(ctx, zone.r > ZONE_MIN + 1 ? 'ZONE CLOSING' : 'ZONE CLOSED', W / 2, 64, `15px ${FONT}`, `rgba(255,${110 + Math.sin(t / 150) * 60 | 0},110,1)`);
  }
  if (state === 'countdown') {
    banner(140);
    text(ctx, timer > .4 ? String(Math.ceil(timer - .4)) : 'FIGHT!', W / 2, H / 2 + 32, `92px ${FONT}`, '#ffd54f');
    if (timer > 1.2) text(ctx, MAPS[mapIdx].name, W / 2, H / 2 - 50, `22px ${FONT}`, '#e8e2cf');
  } else if (state === 'roundover') {
    banner(110);
    text(ctx, msg, W / 2, H / 2 + 18, `52px ${FONT}`, msgIdx >= 0 ? players[msgIdx].ui : '#fff');
  } else if (state === 'matchover') {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); banner(220);
    text(ctx, msg, W / 2, H / 2, `64px ${FONT}`, msgIdx >= 0 ? players[msgIdx].ui : '#fff');
    const can = mode !== 'online' || Net.role === 'host';
    if (t % 1000 < 650) text(ctx, can ? 'SPACE / ENTER: REMATCH   ·   ESC: MENU' : 'WAITING FOR HOST…   ·   ESC: MENU', W / 2, H / 2 + 60, `22px ${FONT}`, '#ffd54f');
  }
  if (paused) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); }
}

// ---------- menu, pause, help ----------
const $ = s => document.querySelector(s);
const menuEl = $('#menu'), pauseEl = $('#pause');
const menuOpen = () => !menuEl.classList.contains('hidden');
function showMenu() { menuEl.classList.remove('hidden'); renderMenu(); updateHelp(); }
function hideMenu() { menuEl.classList.add('hidden'); }
function hidePause() { pauseEl.classList.add('hidden'); }
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600); }
function setNetStatus(html, bad) { const el = $('#netStatus'); el.innerHTML = html; el.classList.toggle('bad', !!bad); }

function renderMenu() {
  document.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', settings[seg.dataset.opt] === b.dataset.v)));
  document.querySelectorAll('[data-show]').forEach(el => el.style.display = el.dataset.show.split(' ').includes(settings.mode) ? '' : 'none');
  document.querySelectorAll('.picker').forEach(pk => pk.querySelectorAll('.tcard').forEach(c => c.classList.toggle('on', settings[pk.dataset.opt] === c.dataset.v)));
  $('#p1label').textContent = settings.mode === 'online' ? 'Your tank' : settings.mode === 'cpu' ? 'Your tank (Blue)' : 'Blue tank';
  $('#p2label').textContent = settings.mode === 'cpu' ? 'CPU tank (Orange)' : 'Orange tank';
  const startBtn = $('#start');
  startBtn.textContent = settings.mode === 'online' ? (Net.role === 'guest' ? 'WAITING FOR HOST…' : 'START ONLINE MATCH') : 'START';
  startBtn.disabled = settings.mode === 'online' && !(Net.role === 'host' && Net.peerCk);
}
function buildMenu() {
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    Sfx.init(); const opt = b.parentElement.dataset.opt; settings[opt] = b.dataset.v; saveSettings(); Sfx.ui(); b.blur();
    if (opt === 'sound') Sfx.setEnabled(settings.sound === 'on' && mode !== 'demo');
    renderMenu(); updateHelp();
  }));
  document.querySelectorAll('.picker').forEach((pk, pi) => {
    pk.innerHTML = CLASS_KEYS.map(k => {
      const C = CLASSES[k], bars = ['Speed', 'Armour', 'Damage', 'Fire rate'].map((l, i) => `<div class="stat"><span>${l}</span><i style="--v:${C.stats[i] * 20}%"></i></div>`).join('');
      return `<button class="tcard" data-v="${k}"><canvas width="100" height="104"></canvas><b>${C.name}</b><small>${C.desc}</small>${bars}</button>`;
    }).join('');
    pk.querySelectorAll('.tcard').forEach(c => {
      tankPreview(c.querySelector('canvas'), c.dataset.v, pi);
      c.addEventListener('click', () => {
        Sfx.init(); settings[pk.dataset.opt] = c.dataset.v; saveSettings(); Sfx.ui(); c.blur(); renderMenu();
        if (pk.dataset.opt === 'p1' && Net.role === 'guest' && Net.peer) Net.send({t:'hello', ck:settings.p1});
      });
    });
  });
  $('#start').addEventListener('click', e => { e.currentTarget.blur(); startFromMenu(); });
  $('#host').addEventListener('click', e => {
    e.currentTarget.blur(); Sfx.init();
    const code = Array.from({length:4}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('');
    setNetStatus('Connecting…'); Net.connect(code, 'host'); renderMenu();
  });
  $('#join').addEventListener('click', e => {
    e.currentTarget.blur(); Sfx.init();
    const code = $('#code').value.trim().toUpperCase();
    if (code.length !== 4) { setNetStatus('Enter the 4-letter room code from the host.', true); return; }
    setNetStatus('Connecting…'); Net.connect(code, 'join'); renderMenu();
  });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#join').click(); });
  $('#resume').addEventListener('click', () => togglePause(false));
  $('#quit').addEventListener('click', quitToMenu);
}
function startFromMenu() {
  Sfx.init();
  const o = {turret:settings.turret, map:settings.map, aim:settings.aim};
  if (settings.mode === 'online') {
    if (Net.role === 'host' && Net.peer && Net.peerCk) {
      players[0].ck = settings.p1; players[1].ck = Net.peerCk;
      Net.send({t:'start', ck:[players[0].ck, players[1].ck], o});
      hideMenu(); startMatch('online', o);
    } else setNetStatus(Net.role === 'guest' ? 'Waiting for the host to press START…' : Net.role === 'host' ? 'Waiting for an opponent to join…' : 'Host a game, or type a room code and join.');
    return;
  }
  players[0].ck = settings.p1; players[1].ck = settings.p2;
  hideMenu(); startMatch(settings.mode, o);
}
function rematch() {
  if (mode === 'online') { if (Net.role !== 'host') return; Net.send({t:'start', ck:[players[0].ck, players[1].ck], o:opts}); }
  startMatch(mode, opts);
}
function togglePause(force) {
  if (mode === 'demo' || menuOpen()) return;
  const show = force ?? pauseEl.classList.contains('hidden');
  pauseEl.classList.toggle('hidden', !show);
  $('#pauseNote').textContent = mode === 'online' ? 'Online matches keep running while this is open.' : '';
  if (mode !== 'online') { paused = show; Sfx.setMuted(show); }
}
function quitToMenu() {
  hidePause(); paused = false;
  if (mode === 'online') { Net.close(); setNetStatus(''); }
  startDemo(); showMenu();
}
function updateHelp() {
  const free = (menuOpen() ? settings.turret : opts.turret) === 'free', m = menuOpen() ? settings.mode : mode;
  const k = (...a) => a.map(x => `<kbd>${x}</kbd>`).join('');
  const one = (cls, name, s) => `<div class="${cls}"><b>${name}</b> ${s}</div>`;
  const p1 = `${k('W', 'S')} drive · ${k('A', 'D')} turn · ${free ? k('Q', 'E') + ' turret · ' : ''}${k('Space')} fire · ${k('F')} mine`;
  const p2 = `${k('↑', '↓')} drive · ${k('←', '→')} turn · ${free ? k(',', '.') + ' turret · ' : ''}${k('Enter')} fire · ${k('R-Shift')} mine`;
  const pad = `<div class="pad"><b>Controller</b> left stick drive · ${free ? 'right stick aim · ' : ''}A / RT fire · B / LB mine · Start pause</div>`;
  let html;
  if (m === 'local') html = one('p1', 'BLUE', p1) + one('p2', 'ORANGE', p2) + pad;
  else html = one('p1', m === 'cpu' ? 'YOU' : 'YOU', p1 + ` &nbsp;(or ${k('↑', '↓', '←', '→')} ${k('Enter')})`) + pad;
  $('#help').innerHTML = html + `<div class="misc">${k('Esc')} pause · ${k('M')} sound on/off</div>`;
}

// ---------- events ----------
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Slash', 'Comma', 'Period']);
addEventListener('keydown', e => {
  Sfx.init();
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true; tapped[e.code] = true;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyM') { settings.sound = settings.sound === 'on' ? 'off' : 'on'; saveSettings(); Sfx.setEnabled(settings.sound === 'on' && mode !== 'demo'); toast(settings.sound === 'on' ? 'Sound on' : 'Sound off'); renderMenu(); }
  if (menuOpen()) { if (e.code === 'Space' || e.code === 'Enter') startFromMenu(); return; }
  if (e.code === 'Escape') { if (state === 'matchover' && mode !== 'online') quitToMenu(); else togglePause(); }
  if (state === 'matchover' && (e.code === 'Space' || e.code === 'Enter') && pauseEl.classList.contains('hidden')) rematch();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('mousedown', () => Sfx.init());
addEventListener('gamepadconnected', e => toast(`Controller ${e.gamepad.index + 1} connected`));
function pollPads() {
  pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && g.connected) : [];
  pads.forEach((g, i) => {
    const prev = padPrev[i] || [], pressed = b => !!(g.buttons[b] && g.buttons[b].pressed), edge = b => pressed(b) && !prev[b];
    if (edge(9) || edge(0)) Sfx.init();
    if (menuOpen()) { if (edge(9) || edge(0)) startFromMenu(); }
    else if (state === 'matchover' && (edge(0) || edge(9))) rematch();
    else if (edge(9)) togglePause();
    padPrev[i] = g.buttons.map(b => b.pressed);
  });
}

Net.on('joined', () => {
  if (Net.role === 'host') setNetStatus(`Room <b class="code">${Net.room}</b> is open. Waiting for an opponent…<br>On their computer they open this page from your server (for example <b>http://YOUR-IP:3000</b>), pick Online and join <b>${Net.room}</b>.`);
  else setNetStatus('Joined! Waiting for the host to press START…');
  renderMenu();
});
Net.on('peer', () => {
  Net.peer = true;
  if (Net.role === 'guest') Net.send({t:'hello', ck:settings.p1}); else setNetStatus('Opponent connected…');
  renderMenu();
});
Net.on('hello', m => {
  if (Net.role !== 'host') return;
  Net.peerCk = CLASSES[m.ck] ? m.ck : 'striker';
  setNetStatus(`Opponent joined with the <b>${CLASSES[Net.peerCk].name}</b>. Press START!`); renderMenu();
});
Net.on('start', m => {
  if (Net.role !== 'guest') return;
  players[0].ck = CLASSES[m.ck[0]] ? m.ck[0] : 'striker'; players[1].ck = CLASSES[m.ck[1]] ? m.ck[1] : 'striker';
  hideMenu(); startMatch('online', m.o || {});
});
Net.on('s', m => { if (Net.role === 'guest' && mode === 'online') applySnap(m); });
Net.on('in', m => { if (Net.role === 'host') Net.remoteIn = m.i; });
Net.on('peerleft', () => {
  Net.peer = false; Net.peerCk = null; Net.remoteIn = null;
  if (mode === 'online') { toast('Your opponent left the match'); quitToMenu(); }
  else setNetStatus(Net.role === 'host' ? `Opponent left. Room <b class="code">${Net.room}</b> is still open.` : 'The host left.', true);
  renderMenu();
});
Net.on('error', m => { setNetStatus(m.msg, true); renderMenu(); });
Net.on('closed', () => { if (mode === 'online') { toast('Connection lost'); quitToMenu(); } setNetStatus('Disconnected from the server.', true); renderMenu(); });

// ---------- main loop ----------
let last = performance.now(), sendT = 0;
function frame(t) {
  const dt = Math.min(.033, Math.max(0, (t - last) / 1000)); last = t;
  pollPads();
  if (mode === 'online' && Net.role === 'guest') { if (guestTick(dt)) for (const k in tapped) delete tapped[k]; }
  else { if (!paused) update(dt); for (const k in tapped) delete tapped[k]; }
  if (mode === 'online' && Net.role === 'host') { sendT -= dt; if (sendT <= 0) { sendT = 1 / 30; Net.send(snapshot()); } }
  if (!paused) { cosmetics(dt); updateParticles(dt); shake = Math.max(0, shake - 45 * dt); }
  updateCamera(dt);
  const live = mode !== 'demo' && !paused && state !== 'matchover';
  players.forEach((p, i) => Sfx.engine(i, clamp(p.spd / 250, 0, 1), pan(p.x), live && p.alive));
  draw(t);
  requestAnimationFrame(frame);
}
buildMenu(); startDemo(); showMenu();
requestAnimationFrame(frame);
