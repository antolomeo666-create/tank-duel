// ============ GAME: rules, input, rounds, HUD, menu, main loop ============
const cvs = document.getElementById('c'), ctx = cvs.getContext('2d');
let W = cvs.width, H = cvs.height;   // the canvas widens in fullscreen to match the screen
const FONT = "'Black Ops One', Impact, system-ui, sans-serif";
const WIN_ROUNDS = 3, TURRET_SPEED = 4.5;
const winRounds = () => opts.rounds || WIN_ROUNDS;
const vsAI = () => mode === 'cpu' || mode === 'campaign';
const zoneDelay = () => opts.zoneDelay ?? ZONE_DELAY;
const ZONE_DELAY = 45, ZONE_TIME = 50, ZONE_MIN = 170, ZONE_DPS = 12, ZONE_R0 = Math.hypot(WW, WH) / 2 + 40;
const TEAM = [{name:'BLUE', color:'#4fc3f7', ui:'#a9e4ff'}, {name:'ORANGE', color:'#ff7043', ui:'#ffb08f'}];
const KEYSETS = [
  {f:['KeyW'], b:['KeyS'], l:['KeyA'], r:['KeyD'], tl:['KeyQ'], tr:['KeyE'], fire:['Space'], sp:['KeyF', 'ShiftLeft'], ab:['KeyG']},
  {f:['ArrowUp'], b:['ArrowDown'], l:['ArrowLeft'], r:['ArrowRight'], tl:['Comma'], tr:['Period'], fire:['Enter', 'NumpadEnter'], sp:['ShiftRight', 'Slash'], ab:['ControlRight', 'Numpad0']},
];
const NOINPUT = Object.freeze({turn:0, move:0, tturn:0, aim:null, fire:false, special:false, ult:false});
const AIR_DELAY = 1.7, EMP_R = 420;

// ---------- settings (remembered between visits) ----------
const settings = {mode:'local', diff:'medium', map:'random', turret:'fixed', aim:'on', sound:'on', music:'on', p1:'striker', p2:'striker', a1:'air', a2:'emp', mission:0, act:0, paint:'olive'};
try { Object.assign(settings, JSON.parse(localStorage.getItem('tankduel-v2') || '{}')); } catch (e) {}
for (const k of ['p1', 'p2']) if (!CLASSES[settings[k]]) settings[k] = settings[k] === 'heavy' ? 'maus' : 'striker';
for (const k of ['a1', 'a2']) if (!ABILITIES[settings[k]]) settings[k] = 'air';
const saveSettings = () => { try { localStorage.setItem('tankduel-v2', JSON.stringify(settings)); } catch (e) {} };
let opts = {turret:'free', map:'random', aim:'off'};   // options of the running match

// ---------- state ----------
let mode = 'demo', state = 'countdown', timer = 0, msg = '', msgIdx = -1, paused = false, roundNo = 0;
let mapIdx = 0, MAP = null, walls = [], blocks = [];
let strikes = [], bullets = [], powerups = [], mines = [], puTimer = 0, rt = 0, zoneWarned = false, nextId = 1, lastBeep = 0;
const zone = {x:WW / 2, y:WH / 2, r:ZONE_R0};
const cam = {x:WW / 2, y:WH / 2, z:Math.min(W / WW, H / WH)};
let shake = 0, events = [];
const players = [0, 1].map(i => ({idx:i, ...TEAM[i], pal:PALS[i], wins:0, ck:'striker', fx:{triple:0, speed:0, bounce:0}, ai:{}, hp:100, maxhp:100}));
const myIdx = () => Net.role === 'guest' ? 1 : 0;
let vig = null;
function buildVig() {
  vig = mk(W, H);
  const v = vig.getContext('2d'), gr = v.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)'); v.fillStyle = gr; v.fillRect(0, 0, W, H);
  const sun = v.createLinearGradient(0, 0, W, H); sun.addColorStop(0, 'rgba(255,236,200,.07)'); sun.addColorStop(1, 'rgba(20,30,60,.08)');
  v.fillStyle = sun; v.fillRect(0, 0, W, H);
}
buildVig();
// fullscreen: match the screen's shape exactly (no black bars), keeping 750 px of height
function fitCanvas() {
  const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const w = fs ? clamp(Math.round(750 * innerWidth / innerHeight), 900, 2400) : 1200;
  if (w === W && cvs.height === 750) return;
  W = cvs.width = w; H = cvs.height = 750;
  buildVig(); darkC = null;
}
addEventListener('resize', () => setTimeout(fitCanvas, 50));

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
// turret pivot (the Maus turret sits further back on the hull)
function pivot(p) { const t = (CLASSES[p.ck].g.toff || 0) * TS; return {x:p.x + Math.cos(p.a) * t, y:p.y + Math.sin(p.a) * t}; }
function barrelBlocked(p, a) {
  const L = CLASSES[p.ck].g.bl * TS + 4, o = pivot(p);
  for (let s = 12; s <= L; s += 7) if (obstacleAt(o.x + Math.cos(a) * s, o.y + Math.sin(a) * s, 2)) return true;
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
    const o = pivot(p); p.mside = ((x - o.x) * -Math.sin(p.ta) + (y - o.y) * Math.cos(p.ta)) / TS;
    spray('spark', x, y, 6, 150, 380, {life:[.08, .22]}, a, .3);
    spray('smoke', x, y, 7, 15, 90, {size:[5, 10], grow:30, life:[.6, 1.2], drag:.9, c:'#8a8680'}, a, .5);
    spray('dust', x, y, 5, 30, 90, {size:[5, 9], grow:28, life:[.5, 1], drag:.9, c:MAP.th.dust}, a + Math.PI, 1.2);
    if (CLASSES[p.ck].rocket) Sfx.rocket(pan(x)); else if (CLASSES[p.ck].bounces === 0) Sfx.rail(pan(x)); else Sfx.fire(pan(x), p.ck === 'maus');
    shake = Math.max(shake, p.ck === 'maus' ? 7 : 3);
  },
  bounce(x, y) {
    spray('spark', x, y, 8, 80, 300, {life:[.15, .4]});
    spray('dust', x, y, 4, 10, 60, {size:[4, 8], grow:22, life:[.5, 1], drag:.92, c:MAP.th.dust});
    spray('dirt', x, y, 3, 40, 140, {size:[1, 2], life:[.6, 1.2], drag:.88, c:'#4a4038'});
    dc.fillStyle = 'rgba(20,16,10,.35)'; dc.beginPath(); dc.arc(x, y, 4, 0, 7); dc.fill();
    Sfx.ricochet(pan(x));
  },
  hit(x, y, pi) {
    players[pi].flash = .15; shake = Math.max(shake, 10);
    spray('spark', x, y, 16, 120, 420, {life:[.15, .45]});
    spray('fire', x, y, 5, 20, 90, {size:[6, 12], grow:-14, life:[.2, .4]});
    spray('smoke', x, y, 4, 10, 60, {size:[6, 10], grow:24, life:[.6, 1.1], drag:.93, c:'#3a3a3a'});
    spray('debris', x, y, 5, 100, 260, {size:[2, 4], life:[1.5, 2.5], drag:.88, c:'#2a2a2a'});
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
    spray('smoke', x, y, 34, 20, 140, {size:[14, 30], grow:40, life:[1.5, 3], drag:.95, c:'#252321'});
    spray('dust', x, y, 14, 60, 200, {size:[10, 18], grow:40, life:[1, 2], drag:.92, c:MAP.th.dust});
    spray('dirt', x, y, 24, 120, 380, {size:[1.5, 3.5], life:[1.5, 3], drag:.9, c:'#3e342a'});
    spray('debris', x, y, 22, 150, 420, {size:[2, 6], life:[2, 3.5], drag:.88, c:'#262626'});
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
  airwarn(x, y, pi) {
    P('text', x, y - 90, {vy:-20, drag:.97, life:1.6, txt:'AIRSTRIKE INBOUND', c:'#ff8a65'});
    Sfx.jet();
  },
  bomb(x, y) {
    P('flash', x, y, {size:240, life:.25, c:'#ffd9a0'});
    P('ring', x, y, {size:16, grow:320, life:.3, c:'#ffcf8a', drag:1});
    spray('fire', x, y, 16, 30, 200, {size:[12, 26], grow:-24, life:[.25, .6], drag:.9});
    spray('smoke', x, y, 16, 20, 120, {size:[12, 24], grow:34, life:[1.2, 2.4], drag:.95, c:'#2a2725'});
    spray('dirt', x, y, 16, 120, 360, {size:[1.5, 3.5], life:[1.2, 2.5], drag:.9, c:'#3e342a'});
    spray('dust', x, y, 8, 60, 180, {size:[10, 18], grow:36, life:[.8, 1.6], drag:.92, c:MAP.th.dust});
    scorch(x, y, 50); shake = Math.max(shake, 20); Sfx.whistle(pan(x)); Sfx.mine(pan(x));
  },
  emp(x, y) {
    P('ring', x, y, {size:20, grow:EMP_R * 2.6, life:.4, c:'#90caf9', drag:1});
    P('ring', x, y, {size:10, grow:EMP_R * 1.6, life:.55, c:'#e3f2fd', drag:1});
    P('flash', x, y, {size:220, life:.3, c:'#64b5f6'});
    spray('spark', x, y, 40, 200, 700, {life:[.2, .5], c:'#bbdefb'});
    Sfx.zap(pan(x));
  },
  stun(x, y) { P('text', x, y - 50, {vy:-30, drag:.96, life:1.3, txt:'FROZEN!', c:'#90caf9'}); },
  over(x, y) { P('ring', x, y, {size:20, grow:160, life:.4, c:'#ffb74d', drag:1}); P('text', x, y - 50, {vy:-30, drag:.96, life:1.2, txt:'OVERDRIVE', c:'#ffb74d'}); Sfx.rev(pan(x)); },
  repair(x, y) { P('ring', x, y, {size:40, grow:-60, life:.6, c:'#81c784', drag:1}); spray('spark', x, y, 30, 40, 160, {life:[.4, .9], c:'#a5d6a7', drag:.95}); P('text', x, y - 50, {vy:-30, drag:.96, life:1.2, txt:'+REPAIR', c:'#81c784'}); Sfx.heal(pan(x)); },
  dome(x, y) { P('ring', x, y, {size:10, grow:150, life:.45, c:'#ffe082', drag:1}); P('text', x, y - 55, {vy:-30, drag:.96, life:1.2, txt:'IRON DOME', c:'#ffd54f'}); Sfx.dome(pan(x)); },
  domehit(x, y) { spray('spark', x, y, 12, 100, 300, {life:[.15, .35], c:'#ffe082'}); Sfx.domeHit(pan(x)); },
  ready(pi) { if (isHuman(players[pi])) Sfx.ready(); },
  rboom(x, y) {
    P('flash', x, y, {size:120, life:.18});
    spray('fire', x, y, 8, 20, 120, {size:[7, 14], grow:-18, life:[.2, .4], drag:.9});
    spray('smoke', x, y, 6, 15, 70, {size:[7, 12], grow:26, life:[.6, 1.2], drag:.94, c:'#3a3633'});
    spray('spark', x, y, 10, 100, 340, {life:[.12, .3]});
    scorch(x, y, 18); Sfx.hit(pan(x));
  },
  shell(x, y) {   // howitzer splash
    P('flash', x, y, {size:200, life:.22, c:'#ffd9a0'});
    P('ring', x, y, {size:14, grow:300, life:.28, c:'#ffcf8a', drag:1});
    spray('fire', x, y, 14, 30, 170, {size:[10, 22], grow:-22, life:[.25, .5], drag:.9});
    spray('smoke', x, y, 12, 20, 90, {size:[8, 18], grow:30, life:[.8, 1.6], drag:.95, c:'#3a3a3a'});
    spray('spark', x, y, 18, 150, 450, {life:[.15, .4], drag:.9});
    scorch(x, y, 38); shake = Math.max(shake, 12); Sfx.mine(pan(x));
  },
};
function fx(name, ...a) {
  FX[name](...a);
  if (mode === 'online' && Net.role === 'host') events.push([name, ...a.map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v)]);
}

// ---------- rounds ----------
function startMatch(m, o) {
  mode = m; opts = {...o}; paused = false; roundNo = 0;
  players.forEach(p => p.wins = 0);
  players[0].pal = m === 'online' || m === 'demo' ? PALS[0] : PAINTS[paintOk(settings.paint)]; players[1].pal = PALS[1];
  players[0].name = m === 'campaign' ? 'YOU' : 'BLUE'; players[1].name = m === 'cpu' ? 'CPU' : m === 'campaign' ? opts.enemyName : 'ORANGE';
  Sfx.setEnabled(settings.sound === 'on' && m !== 'demo'); Sfx.setMuted(false);
  hidePause(); updateHelp();
  newRound();
}
function startDemo() {
  players[0].ck = CLASS_KEYS[Math.random() * CLASS_KEYS.length | 0]; players[1].ck = CLASS_KEYS[Math.random() * CLASS_KEYS.length | 0];
  players.forEach(p => p.ab = ABILITY_KEYS[Math.random() * ABILITY_KEYS.length | 0]);
  startMatch('demo', {turret:'free', map:'random', aim:'off'});
}
function newRound() {
  roundNo++;
  const fixed = MAPS.findIndex(m => m.id === opts.map);
  loadMap(fixed >= 0 ? fixed : Math.random() * MAPS.length | 0);
  players.forEach(resetPlayer);
  bullets = []; powerups = []; mines = []; particles = []; events = []; strikes = [];
  if (opts.mines) placeMines(opts.mines);
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
  p.mines = C.startMines || 0; p.mineT = 0; p.calm = 0; p.regening = false; p.side = 1; p.mside = 0;
  p.charge = 0; p.emp = 0; p.over = 0; p.dome = 0; p.lastUlt = false;
  if (mode === 'campaign' && p.idx === 1 && opts.enemyHp > 1) { p.maxhp = Math.round(C.hp * opts.enemyHp); p.hp = p.maxhp; }
}

// ---------- input ----------
const keys = {}, tapped = {};   // tapped: keys pressed since the last frame, so very quick taps are never missed
const anyKey = arr => arr.some(k => keys[k] || tapped[k]);
function keyInput(set) {
  return {turn:(anyKey(set.r) ? 1 : 0) - (anyKey(set.l) ? 1 : 0), move:(anyKey(set.f) ? 1 : 0) - (anyKey(set.b) ? .6 : 0),
    tturn:(anyKey(set.tr) ? 1 : 0) - (anyKey(set.tl) ? 1 : 0), aim:null, fire:anyKey(set.fire), special:anyKey(set.sp), ult:anyKey(set.ab)};
}
function merge(a, b) {
  return {turn:clamp(a.turn + b.turn, -1, 1), move:clamp(a.move + b.move, -.6, 1), tturn:clamp(a.tturn + b.tturn, -1, 1),
    aim:a.aim ?? b.aim, fire:a.fire || b.fire, special:a.special || b.special, ult:a.ult || b.ult};
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
  return {turn, move, tturn:0, aim, fire:btn(0) || btn(5) || btn(7), special:btn(1) || btn(4) || btn(6), ult:btn(3) || btn(2)};
}
const localInput = p => merge(merge(keyInput(KEYSETS[0]), keyInput(KEYSETS[1])), padInput(pads[0], p));
function sanitize(i) {
  if (!i) return NOINPUT;
  return {turn:clamp(+i.turn || 0, -1, 1), move:clamp(+i.move || 0, -.6, 1), tturn:clamp(+i.tturn || 0, -1, 1),
    aim:typeof i.aim === 'number' && isFinite(i.aim) ? i.aim : null, fire:!!i.fire, special:!!i.special, ult:!!i.ult};
}
function getInput(p, dt) {
  const foe = players[1 - p.idx];
  if (mode === 'demo') return aiThink(p, foe, dt, AI_DIFF.medium);
  if (vsAI()) return p.idx === 1 ? aiThink(p, foe, dt, AI_DIFF[opts.diff || settings.diff]) : localInput(p);
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
    zone.r = ZONE_R0 + (ZONE_MIN - ZONE_R0) * clamp((rt - zoneDelay()) / ZONE_TIME, 0, 1);
    if (rt >= zoneDelay() && !zoneWarned) { zoneWarned = true; fx('zone'); }
    puTimer -= dt;
    if (puTimer <= 0) { puTimer = rand(7, 11); if (powerups.length < 2 && !opts.noPU) spawnPU(); }
  }
  for (const p of players) simPlayer(p, state === 'play' ? getInput(p, dt) : NOINPUT, dt);
  updateBullets(dt); updateMines(dt); updateStrikes(dt); pickups(); checkRoundEnd();
}
function simPlayer(p, inp, dt) {
  p.cool -= dt; p.hurtT -= dt; p.emp = Math.max(0, p.emp - dt); p.over = Math.max(0, p.over - dt); p.dome = Math.max(0, p.dome - dt);
  for (const k in p.fx) p.fx[k] = Math.max(0, p.fx[k] - dt);
  if (!p.alive) return;
  if (state === 'play') { const was = p.charge; p.charge = Math.min(ABILITY_TIME, p.charge + dt * (p.idx === 1 && opts.enemyCharge ? ABILITY_TIME / opts.enemyCharge : 1)); if (was < ABILITY_TIME && p.charge >= ABILITY_TIME) fx('ready', p.idx); }
  if (p.emp > 0) inp = NOINPUT;   // frozen by an EMP
  const C = CLASSES[p.ck], boost = p.fx.speed > 0;
  p.calm += dt; p.regening = false;
  if (C.regen && state === 'play' && p.calm > 3 && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + C.regen * dt); p.regening = true; }
  if (C.mineRegen && state === 'play' && p.mines < C.startMines) { p.mineT += dt; if (p.mineT >= C.mineRegen) { p.mineT = 0; p.mines++; } }
  const da = inp.turn * C.turn * (boost ? 1.25 : 1) * dt; p.a += da;
  const mv = clamp(inp.move, -.6, 1), sp = C.speed * (boost ? 1.5 : 1) * (p.over > 0 ? 1.35 : 1);
  const ox = p.x, oy = p.y, nx = p.x + Math.cos(p.a) * sp * mv * dt, ny = p.y + Math.sin(p.a) * sp * mv * dt;
  if (!blocked(nx, p.y, C.r, p)) p.x = nx;
  if (!blocked(p.x, ny, C.r, p)) p.y = ny;
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
  if (opts.turret === 'free') {
    p.ta += da;
    if (inp.aim !== null) p.ta += clamp(angDiff(inp.aim, p.ta), -TURRET_SPEED * dt, TURRET_SPEED * dt);
    else p.ta += inp.tturn * TURRET_SPEED * dt;
  } else p.ta = p.a;
  if (state === 'play' && p.dome <= 0 && Math.hypot(p.x - zone.x, p.y - zone.y) > zone.r) {
    p.hp -= ZONE_DPS * dt; p.hurtT = .3;
    if (p.hp <= 0) kill(p);
  }
  if (inp.fire && p.cool <= 0 && state === 'play') fire(p);
  if (inp.special && !p.lastSp && state === 'play') dropMine(p);
  p.lastSp = inp.special;
  if (inp.ult && !p.lastUlt && state === 'play' && p.charge >= ABILITY_TIME) useAbility(p);
  p.lastUlt = inp.ult;
}
// ---------- abilities ----------
function useAbility(p) {
  const foe = players[1 - p.idx]; p.charge = 0;
  if (p.ab === 'air') {
    const tx = clamp((foe.alive ? foe.x + foe.vx * .6 : p.x) + rand(-30, 30), 60, WW - 60), ty = clamp((foe.alive ? foe.y + foe.vy * .6 : p.y) + rand(-30, 30), 60, WH - 60);
    strikes.push({id:nextId++, o:p.idx, tx, ty, ang:Math.atan2(ty - p.y, tx - p.x) + rand(-.4, .4), t:0, done:[0, 0, 0, 0, 0]});
    fx('airwarn', tx, ty, p.idx);
  } else if (p.ab === 'emp') {
    fx('emp', p.x, p.y);
    if (foe.alive && foe.dome <= 0 && Math.hypot(foe.x - p.x, foe.y - p.y) < EMP_R) { foe.emp = 2.5; fx('stun', foe.x, foe.y); }
  } else if (p.ab === 'over') { p.over = 6; fx('over', p.x, p.y); }
  else if (p.ab === 'repair') { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * .5); fx('repair', p.x, p.y); }
  else if (p.ab === 'dome') { p.dome = 3.5; fx('dome', p.x, p.y); }
}
const bombPoint = (s, i) => [s.tx + Math.cos(s.ang) * (i - 2) * 58, s.ty + Math.sin(s.ang) * (i - 2) * 58];
function updateStrikes(dt) {
  for (const s of strikes) {
    s.t += dt;
    for (let i = 0; i < 5; i++) if (!s.done[i] && s.t >= AIR_DELAY + i * .11) { s.done[i] = 1; const [x, y] = bombPoint(s, i); bombAt(x, y); }
  }
  strikes = strikes.filter(s => s.t < AIR_DELAY + 2.5);
}
function bombAt(x, y) {
  fx('bomb', x, y);
  for (const p of players) {
    if (!p.alive) continue;
    const d = Math.max(0, Math.hypot(p.x - x, p.y - y) - CLASSES[p.ck].r);
    if (d < 70) damage(p, Math.round(30 * (1 - d / 70 * .7)), p.x, p.y);
  }
  for (const b of blocks) if (b.hp > 0 && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < 65) damageBlock(b, 2);
  for (const m of mines) if (!m.dead && Math.hypot(m.x - x, m.y - y) < 80) detonate(m);
}
function fire(p) {
  const C = CLASSES[p.ck]; p.cool = C.reload * (p.over > 0 ? .5 : 1);
  const L = C.g.bl * TS + 4, a = p.ta, o = pivot(p);
  let side = 0;
  if (C.twin) { p.side = -p.side; side = p.side * (C.podOff || C.g.bw / 2 + 1.5) * TS; }
  const bx = o.x + Math.cos(a) * L - Math.sin(a) * side, by = o.y + Math.sin(a) * L + Math.cos(a) * side;
  fx('fire', bx, by, a, p.idx);
  if (barrelBlocked(p, a) || obstacleAt(bx, by, C.br)) return;   // barrel pressed into a wall
  let angs = C.pellets ? Array.from({length:C.pellets}, (_, i) => (i / (C.pellets - 1) - .5) * 2 * C.spread + rand(-.03, .03)) : [0];
  if (p.fx.triple > 0) angs = C.pellets ? [...angs, -C.spread - .12, C.spread + .12] : [-.16, 0, .16];
  for (const s of angs) {
    const sp = C.bspeed * (C.pellets ? rand(.9, 1.1) : 1);
    bullets.push({id:nextId++, x:bx, y:by, vx:Math.cos(a + s) * sp, vy:Math.sin(a + s) * sp, o:p.idx,
      bounces:C.bounces + (p.fx.bounce > 0 ? 3 : 0), life:C.life || (C.bspeed > 800 ? 2.2 : 4), dmg:C.dmg, br:C.br, trail:[], bounced:false,
      splash:C.splash || 0, sdmg:C.sdmg || 0, homing:C.homing || 0, rocket:!!C.rocket, maxsp:C.bspeed * 1.8});
  }
}
function hitObstacle(b, o, axis, dt) {
  if (o.max) {   // destructible: the hit that breaks it lets the shell fly through
    if (o.hp <= 1) { damageBlock(o, 1); return; }
    damageBlock(o, 1);
  }
  if (axis === 'x') { b.x -= b.vx * dt; b.vx = -b.vx; } else { b.y -= b.vy * dt; b.vy = -b.vy; }
  b.bounced = true; b.bounces--;
  if (b.bounces < 0) b.life = 0;
  fx(b.rocket ? 'rboom' : 'bounce', b.x, b.y);
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
    if (b.homing) {   // steer towards the enemy and speed up
      const foe = players[1 - b.o], cur = Math.atan2(b.vy, b.vx);
      const na = foe.alive ? cur + clamp(angDiff(Math.atan2(foe.y - b.y, foe.x - b.x), cur), -b.homing * dt, b.homing * dt) : cur;
      const sp = Math.min(b.maxsp, Math.hypot(b.vx, b.vy) + 280 * dt);
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      if (b.life <= 0) fx('rboom', b.x, b.y);
    }
    const steps = Math.max(2, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6));
    for (let i = 0; i < steps && b.life > 0; i++) {
      moveBullet(b, dt / steps);
      if (b.life <= 0) break;
      for (const p of players) {
        if (!p.alive || (p.idx === b.o && !b.bounced)) continue;
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d < CLASSES[p.ck].r + b.br) { b.life = 0; b.hitP = p.idx; if (b.rocket) fx('rboom', b.x, b.y); damage(p, b.dmg, b.x, b.y); break; }
        if (b.splash && p.idx !== b.o) {   // proximity fuse: explodes when a near-miss starts moving away
          if (b.pd !== undefined && d > b.pd && b.pd < CLASSES[p.ck].r + 40) { b.life = 0; break; }
          b.pd = d;
        }
      }
      if (b.life <= 0) break;
      for (const m of mines) if (!m.dead && Math.hypot(m.x - b.x, m.y - b.y) < b.br + 9) { b.life = 0; detonate(m); break; }
    }
  }
  for (const b of bullets) if (b.life <= 0 && b.splash && !b.boomed) splashBoom(b);
  bullets = bullets.filter(b => b.life > 0);
}
function splashBoom(b) {
  b.boomed = true; fx('shell', b.x, b.y);
  for (const p of players) {
    if (!p.alive || p.idx === b.hitP) continue;
    const d = Math.hypot(p.x - b.x, p.y - b.y) - CLASSES[p.ck].r;
    if (d < b.splash) damage(p, Math.round(b.sdmg * (1 - Math.max(0, d) / b.splash * .6)), p.x, p.y);
  }
  for (const o of blocks) if (o.hp > 0 && Math.hypot(o.x + o.w / 2 - b.x, o.y + o.h / 2 - b.y) < b.splash * .75) damageBlock(o, 2);
  for (const m of mines) if (!m.dead && Math.hypot(m.x - b.x, m.y - b.y) < b.splash) detonate(m);
}
function damageBlock(o, n) {
  if (o.hp <= 0) return;
  o.hp -= n;
  if (o.hp <= 0) { o.hp = 0; fx('bbreak', o.j); } else fx('bhit', o.j);
}
function damage(p, amt, x, y) {
  if (!p.alive) return;
  p.calm = 0;
  if (p.dome > 0) { fx('domehit', x, y); return; }
  if (p.shield) { p.shield = false; fx('shield', p.x, p.y); return; }
  p.hp -= amt; fx('hit', x, y, p.idx);
  if (p.hp <= 0) kill(p);
}
function kill(p) { if (!p.alive) return; p.alive = false; p.hp = 0; fx('boom', p.x, p.y); }
function dropMine(p) {
  if (p.mines <= 0) return;
  const C = CLASSES[p.ck], d = C.g.hl * TS + 18, x = p.x - Math.cos(p.a) * d, y = p.y - Math.sin(p.a) * d;
  if (obstacleAt(x, y, 9)) return;
  p.mines--; mines.push({id:nextId++, x, y, o:p.idx, arm:.9, armed:false}); navDirty = true;
  fx('minedrop', x, y);
}
function placeMines(n) {   // buried minefield (campaign)
  for (let k = 0, t = 0; k < n && t < 500; t++) {
    const x = rand(120, WW - 120), y = rand(90, WH - 90);
    if (obstacleAt(x, y, 22) || SPAWNS.some(s => Math.hypot(s.x - x, s.y - y) < 260) || mines.some(m => Math.hypot(m.x - x, m.y - y) < 95)) continue;
    mines.push({id:nextId++, x, y, o:-1, arm:0, armed:true, buried:true}); k++;
  }
  navDirty = true;
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
  if (m.dead) return; m.dead = true; navDirty = true;
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
    if (w.wins >= winRounds()) { state = 'matchover'; timer = 6; msg = `${w.name} WINS THE MATCH`; if (mode === 'campaign') campaignResult(w); if (mode !== 'campaign' || w.idx === 0) fx('win'); }
    else { state = 'roundover'; timer = 3; msg = `${w.name} WINS THE ROUND`; }
  } else { state = 'roundover'; timer = 3; msg = 'DRAW'; msgIdx = -1; }
}

// ---------- online sync (host sends snapshots, guest renders them) ----------
const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;
function snapshot() {
  return {t:'s', st:state, tm:r1(timer), msg, mc:msgIdx, m:mapIdx, rn:roundNo, rt:r1(rt), zr:r1(zone.r), w:players.map(p => p.wins),
    p:players.map(p => [r1(p.x), r1(p.y), r3(p.a), r3(p.ta), r1(p.hp), p.alive ? 1 : 0, r1(p.cool), p.shield ? 1 : 0, p.mines,
      r1(p.fx.triple), r1(p.fx.speed), r1(p.fx.bounce), p.ck, p.hurtT > 0 ? 1 : 0, p.regening ? 1 : 0, p.ab, r1(p.charge), r1(p.emp), r1(p.over), r1(p.dome)]),
    a:strikes.map(s => [s.id, r1(s.tx), r1(s.ty), r3(s.ang), r1(s.t), s.o]),
    b:bullets.map(b => [b.id, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.o, b.br, b.rocket ? 1 : 0]),
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
    p.fx.triple = a[9]; p.fx.speed = a[10]; p.fx.bounce = a[11]; p.hurtT = a[13] ? .3 : 0; p.regening = !!a[14];
    p.ab = ABILITIES[a[15]] ? a[15] : 'air'; p.charge = a[16]; p.emp = a[17]; p.over = a[18]; p.dome = a[19];
    if (p.snapReset) { p.x = p.cx = p.tx; p.y = p.cy = p.ty; p.a = p.ca = p.taa; p.ta = p.tta; p.snapReset = false; }
  });
  const old = {}; for (const b of bullets) old[b.id] = b;
  bullets = s.b.map(([id, x, y, vx, vy, o, br, rk]) => ({id, x, y, vx, vy, o, br, rocket:!!rk, trail:old[id] ? old[id].trail : []}));
  strikes = (s.a || []).map(([id, tx, ty, ang, t, o]) => ({id, tx, ty, ang, t, o}));
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
  for (const s of strikes) s.t += dt;
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
      if (Math.abs(moved) > .5 && Math.random() < dt * 16) P('dust', rx + rand(-8, 8), ry + rand(-8, 8), {vx:rand(-15, 15), vy:rand(-15, 15), size:rand(5, 10), grow:18, life:rand(.6, 1.1), drag:.95, c:MAP.th.dust});
      if (p.fx.speed > 0 && Math.abs(moved) > .5) P('boost', rx, ry, {vx:-Math.cos(p.a) * 60 + rand(-10, 10), vy:-Math.sin(p.a) * 60 + rand(-10, 10), size:rand(4, 7), grow:-6, life:rand(.2, .4)});
      if (p.over > 0 && Math.abs(moved) > .5) P('boost', rx, ry, {vx:-Math.cos(p.a) * 50 + rand(-10, 10), vy:-Math.sin(p.a) * 50 + rand(-10, 10), size:rand(4, 7), grow:-6, life:rand(.2, .35), c:'o'});
      if (p.regening && Math.random() < dt * 14) P('spark', p.x + rand(-14, 14), p.y + rand(-14, 14), {vx:rand(-10, 10), vy:rand(-50, -20), life:rand(.3, .6), c:'#7dff9a', drag:.95});
      if (p.hp < p.maxhp * .35 && Math.random() < dt * 9) P('smoke', rx, ry, {vx:rand(-10, 10), vy:rand(-25, -5), size:rand(5, 9), grow:14, life:rand(.8, 1.5), drag:.97, c:'#4a4a4a'});
    } else {
      if (Math.random() < dt * 16) P('smoke', p.x + rand(-8, 8), p.y + rand(-8, 8), {vx:rand(-10, 10), vy:rand(-30, -10), size:rand(8, 14), grow:18, life:rand(1.2, 2.2), drag:.97, c:'#222'});
      if (Math.random() < dt * 9) P('fire', p.x + rand(-10, 10), p.y + rand(-8, 8), {vy:-20, size:rand(6, 11), grow:-8, life:rand(.3, .6)});
    }
    p.cx = p.x; p.cy = p.y; p.ca = p.a;
  }
}
function rocketTrails(dt) {
  for (const b of bullets) if (b.rocket && Math.random() < dt * 50) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    P('smoke', b.x - b.vx / sp * 8, b.y - b.vy / sp * 8, {vx:rand(-8, 8), vy:rand(-8, 8), size:rand(3, 5), grow:14, life:rand(.5, 1), drag:.95, c:'#9a958c'});
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
const isHuman = p => mode === 'local' || (vsAI() && p.idx === 0) || (mode === 'online' && p.idx === myIdx());
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
  ctx.lineCap = 'round';
  for (const b of bullets) {   // faint smoke trail shows the ricochet path
    const pts = [...b.trail, {x:b.x, y:b.y}];
    ctx.strokeStyle = 'rgba(210,205,195,1)';
    for (let i = 1; i < pts.length; i++) {
      ctx.globalAlpha = i / pts.length * .22; ctx.lineWidth = b.br * 1.4 * (1.6 - i / pts.length);
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) {   // glowing tracer streak, tinted with the team colour
    if (b.rocket) continue;
    const col = players[b.o].color, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, L = Math.min(34, sp * .04) + b.br * 2;
    const s = b.br * 6; ctx.globalAlpha = .45; ctx.drawImage(glow(col), b.x - s / 2, b.y - s / 2, s, s); ctx.globalAlpha = 1;
    const gr = ctx.createLinearGradient(b.x - ux * L, b.y - uy * L, b.x, b.y);
    gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(.6, col); gr.addColorStop(1, '#fffbe8');
    ctx.strokeStyle = gr; ctx.lineWidth = b.br * 1.1;
    ctx.beginPath(); ctx.moveTo(b.x - ux * L, b.y - uy * L); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of bullets) {
    if (!b.rocket) { ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(b.x, b.y, b.br * .6, 0, 7); ctx.fill(); continue; }
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffb347'), -22, -8, 16, 16); ctx.drawImage(glow('#fff2c0'), -16, -4, 8, 8); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#5b6168'; ctx.fillRect(-9, -2, 14, 4);
    ctx.fillStyle = players[b.o].color; ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(9, 0); ctx.lineTo(5, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a3f44'; ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-12, -4.5); ctx.lineTo(-7, -2); ctx.moveTo(-9, 2); ctx.lineTo(-12, 4.5); ctx.lineTo(-7, 2); ctx.fill();
    ctx.restore();
  }
}
// drifting cloud shadows + film grain (made once)
let cloudPat = null, grainPat = null, grainC = null;
function atmosphere() {
  if (!cloudPat) {
    const n = makeNoise(4711, 8);
    const c = texture(512, (x, y) => [0, 0, 0, smooth(.46, .78, fbm(n, x / 64, y / 64, 4)) * 95]);
    cloudPat = ctx.createPattern(c, 'repeat');
    grainC = texture(256, () => { const v = Math.random() * 255; return [v, v, v, 14]; });
    grainPat = ctx.createPattern(grainC, 'repeat');
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
  for (const st of strikes) if (st.t < AIR_DELAY + .6) { ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx + st.tx * s, my + st.ty * s, 9, 0, 7); ctx.stroke(); }
  for (const m of mines) { ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(mx + m.x * s, my + m.y * s, 2, 0, 7); ctx.fill(); }
  for (const b of bullets) { ctx.fillStyle = players[b.o].color; ctx.beginPath(); ctx.arc(mx + b.x * s, my + b.y * s, 1.8, 0, 7); ctx.fill(); }
  for (const p of players) {
    if (opts.night && !isHuman(p) && p.alive && Math.hypot(p.x - players[0].x, p.y - players[0].y) > 330) continue;
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
  ctx.fillStyle = 'rgba(8,10,14,.75)'; ctx.font = '700 10px system-ui'; const lw = ctx.measureText(MAPS[mapIdx].name.toUpperCase()).width + 12;
  rr(ctx, mx, my, lw, 16, 4); ctx.fill(); text(ctx, MAPS[mapIdx].name.toUpperCase(), mx + 6, my + 12, '700 10px system-ui', '#cfd6dd', 'left');
}
function panel(p, right) {
  const C = CLASSES[p.ck], chips = [];
  if (p.shield) chips.push(['shield']);
  if (p.fx.triple > 0) chips.push(['triple', Math.ceil(p.fx.triple) + 's']);
  if (p.fx.speed > 0) chips.push(['speed', Math.ceil(p.fx.speed) + 's']);
  if (p.fx.bounce > 0) chips.push(['bounce', Math.ceil(p.fx.bounce) + 's']);
  if (p.mines > 0) chips.push(['mine', 'x' + p.mines]);
  const w = 290, h = chips.length ? 112 : 90, x = right ? W - w - 16 : 16, y = 14, pad = 14;
  ctx.fillStyle = 'rgba(10,13,18,.84)'; rr(ctx, x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = p.color; ctx.globalAlpha = .9; rr(ctx, x, y, 4, h, 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = p.hurtT > 0 ? '#ff5a64' : 'rgba(255,255,255,.1)'; ctx.lineWidth = p.hurtT > 0 ? 2 : 1; rr(ctx, x, y, w, h, 10); ctx.stroke();
  // header: name, tank, round wins
  const you = mode === 'online' && p.idx === myIdx() ? ' (YOU)' : '';
  text(ctx, p.name + you, x + pad, y + 23, `18px ${FONT}`, p.ui, 'left');
  const nw = ctx.measureText(p.name + you).width;
  text(ctx, C.name.toUpperCase(), x + pad + nw + 9, y + 22, '700 10px system-ui', '#8a94a0', 'left');
  for (let i = 0; i < winRounds(); i++) {
    const cx = x + w - pad - 5 - i * 17, cy = y + 18;
    ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, 7); ctx.fillStyle = i < p.wins ? p.color : 'rgba(255,255,255,.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // health bar
  const bx = x + pad, bw = w - pad * 2, by = y + 33, f = clamp(p.hp / p.maxhp, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(ctx, bx, by, bw, 14, 4); ctx.fill();
  if (f > 0) { rr(ctx, bx, by, Math.max(8, bw * f), 14, 4); const gr = ctx.createLinearGradient(0, by, 0, by + 14); gr.addColorStop(0, p.ui); gr.addColorStop(1, p.color); ctx.fillStyle = gr; ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  for (let v = 25; v < p.maxhp; v += 25) ctx.fillRect(bx + bw * v / p.maxhp - .5, by + 2, 1, 10);
  text(ctx, `${Math.max(0, Math.ceil(p.hp))} / ${p.maxhp}`, bx + bw - 6, by + 11, '700 10.5px system-ui', '#fff', 'right');
  // gun reload | ability charge, side by side
  const colw = (bw - 14) / 2, ry = y + 60, ax = bx + colw + 14;
  const r = p.alive ? clamp(1 - Math.max(0, p.cool) / (C.reload * (p.over > 0 ? .5 : 1)), 0, 1) : 0, ready = r >= 1;
  text(ctx, 'GUN', bx, ry + 4, '700 9.5px system-ui', '#8a94a0', 'left');
  text(ctx, ready ? 'READY' : 'RELOADING', bx + colw, ry + 4, '700 9.5px system-ui', ready ? '#ffd54f' : '#8a94a0', 'right');
  ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, bx, ry + 9, colw, 6, 3); ctx.fill();
  ctx.fillStyle = ready ? '#ffd54f' : 'rgba(255,255,255,.55)'; rr(ctx, bx, ry + 9, Math.max(6, colw * r), 6, 3); ctx.fill();
  const A = ABILITIES[p.ab] || ABILITIES.air, ch = clamp(p.charge / ABILITY_TIME, 0, 1), rdy = ch >= 1 && p.alive;
  const pulse = rdy ? .65 + Math.sin(performance.now() / 150) * .35 : 1;
  ctx.globalAlpha = pulse; drawAbilityIcon(ctx, p.ab, ax + 5, ry + 1, 5, rdy ? A.col : '#8a94a0'); ctx.globalAlpha = 1;
  text(ctx, A.name.toUpperCase(), ax + 14, ry + 4, '700 9.5px system-ui', rdy ? A.col : '#8a94a0', 'left');
  text(ctx, rdy ? abilityKey(p) : Math.ceil(ABILITY_TIME - p.charge) + 's', ax + colw, ry + 4, '700 9.5px system-ui', rdy ? A.col : '#8a94a0', 'right');
  ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, ax, ry + 9, colw, 6, 3); ctx.fill();
  ctx.fillStyle = A.col; ctx.globalAlpha = rdy ? pulse : .6; rr(ctx, ax, ry + 9, Math.max(6, colw * ch), 6, 3); ctx.fill(); ctx.globalAlpha = 1;
  // active power-ups
  let ix = bx; const iy = y + 94;
  for (const [type, label] of chips) {
    const col = PU_TYPES[type].col, cw = label ? 50 : 22;
    ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(ctx, ix, iy - 9, cw, 18, 5); ctx.fill();
    drawIcon(ctx, type, ix + 11, iy, 5.5, col);
    if (label) text(ctx, label, ix + 22, iy + 4, '700 10.5px system-ui', col, 'left');
    ix += cw + 5;
  }
}
function abilityKey(p) {
  if (vsAI() && p.idx === 1) return 'READY';
  if (mode === 'online') return p.idx === myIdx() ? 'PRESS G' : 'READY';
  return mode === 'local' && p.idx === 1 ? 'R-CTRL' : 'PRESS G';
}
var darkC = null;
function drawNight() {   // night missions: you only see what your lights reach
  if (!darkC) darkC = mk(W, H);
  const d = darkC.getContext('2d'), z = cam.z, S = (x, y) => [(x - cam.x) * z + W / 2, (y - cam.y) * z + H / 2];
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H); d.fillStyle = 'rgba(3,6,16,.9)'; d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => { const [sx, sy] = S(x, y), R = r * z; if (R < 1) return; const g = d.createRadialGradient(sx, sy, 0, sx, sy, R); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .75})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(sx - R, sy - R, R * 2, R * 2); };
  const beam = (p, L, a) => { const [sx, sy] = S(p.x, p.y), R = L * z; d.save(); d.translate(sx, sy); d.rotate(p.a); const g = d.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.beginPath(); d.moveTo(0, 0); d.arc(0, 0, R, -.36, .36); d.closePath(); d.fill(); d.restore(); };
  for (const p of players) {
    if (!p.alive) { hole(p.x, p.y, 120, .8); continue; }   // burning wrecks light the area
    if (isHuman(p)) { hole(p.x, p.y, 210); beam(p, 470, .95); }
    else { hole(p.x, p.y, 45, .6); beam(p, 300, .55); }
  }
  for (const b of bullets) hole(b.x, b.y, b.rocket ? 80 : 55, .9);
  for (const q of particles) if (q.k === 'fire' || q.k === 'flash') hole(q.x, q.y, Math.min(260, q.size * (q.k === 'flash' ? .6 : 2.4)), .85 * q.life / q.max);
  for (const u of powerups) hole(u.x, u.y, 50, .7);
  for (const s of strikes) for (let i = 0; i < 5; i++) { const [x, y] = bombPoint(s, i); hole(x, y, 80, .6); }
  ctx.drawImage(darkC, 0, 0);
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
  const vw = W / 2 / cam.z, vh = H / 2 / cam.z;
  if (cam.x - vw < 0 || cam.x + vw > WW || cam.y - vh < 0 || cam.y + vh > WH) {   // view reaches past the arena: mirror the terrain outward, darkened
    for (let sy = -1; sy <= 1; sy++) for (let sx = -1; sx <= 1; sx++) {
      if (!sx && !sy) continue;
      const x0 = sx * WW, y0 = sy * WH;
      if (x0 > cam.x + vw || x0 + WW < cam.x - vw || y0 > cam.y + vh || y0 + WH < cam.y - vh) continue;   // tile not on screen
      ctx.save(); ctx.translate(sx === 1 ? WW * 2 : 0, sy === 1 ? WH * 2 : 0); ctx.scale(sx ? -1 : 1, sy ? -1 : 1);
      ctx.drawImage(MAP.ground, 0, 0); ctx.restore();
      ctx.fillStyle = 'rgba(6,8,12,.6)'; ctx.fillRect(x0, y0, WW, WH);
    }
  }
  ctx.drawImage(MAP.ground, 0, 0); ctx.drawImage(decal, 0, 0);
  for (const b of blocks) if (b.hp > 0) { ctx.drawImage(b.spr, b.x - 24, b.y - 24); drawBlockDamage(b); }
  for (const m of mines) { ctx.globalAlpha = m.buried ? .42 : 1; drawMine(ctx, m, t, m.o >= 0 ? players[m.o].color : '#8d8d8d'); ctx.globalAlpha = 1; }
  for (const s of strikes) for (let i = 0; i < 5; i++) {   // airstrike target markers
    if (s.t >= AIR_DELAY + i * .11) continue;
    const [x, y] = bombPoint(s, i), blink = (t / 140 | 0) % 2 ? .9 : .45, k = clamp(s.t / AIR_DELAY, 0, 1);
    ctx.save(); ctx.globalAlpha = blink; ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(x, y, 70, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,60,40,${.08 + k * .14})`; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke();
    ctx.restore();
  }
  for (const s of strikes) {   // bomber shadow on the ground
    const d = (s.t - AIR_DELAY - .22) * 1100, px = s.tx + Math.cos(s.ang) * d, py = s.ty + Math.sin(s.ang) * d;
    if (Math.abs(d) > 2600) continue;
    ctx.save(); ctx.translate(px + 70, py + 90); ctx.rotate(s.ang); ctx.globalAlpha = .26;
    ctx.drawImage(planeShadow(players[s.o].color), -70, -70, 140, 140); ctx.restore();
  }
  for (const u of powerups) drawPowerup(ctx, u, t);
  if (opts.aim === 'on' && (state === 'play' || state === 'countdown'))
    for (const p of players) if (p.alive && isHuman(p)) {
      const C = CLASSES[p.ck], L = C.g.bl * TS + 4, o = pivot(p);
      if (barrelBlocked(p, p.ta)) continue;
      const r = simulatePath(o.x + Math.cos(p.ta) * L, o.y + Math.sin(p.ta) * L, p.ta, C.br, C.bounces + (p.fx.bounce > 0 ? 3 : 0), C.life ? C.bspeed * C.life : 900, 6);
      drawPath(ctx, r.pts, p.color);
    }
  for (const p of players) drawTank(ctx, p, t);
  drawParticles(ctx, false);
  drawBullets();
  ctx.globalCompositeOperation = 'lighter'; drawParticles(ctx, true); ctx.globalCompositeOperation = 'source-over';
  for (const s of strikes) {   // the bomber itself, flying high over everything
    const d = (s.t - AIR_DELAY - .22) * 1100, px = s.tx + Math.cos(s.ang) * d, py = s.ty + Math.sin(s.ang) * d;
    if (Math.abs(d) > 2600) continue;
    ctx.save(); ctx.translate(px, py); ctx.rotate(s.ang);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffb347'), -82, -10, 20, 20); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(planeSprite(players[s.o].color), -70, -70, 140, 140); ctx.restore();
  }
  atmosphere();
  ctx.save(); const cx = (t * .012) % 1536, cy = (t * .006) % 1536;
  ctx.translate(cx, cy); ctx.scale(3, 3); ctx.fillStyle = cloudPat; ctx.fillRect(-cx / 3, -cy / 3, WW / 3, WH / 3); ctx.restore();
  drawZone(ctx, zone, t);
  if (mode !== 'demo') for (const p of players) if (p.alive) tankBars(p);
  ctx.restore();
  if (opts.night) drawNight();
  ctx.drawImage(vig, 0, 0);
  ctx.save(); ctx.translate(Math.random() * 256 | 0, Math.random() * 256 | 0); ctx.fillStyle = grainPat; ctx.fillRect(-256, -256, W + 256, H + 256); ctx.restore();
  if (players.some(p => p.hurtT > 0 && isHuman(p))) { ctx.fillStyle = `rgba(200,20,40,${.12 + Math.sin(t / 90) * .05})`; ctx.fillRect(0, 0, W, H); }
  if (mode === 'demo') return;

  drawMinimap(); panel(players[0], false); panel(players[1], true);
  const round = Math.min(winRounds() * 2 - 1, players[0].wins + players[1].wins + (state === 'roundover' || state === 'matchover' ? 0 : 1));
  ctx.fillStyle = 'rgba(10,13,18,.84)'; rr(ctx, W / 2 - 92, 14, 184, 50, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke();
  text(ctx, `ROUND ${round}`, W / 2, 37, `20px ${FONT}`, '#e8e2cf');
  text(ctx, `${players[0].wins}  –  ${players[1].wins}`, W / 2, 55, '700 11px system-ui', '#8a94a0');
  if (state === 'play' || state === 'countdown') {
    const closing = rt >= zoneDelay(), label = !closing ? `ZONE IN ${Math.ceil(zoneDelay() - rt)}s` : zone.r > ZONE_MIN + 1 ? 'ZONE CLOSING' : 'ZONE CLOSED';
    ctx.font = '700 10.5px system-ui'; const zw = ctx.measureText(label).width + 22;
    ctx.fillStyle = closing ? `rgba(150,20,35,${.75 + Math.sin(t / 150) * .2})` : 'rgba(10,13,18,.75)'; rr(ctx, W / 2 - zw / 2, 70, zw, 20, 10); ctx.fill();
    text(ctx, label, W / 2, 84, '700 10.5px system-ui', closing ? '#ffd0d0' : '#9aa4ae');
  }
  if (state === 'countdown') {
    banner(140);
    text(ctx, timer > .4 ? String(Math.ceil(timer - .4)) : 'FIGHT!', W / 2, H / 2 + 32, `92px ${FONT}`, '#ffd54f');
    if (timer > 1.2) text(ctx, mode === 'campaign' ? `MISSION ${opts.mission + 1}: ${CAMPAIGN[opts.mission].title.toUpperCase()}` : MAPS[mapIdx].name, W / 2, H / 2 - 50, `22px ${FONT}`, '#e8e2cf');
  } else if (state === 'roundover') {
    banner(110);
    text(ctx, msg, W / 2, H / 2 + 18, `52px ${FONT}`, msgIdx >= 0 ? players[msgIdx].ui : '#fff');
  } else if (state === 'matchover' && mode === 'campaign' && campResult) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H); banner(campResult.unlocked ? 330 : 240);
    const R = campResult, cy = H / 2 - (R.unlocked ? 70 : 30);
    text(ctx, R.win ? (R.last ? 'CAMPAIGN COMPLETE!' : 'MISSION COMPLETE') : 'MISSION FAILED', W / 2, cy, `60px ${FONT}`, R.win ? '#ffd54f' : '#ff8a80');
    if (R.win) text(ctx, starStr(R.stars), W / 2, cy + 46, '36px system-ui', '#ffd54f');
    else text(ctx, `${opts.enemyName} won this time. Try another tank or ability.`, W / 2, cy + 40, '600 17px system-ui', '#d6dbe0');
    if (R.unlocked) {
      const isTank = !!CLASSES[R.unlocked];
      text(ctx, isTank ? `NEW TANK UNLOCKED: ${CLASSES[R.unlocked].name.toUpperCase()}` : `NEW PAINT UNLOCKED: ${PAINTS[R.unlocked].name.toUpperCase()}`, W / 2, cy + 92, `22px ${FONT}`, '#a9e4ff');
      drawTank(ctx, {ck:isTank ? R.unlocked : players[0].ck, pal:isTank ? players[0].pal : PAINTS[R.unlocked], idx:0, x:W / 2, y:cy + 150, a:-Math.PI / 2, ta:-Math.PI / 2, alive:true, mines:4, tl:0, tr:0, ant:0, recoil:0, muzzle:0, flash:0, color:TEAM[0].color}, t);
    }
    const hint = R.win ? (R.last ? 'SPACE: BACK TO MENU' : 'SPACE: NEXT MISSION   ·   ESC: MENU') : 'SPACE: RETRY   ·   ESC: MENU';
    if (t % 1000 < 650) text(ctx, hint, W / 2, H / 2 + (R.unlocked ? 150 : 90), `22px ${FONT}`, '#ffd54f');
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
function showMenu() { menuEl.classList.remove('hidden'); renderMenu(); updateHelp(); updateMusic(); }
function hideMenu() { menuEl.classList.add('hidden'); updateMusic(); }
// menu music plays only while the main menu is open (browsers need one click or key press first)
function updateMusic() {
  const want = menuOpen() && settings.music === 'on';
  if (want) Sfx.music.start(); else Sfx.music.stop();
  const n = document.getElementById('musicNote'); if (n) n.style.display = want && !Sfx.music.audible ? '' : 'none';
}
function hidePause() { pauseEl.classList.add('hidden'); }
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600); }
function setNetStatus(html, bad) { const el = $('#netStatus'); el.innerHTML = html; el.classList.toggle('bad', !!bad); }

function renderMenu() {
  document.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', settings[seg.dataset.opt] === b.dataset.v)));
  document.querySelectorAll('[data-show]').forEach(el => el.style.display = el.dataset.show.split(' ').includes(settings.mode) ? '' : 'none');
  document.querySelectorAll('.picker').forEach((pk, pi) => {
    const k = settings[pk.dataset.opt], C = CLASSES[k];
    pk.querySelectorAll('.tthumb').forEach(c => c.classList.toggle('on', k === c.dataset.v));
    if (pk.dataset.shown !== k) {
      pk.dataset.shown = k;
      tankPreview(pk.querySelector('.tdetail canvas'), k, pi, pi === 0 && settings.mode !== 'online' ? PAINTS[paintOk(settings.paint)] : null);
      pk.querySelector('.tinfo').innerHTML = `<b>${C.name}</b><small>${C.desc}</small><em>${C.special}</em>` +
        ['Speed', 'Armour', 'Damage', 'Fire rate'].map((l, i) => `<div class="stat"><span>${l}</span><i style="--v:${C.stats[i] * 20}%"></i></div>`).join('');
    }
  });
  for (const k of ['a1', 'a2']) { const el = document.getElementById(k + 'desc'); if (el) el.textContent = ABILITIES[settings[k]].desc + ` (charges in ${ABILITY_TIME} s)`; }
  if (settings.mode === 'campaign' && tankLocked(settings.p1)) settings.p1 = 'striker';
  $('#p1label').textContent = settings.mode === 'local' ? 'Blue player' : settings.mode === 'campaign' ? 'Your tank' : 'You (Blue)';
  $('#p2label').textContent = settings.mode === 'cpu' ? 'CPU opponent (Orange)' : 'Orange player';
  $('#p1keys').textContent = settings.mode === 'local' ? 'W A S D · Space · F · G' : 'W A S D or arrows · Space · F · G';
  $('#p2keys').textContent = settings.mode === 'cpu' ? `${settings.diff[0].toUpperCase() + settings.diff.slice(1)} difficulty` : 'Arrows · Enter · R-Shift · R-Ctrl';
  const startBtn = $('#start');
  startBtn.textContent = settings.mode === 'online' ? (Net.role === 'guest' ? 'WAITING…' : 'START MATCH') : settings.mode === 'campaign' ? 'START MISSION' : 'START';
  document.querySelectorAll('.picker[data-opt=p1] .tthumb').forEach(c => c.classList.toggle('locked', tankLocked(c.dataset.v)));
  renderPaints();
  if (settings.mode === 'campaign') renderCampaign();
  startBtn.disabled = settings.mode === 'online' && !(Net.role === 'host' && Net.peerCk);
}
function buildMenu() {
  document.querySelectorAll('.seg.ab').forEach(seg => {
    seg.innerHTML = ABILITY_KEYS.map(k => `<button data-v="${k}" title="${ABILITIES[k].desc}"><canvas width="28" height="28"></canvas>${ABILITIES[k].name.replace('Field ', '')}</button>`).join('');
    seg.querySelectorAll('button').forEach(b => { const c = b.querySelector('canvas'), x = c.getContext('2d'); drawAbilityIcon(x, b.dataset.v, 14, 14, 11, ABILITIES[b.dataset.v].col); });
  });
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    Sfx.init(); const opt = b.parentElement.dataset.opt; settings[opt] = b.dataset.v; saveSettings(); Sfx.ui(); b.blur();
    if (opt === 'sound') Sfx.setEnabled(settings.sound === 'on' && mode !== 'demo');
    if (opt === 'music') updateMusic();
    renderMenu(); updateHelp();
  }));
  document.querySelectorAll('.picker').forEach((pk, pi) => {
    pk.innerHTML = `<div class="tdetail"><canvas width="110" height="118"></canvas><div class="tinfo"></div></div><div class="tgrid">` +
      CLASS_KEYS.map(k => `<button class="tthumb" data-v="${k}" title="${CLASSES[k].name}: ${CLASSES[k].desc}"><canvas width="64" height="70"></canvas><span>${CLASSES[k].name}</span></button>`).join('') + '</div>';
    pk.querySelectorAll('.tthumb').forEach(c => {
      tankPreview(c.querySelector('canvas'), c.dataset.v, pi);
      c.addEventListener('click', () => {
        if (pk.dataset.opt === 'p1' && tankLocked(c.dataset.v)) { toast('Win campaign missions to unlock this tank'); c.blur(); return; }
        Sfx.init(); settings[pk.dataset.opt] = c.dataset.v; saveSettings(); Sfx.ui(); c.blur(); renderMenu();
        if (pk.dataset.opt === 'p1' && Net.role === 'guest' && Net.peer) Net.send({t:'hello', ck:settings.p1, ab:settings.a1});
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
  if (settings.mode === 'campaign') { launchMission(settings.mission | 0); return; }
  if (settings.mode === 'online') {
    if (Net.role === 'host' && Net.peer && Net.peerCk) {
      players[0].ck = settings.p1; players[1].ck = Net.peerCk; players[0].ab = settings.a1; players[1].ab = Net.peerAb || 'air';
      Net.send({t:'start', ck:[players[0].ck, players[1].ck], ab:[players[0].ab, players[1].ab], o});
      hideMenu(); startMatch('online', o);
    } else setNetStatus(Net.role === 'guest' ? 'Waiting for the host to press START…' : Net.role === 'host' ? 'Waiting for an opponent to join…' : 'Host a game, or type a room code and join.');
    return;
  }
  players[0].ck = settings.p1; players[1].ck = settings.p2; players[0].ab = settings.a1; players[1].ab = settings.a2;
  hideMenu(); startMatch(settings.mode, o);
}
function rematch() {
  if (mode === 'campaign') { campaignNext(); return; }
  if (mode === 'online') { if (Net.role !== 'host') return; Net.send({t:'start', ck:[players[0].ck, players[1].ck], ab:[players[0].ab, players[1].ab], o:opts}); }
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
  const k = (...a) => a.map(x => `<kbd>${x}</kbd>`).join(' ');
  const card = (cls, title, rows) => `<div class="hcard ${cls}"><h3>${title}</h3>${rows.filter(Boolean).map(([l, v]) => `<span>${l}</span><div>${v}</div>`).join('')}</div>`;
  const blue = [['Drive', k('W', 'S')], ['Turn', k('A', 'D')], free && ['Turret', k('Q', 'E')], ['Fire', k('Space')], ['Mine', k('F')], ['Ability', k('G')]];
  const orange = [['Drive', k('↑', '↓')], ['Turn', k('←', '→')], free && ['Turret', k(',', '.')], ['Fire', k('Enter')], ['Mine', k('R-Shift')], ['Ability', k('R-Ctrl')]];
  const pad = [['Drive', 'Left stick'], free && ['Aim', 'Right stick'], ['Fire', 'A / RT'], ['Mine', 'B / LB'], ['Ability', 'Y'], ['Pause', 'Start']];
  const misc = [['Pause', k('Esc')], ['Sound', k('M')]];
  let html;
  if (m === 'local') html = card('c1', 'Blue player', blue) + card('c2', 'Orange player', orange);
  else html = card('c1', 'You (keyboard)', blue.map(r => r && r[0] === 'Drive' ? ['Drive', k('W', 'S') + ' or ' + k('↑', '↓')] : r && r[0] === 'Turn' ? ['Turn', k('A', 'D') + ' or ' + k('←', '→')] : r));
  $('#help').innerHTML = html + card('cp', 'Controller', pad) + card('cm', 'General', misc);
}
// ---------- events ----------
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Slash', 'Comma', 'Period']);
// ---------- title screen: the first click/key unlocks sound (browser rule) and starts the music ----------
const splashEl = document.getElementById('splash');
const splashOpen = () => splashEl && !splashEl.classList.contains('hidden');
function unlockAudio(ev) {
  Sfx.init(); updateMusic();
  // close the title screen only on a finished click / key, so the click can't fall through onto a menu button
  if (splashOpen() && ev && (ev.type === 'click' || ev.type === 'keydown' || ev.type === 'gamepad')) { splashEl.classList.add('hidden'); document.body.classList.remove('splashing'); Sfx.ui(); }
}
for (const ev of ['pointerdown', 'click', 'touchend', 'keyup']) addEventListener(ev, unlockAudio, {passive:true});
splashEl.addEventListener('click', e => { e.stopPropagation(); unlockAudio(e); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sfx.init(); updateMusic(); } });

// ---------- fullscreen ----------
const fsTarget = document.documentElement;
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFullscreen() {
  try {
    if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const req = fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen;
      const r = req && req.call(fsTarget, {navigationUI:'hide'});
      if (r && r.catch) r.catch(() => toast('Fullscreen is blocked here. Try opening the game in its own tab.'));
      if (!req) toast('Fullscreen is not supported in this browser');
    }
  } catch (e) { toast('Fullscreen is blocked here. Try opening the game in its own tab.'); }
}
function onFsChange() {
  fitCanvas();
  document.body.classList.toggle('fs', isFs());
  document.querySelectorAll('.fsbtn').forEach(b => b.textContent = isFs() ? 'Exit fullscreen' : 'Fullscreen');
}
document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange);
document.querySelectorAll('.fsbtn').forEach(b => b.addEventListener('click', e => { e.currentTarget.blur(); toggleFullscreen(); }));
cvs.addEventListener('dblclick', toggleFullscreen);

addEventListener('keydown', e => {
  Sfx.init(); updateMusic();
  if (splashOpen()) { e.preventDefault(); unlockAudio(e); return; }
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
addEventListener('mousedown', unlockAudio, {passive:true});
addEventListener('gamepadconnected', e => toast(`Controller ${e.gamepad.index + 1} connected`));
function pollPads() {
  pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && g.connected) : [];
  pads.forEach((g, i) => {
    const prev = padPrev[i] || [], pressed = b => !!(g.buttons[b] && g.buttons[b].pressed), edge = b => pressed(b) && !prev[b];
    if (edge(9) || edge(0)) { const was = splashOpen(); unlockAudio({type:'gamepad'}); if (was) { padPrev[i] = g.buttons.map(b => b.pressed); return; } }
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
  if (Net.role === 'guest') Net.send({t:'hello', ck:settings.p1, ab:settings.a1}); else setNetStatus('Opponent connected…');
  renderMenu();
});
Net.on('hello', m => {
  if (Net.role !== 'host') return;
  Net.peerCk = CLASSES[m.ck] ? m.ck : 'striker'; Net.peerAb = ABILITIES[m.ab] ? m.ab : 'air';
  setNetStatus(`Opponent joined with the <b>${CLASSES[Net.peerCk].name}</b>. Press START!`); renderMenu();
});
Net.on('start', m => {
  if (Net.role !== 'guest') return;
  players[0].ck = CLASSES[m.ck[0]] ? m.ck[0] : 'striker'; players[1].ck = CLASSES[m.ck[1]] ? m.ck[1] : 'striker';
  const ab = m.ab || []; players[0].ab = ABILITIES[ab[0]] ? ab[0] : 'air'; players[1].ab = ABILITIES[ab[1]] ? ab[1] : 'air';
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
  if (!paused) { cosmetics(dt); rocketTrails(dt); updateParticles(dt); shake = Math.max(0, shake - 45 * dt); }
  updateCamera(dt);
  const live = mode !== 'demo' && !paused && state !== 'matchover';
  players.forEach((p, i) => Sfx.engine(i, clamp(p.spd / 250, 0, 1), pan(p.x), live && p.alive));
  draw(t);
  requestAnimationFrame(frame);
}
buildMenu(); startDemo(); showMenu();
MAPS.forEach((m, i) => setTimeout(() => buildMap(i), 800 + i * 700));
requestAnimationFrame(frame);
