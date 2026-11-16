// ============ CPU OPPONENT ============
const AI_DIFF = {
  easy:   {react:.65, err:.17,  lead:0,  bank:0, angles:0,  dodge:0,  tol:.13, think:.6,  pu:.35, range:420},
  medium: {react:.32, err:.07,  lead:.6, bank:1, angles:24, dodge:.45, tol:.07, think:.45, pu:.7,  range:380},
  hard:   {react:.12, err:.022, lead:1,  bank:2, angles:40, dodge:.9, tol:.045, think:.3,  pu:1,   range:340},
};
const NAV = 30, NCX = WW / NAV, NCY = WH / NAV;
let navGrid = null, navDirty = true;
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function buildNav() {
  navGrid = new Uint8Array(NCX * NCY);
  for (let cy = 0; cy < NCY; cy++) for (let cx = 0; cx < NCX; cx++)
    navGrid[cy * NCX + cx] = obstacleAt((cx + .5) * NAV, (cy + .5) * NAV, 30) || mines.some(m => !m.dead && Math.hypot(m.x - (cx + .5) * NAV, m.y - (cy + .5) * NAV) < 40) ? 1 : 0;
  navDirty = false;
}
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function passable(cx, cy, dx, dy) {
  const nx = cx + dx, ny = cy + dy;
  if (nx < 0 || ny < 0 || nx >= NCX || ny >= NCY || navGrid[ny * NCX + nx]) return false;
  if (dx && dy && (navGrid[cy * NCX + nx] || navGrid[ny * NCX + cx])) return false;   // no corner cutting
  return true;
}
function flowField(tx, ty) {   // BFS distance from the target to every cell
  const f = new Int16Array(NCX * NCY).fill(-1), q = new Int32Array(NCX * NCY);
  const s = clamp(ty / NAV | 0, 0, NCY - 1) * NCX + clamp(tx / NAV | 0, 0, NCX - 1);
  let h = 0, t = 0; f[s] = 0; q[t++] = s;
  while (h < t) {
    const c = q[h++], cx = c % NCX, cy = c / NCX | 0;
    for (const [dx, dy] of DIRS) {
      if (!passable(cx, cy, dx, dy)) continue;
      const n = (cy + dy) * NCX + cx + dx;
      if (f[n] < 0) { f[n] = f[c] + 1; q[t++] = n; }
    }
  }
  return f;
}
function flowDir(me, f, tx, ty) {
  if (Math.hypot(tx - me.x, ty - me.y) < NAV * 2) return Math.atan2(ty - me.y, tx - me.x);
  let cx = clamp(me.x / NAV | 0, 0, NCX - 1), cy = clamp(me.y / NAV | 0, 0, NCY - 1);
  let goal = null;
  for (let step = 0; step < 3; step++) {
    let best = null, bv = 1e9;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= NCX || ny >= NCY) continue;
      const v = f[ny * NCX + nx];
      if (v >= 0 && v < bv && (step === 0 || passable(cx, cy, dx, dy))) { bv = v; best = [nx, ny]; }
    }
    if (!best) break;
    [cx, cy] = best; goal = best;
  }
  if (!goal) return Math.atan2(ty - me.y, tx - me.x);
  return Math.atan2((goal[1] + .5) * NAV - me.y, (goal[0] + .5) * NAV - me.x);
}
function clearShot(me, x, y, br) {
  const C = CLASSES[me.ck], o = pivot(me), a = Math.atan2(y - o.y, x - o.x), L = C.g.bl * TS + 4;
  const sx = o.x + Math.cos(a) * L, sy = o.y + Math.sin(a) * L, d = Math.hypot(x - sx, y - sy);
  if (Math.hypot(x - me.x, y - me.y) < L) return true;
  for (let s = 0; s < d; s += 10) if (obstacleAt(sx + (x - sx) * s / d, sy + (y - sy) * s / d, br + 1)) return false;
  return !barrelBlocked(me, a);
}
function findBank(me, foe, maxB, n) {
  const C = CLASSES[me.ck], L = C.g.bl * TS + 4, o = pivot(me);
  let best = null, bestLen = 1e9;
  for (let k = 0; k < n; k++) {
    const a = (k + Math.random()) / n * Math.PI * 2;
    if (barrelBlocked(me, a)) continue;
    const r = simulatePath(o.x + Math.cos(a) * L, o.y + Math.sin(a) * L, a, C.br, maxB, C.life ? C.bspeed * C.life * .9 : 1500, 10, {foe, me});
    if (r.hit === 'foe' && r.len < bestLen) { best = a; bestLen = r.len; }
  }
  return best;
}
function threat(me) {
  const C = CLASSES[me.ck];
  for (const b of bullets) {
    if (b.o === me.idx && !b.bounced) continue;
    const rx = me.x - b.x, ry = me.y - b.y, v2 = b.vx * b.vx + b.vy * b.vy, t = (rx * b.vx + ry * b.vy) / v2;
    if (t < 0 || t > .7) continue;
    const cx = rx - b.vx * t, cy = ry - b.vy * t;
    if (Math.hypot(cx, cy) < C.r + b.br + 10) {
      const sp = Math.sqrt(v2), px = -b.vy / sp, py = b.vx / sp, side = Math.sign(cx * px + cy * py) || 1;
      return Math.atan2(py * side, px * side);
    }
  }
  return null;
}

function aiThink(me, foe, dt, D) {
  const A = me.ai, C = CLASSES[me.ck];
  if (!A.init) Object.assign(A, {init:true, err:0, errT:0, see:0, field:null, fieldT:0, stuckT:0, lx:me.x, ly:me.y, rev:0, revTurn:1,
    bankAng:null, bankT:0, dodgeT:0, dodgeCheck:0, dodgeDir:0, strafe:Math.random() < .5 ? 1 : -1, puBias:Math.random()});
  const inp = {turn:0, move:0, tturn:0, aim:null, fire:false, special:false, ult:false};
  if (navDirty || !navGrid) buildNav();
  A.errT -= dt; if (A.errT <= 0) { A.errT = .5; A.err = (Math.random() * 2 - 1) * D.err; }

  // ---- firing solution: direct shot first, then a ricochet ----
  let aimAng = null;
  const bounces = C.bounces + (me.fx.bounce > 0 ? 3 : 0);
  if (foe.alive) {
    const dist = Math.hypot(foe.x - me.x, foe.y - me.y), tt = dist / C.bspeed * D.lead;
    const px = foe.x + foe.vx * tt, py = foe.y + foe.vy * tt;
    const inRange = !C.life || dist < C.bspeed * C.life * .9;
    if (inRange && clearShot(me, px, py, C.br)) { aimAng = Math.atan2(py - me.y, px - me.x); A.bankAng = null; }
    else if (inRange && D.bank && bounces > 0) {
      A.bankT -= dt;
      if (A.bankT <= 0) { A.bankT = D.think; A.bankAng = findBank(me, foe, Math.min(D.bank, bounces), D.angles); }
      aimAng = A.bankAng;
    }
  }
  // ---- where to go ----
  let tx = foe.x, ty = foe.y, combat = aimAng !== null && foe.alive;
  const outZone = Math.hypot(me.x - zone.x, me.y - zone.y) > zone.r - 90;
  if (outZone) { tx = zone.x; ty = zone.y; combat = false; }
  else {
    let best = null;
    for (const u of powerups) {
      const dm = Math.hypot(u.x - me.x, u.y - me.y), df = Math.hypot(u.x - foe.x, u.y - foe.y);
      if (A.puBias < D.pu && dm < 750 && dm < df + 150 && (!best || dm < best.d)) best = {u, d:dm};
    }
    if (best) { tx = best.u.x; ty = best.u.y; combat = false; }
  }
  A.fieldT -= dt;
  if (A.fieldT <= 0 || !A.field) { A.fieldT = .4; A.field = flowField(tx, ty); }
  let dir;
  const dFoe = Math.hypot(foe.x - me.x, foe.y - me.y);
  const range = C.aiRange || D.range;
  if (combat && dFoe < range + 120) {
    if (Math.random() < dt * .35) A.strafe = -A.strafe;
    dir = dFoe < range - 120 ? aimAng + Math.PI + A.strafe * .7 : aimAng + A.strafe * Math.PI / 2;
    if (obstacleAt(me.x + Math.cos(dir) * 45, me.y + Math.sin(dir) * 45, C.r)) { A.strafe = -A.strafe; dir = aimAng + A.strafe * Math.PI / 2; }
  } else dir = flowDir(me, A.field, tx, ty);

  // ---- get out of airstrike target zones ----
  for (const s of strikes) {
    if (s.t > AIR_DELAY + .5) continue;
    for (let i = 0; i < 5; i++) {
      const [bx, by] = bombPoint(s, i), d = Math.hypot(me.x - bx, me.y - by);
      if (d < 115 && D.dodge + .3 > Math.random() * .4) { dir = Math.atan2(me.y - s.ty, me.x - s.tx) + (Math.abs(Math.sin(Math.atan2(me.y - s.ty, me.x - s.tx) - s.ang)) < .4 ? Math.PI / 2 : 0); break; }
    }
  }
  // ---- dodge incoming shells ----
  if (A.dodgeT > 0) { A.dodgeT -= dt; dir = A.dodgeDir; }
  else if (D.dodge) {
    A.dodgeCheck -= dt;
    if (A.dodgeCheck <= 0) { A.dodgeCheck = .12; const th = threat(me); if (th !== null && Math.random() < D.dodge) { A.dodgeDir = th; A.dodgeT = .4; dir = th; } }
  }
  // ---- unstick ----
  A.stuckT += dt;
  if (A.stuckT > .8) { if (Math.hypot(me.x - A.lx, me.y - A.ly) < 12) { A.rev = .5; A.revTurn = Math.random() < .5 ? 1 : -1; } A.stuckT = 0; A.lx = me.x; A.ly = me.y; }

  if (A.rev > 0) { A.rev -= dt; inp.move = -.6; inp.turn = A.revTurn; }
  else {
    let d = angDiff(dir, me.a), back = false;
    if (Math.abs(d) > 2.4) { d = angDiff(dir + Math.PI, me.a); back = true; }
    inp.turn = clamp(d * 3, -1, 1);
    inp.move = (Math.abs(d) < 1 ? 1 : Math.abs(d) < 1.6 ? .3 : 0) * (back ? -.6 : 1);
  }
  // ---- aim & fire ----
  const free = opts.turret === 'free';
  if (aimAng !== null) {
    const ang = aimAng + A.err;
    let cur;
    if (free) { inp.aim = ang; cur = me.ta; }
    else {
      if (me.cool < .4 && A.rev <= 0 && A.dodgeT <= 0) { inp.turn = clamp(angDiff(ang, me.a) * 4, -1, 1); inp.move *= .3; }
      cur = me.a;
    }
    if (Math.abs(angDiff(ang, cur)) < D.tol) A.see += dt; else A.see = Math.max(0, A.see - dt * 2);
    if (A.see > D.react && me.cool <= 0) { inp.fire = true; A.see = D.react * .5; }
  } else if (free) inp.aim = Math.atan2(foe.y - me.y, foe.x - me.x);
  // ---- special ability once charged ----
  if (me.charge >= ABILITY_TIME) {
    A.abT = (A.abT || 0) + dt;
    const use = me.ab === 'air' ? foe.alive && A.abT > .5 + Math.random() * 2
      : me.ab === 'emp' ? foe.alive && dFoe < EMP_R * .8
      : me.ab === 'over' ? aimAng !== null && dFoe < 650
      : me.ab === 'repair' ? me.hp < me.maxhp * .45
      : me.ab === 'dome' ? me.hp < me.maxhp * .55 && (threat(me) !== null || dFoe < 260 || strikes.some(s => s.o !== me.idx)) : false;
    if (use) { inp.ult = !A.ultPrev; A.abT = 0; }
  }
  A.ultPrev = inp.ult;
  // ---- mines: drop one when the enemy is chasing close behind ----
  if (me.mines > 0 && foe.alive && dFoe < 260) {
    const behind = Math.cos(angDiff(Math.atan2(foe.y - me.y, foe.x - me.x), me.a + Math.PI)) > .4;
    if (behind && Math.random() < dt * 2) inp.special = true;
  }
  return inp;
}
