// ============ GRAPHICS: tank classes, sprites, particles, effects ============
const TS = 1.25;   // tank draw scale
const CLASSES = {
  l33:      {name:'L33',       desc:'Tiny and super fast, weak shots',     special:'Smallest target in the game',
             hp:50,  speed:370, turn:5.2, reload:.45, bspeed:620,  dmg:12, bounces:2, br:3,   r:15, stats:[5, 1, 1, 5],
             g:{hl:14, hw:9,  tr:7,  bl:22, bw:3.5, taper:true}},
  scout:    {name:'Scout',     desc:'Fast and nimble, light shells',       special:'Quick reload, shells bounce 3 times',
             hp:70,  speed:300, turn:4.3, reload:.7,  bspeed:560,  dmg:25, bounces:3, br:4,   r:19, stats:[4, 2, 2, 4],
             g:{hl:18, hw:11, tr:9,  bl:23, bw:5,   taper:true}},
  striker:  {name:'Striker',   desc:'The all-rounder',                     special:'Shells bounce 4 times',
             hp:100, speed:230, turn:3.4, reload:1.2, bspeed:540,  dmg:34, bounces:4, br:5,   r:22, stats:[3, 3, 3, 3],
             g:{hl:21, hw:14, tr:11, bl:27, bw:7}},
  hydra:    {name:'Hydra',     desc:'Twin guns, rapid fire',               special:'Two barrels fire in turns',
             hp:90,  speed:250, turn:3.6, reload:.5,  bspeed:560,  dmg:17, bounces:3, br:3.5, r:21, stats:[3, 2, 2, 5], twin:true,
             g:{hl:20, hw:13, tr:11, bl:30, bw:4, twin:true}},
  brawler:  {name:'Brawler',   desc:'Shotgun tank for close fights',       special:'Fires 5 pellets, short range',
             hp:120, speed:240, turn:3.4, reload:1.1, bspeed:520,  dmg:11, bounces:1, br:3.5, r:22, stats:[3, 3, 5, 2], pellets:5, spread:.3, life:.5, aiRange:170,
             g:{hl:20, hw:14, tr:11, bl:23, bw:10, flare:true, box:true}},
  sapper:   {name:'Sapper',    desc:'Mine-layer with a dozer blade',       special:'Starts with 4 mines and rebuilds them',
             hp:100, speed:235, turn:3.4, reload:1.1, bspeed:530,  dmg:28, bounces:3, br:5,   r:22, stats:[3, 3, 2, 3], startMines:4, mineRegen:8,
             g:{hl:21, hw:14, tr:10, bl:24, bw:6, plow:true}},
  phoenix:  {name:'Phoenix',   desc:'Self-repairing tank',                 special:'Heals itself when not hit for 3 s',
             hp:110, speed:225, turn:3.4, reload:1.25, bspeed:540, dmg:30, bounces:3, br:5,   r:22, stats:[3, 3, 3, 3], regen:7,
             g:{hl:21, hw:13, tr:11, bl:29, bw:6, taper:true, vents:true}},
  tiger:    {name:'Tiger',     desc:'Heavy tank with a long 88 mm gun',    special:'Hard-hitting, thick armour',
             hp:145, speed:175, turn:2.6, reload:1.6, bspeed:520,  dmg:44, bounces:3, br:6,   r:25, stats:[2, 4, 4, 2],
             g:{hl:24, hw:15, tr:14, bl:42, bw:7, box:true, brake:true}},
  howitzer: {name:'Howitzer',  desc:'Artillery with explosive shells',     special:'Shells explode: splash damage',
             hp:95,  speed:190, turn:2.8, reload:2.0, bspeed:380,  dmg:40, bounces:1, br:7,   r:23, stats:[2, 2, 5, 1], splash:85, sdmg:35,
             g:{hl:22, hw:14, tr:12, bl:33, bw:11, toff:-7, fume:true}},
  viper:    {name:'Viper',     desc:'Rocket launcher tank',                special:'Homing rockets chase the enemy',
             hp:90,  speed:225, turn:3.3, reload:1.5, bspeed:300,  dmg:30, bounces:0, br:4.5, r:22, stats:[3, 2, 4, 2], homing:2.6, rocket:true, life:3.2, twin:true, podOff:8,
             g:{hl:21, hw:13, tr:11, bl:22, bw:5, pods:true, pod:8}},
  maus:     {name:'Maus',      desc:'Super-heavy: huge armour, very slow', special:'Biggest gun, slowest tank',
             hp:200, speed:135, turn:2.1, reload:2.2, bspeed:460,  dmg:50, bounces:3, br:8,   r:29, stats:[1, 5, 5, 1],
             g:{hl:27, hw:17, tr:15, bl:46, bw:8, skirt:true, box:true, toff:-6, coax:true, big:true}},
  sniper:   {name:'Lancer',    desc:'Rail gun sniper',                     special:'Super fast shot, no ricochet',
             hp:80,  speed:220, turn:3.2, reload:2.0, bspeed:1100, dmg:55, bounces:0, br:4,   r:21, stats:[3, 2, 5, 1],
             g:{hl:20, hw:13, tr:10, bl:43, bw:5, taper:true, collar:true}},
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
const ABILITY_TIME = 10;   // seconds to charge
const ABILITIES = {
  air:    {name:'Airstrike',    desc:'A bomber drops 5 bombs on the enemy area', col:'#ff8a65'},
  emp:    {name:'EMP Blast',    desc:'Freezes a nearby enemy for 2.5 s',         col:'#64b5f6'},
  over:   {name:'Overdrive',    desc:'Faster, fires twice as fast for 6 s',      col:'#ffb74d'},
  repair: {name:'Field Repair', desc:'Instantly repairs half your health',       col:'#81c784'},
  dome:   {name:'Iron Dome',    desc:'Invulnerable for 3.5 s',                    col:'#ffd54f'},
};
const ABILITY_KEYS = Object.keys(ABILITIES);
function drawAbilityIcon(ctx, k, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.4, s * .2); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  if (k === 'air') { ctx.moveTo(s, 0); ctx.lineTo(-s * .2, -s * .15); ctx.lineTo(-s * .5, -s); ctx.lineTo(-s * .75, -s); ctx.lineTo(-s * .55, -s * .15); ctx.lineTo(-s, -s * .1);
    ctx.lineTo(-s, s * .1); ctx.lineTo(-s * .55, s * .15); ctx.lineTo(-s * .75, s); ctx.lineTo(-s * .5, s); ctx.lineTo(-s * .2, s * .15); ctx.closePath(); ctx.fill(); }
  else if (k === 'emp') { ctx.moveTo(s * .2, -s); ctx.lineTo(-s * .55, s * .1); ctx.lineTo(0, s * .1); ctx.lineTo(-s * .2, s); ctx.lineTo(s * .55, -s * .15); ctx.lineTo(0, -s * .15); ctx.closePath(); ctx.fill(); }
  else if (k === 'over') { ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .9, -s * .1, s * .45, s * .8); ctx.quadraticCurveTo(0, s, -s * .45, s * .8); ctx.quadraticCurveTo(-s * .9, -s * .1, 0, -s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.moveTo(0, -s * .15); ctx.quadraticCurveTo(s * .4, s * .3, 0, s * .75); ctx.quadraticCurveTo(-s * .4, s * .3, 0, -s * .15); ctx.fill(); }
  else if (k === 'repair') { ctx.lineWidth = s * .42; ctx.moveTo(0, -s * .8); ctx.lineTo(0, s * .8); ctx.moveTo(-s * .8, 0); ctx.lineTo(s * .8, 0); ctx.stroke(); }
  else if (k === 'dome') { ctx.arc(0, s * .4, s * .9, Math.PI, 0); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s, s * .45); ctx.lineTo(s, s * .45); ctx.stroke(); }
  ctx.restore();
}
// top-down jet for the airstrike, rendered once per team
const planeCache = {};
function planeSprite(team) {
  if (planeCache[team]) return planeCache[team];
  const S = 140, c = mk(S * 2, S * 2), x = c.getContext('2d'); x.scale(2, 2); x.translate(S / 2, S / 2);
  const body = '#7b838a', dark = '#4c5359';
  const wing = () => { x.beginPath(); x.moveTo(8, -5); x.lineTo(-14, -52); x.lineTo(-24, -52); x.lineTo(-16, -6); x.lineTo(-16, 6); x.lineTo(-24, 52); x.lineTo(-14, 52); x.lineTo(8, 5); x.closePath(); };
  wing(); let gr = x.createLinearGradient(0, -52, 0, 52); gr.addColorStop(0, '#9aa2a8'); gr.addColorStop(.5, body); gr.addColorStop(1, dark); x.fillStyle = gr; x.fill();
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = .8; x.stroke();
  x.beginPath(); x.moveTo(-34, -4); x.lineTo(-46, -20); x.lineTo(-52, -20); x.lineTo(-46, -3); x.lineTo(-46, 3); x.lineTo(-52, 20); x.lineTo(-46, 20); x.lineTo(-34, 4); x.closePath(); x.fillStyle = dark; x.fill();
  gr = x.createLinearGradient(0, -7, 0, 7); gr.addColorStop(0, '#a7afb5'); gr.addColorStop(.5, body); gr.addColorStop(1, '#3f454a');
  x.fillStyle = gr; x.beginPath(); x.ellipse(-8, 0, 46, 6.5, 0, 0, 7); x.fill();
  x.fillStyle = team; x.fillRect(-48, -2, 10, 4);
  gr = x.createLinearGradient(18, -3, 28, 3); gr.addColorStop(0, '#cfe8ff'); gr.addColorStop(1, '#2b4a66');
  x.fillStyle = gr; x.beginPath(); x.ellipse(22, 0, 9, 3.2, 0, 0, 7); x.fill();
  for (const y of [-30, -18, 18, 30]) { x.fillStyle = '#3a3f44'; x.fillRect(-8, y - 1.5, 10, 3); }
  x.fillStyle = '#ffb347'; x.beginPath(); x.arc(-54, 0, 2.5, 0, 7); x.fill();
  return planeCache[team] = c;
}
function planeShadow(team) {
  const k = 'sh' + team; if (planeCache[k]) return planeCache[k];
  const src = planeSprite(team), c = mk(src.width, src.height), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  return planeCache[k] = c;
}
// Realistic military paint: team colour is shown by the turret band, the antenna flag and the HUD
const PALS = [
  {base:'#5f6a4c', light:'#8a9670', dark:'#2c3324', camo:'#3a4430', camo2:'#24261e', team:'#4fc3f7', stripe:'#4fc3f7'},
  {base:'#b39c68', light:'#d6c190', dark:'#5c4c2c', camo:'#7a5e38', camo2:'#69704a', team:'#ff7043', stripe:'#ff7043'},
];
PALS[0].id = 'p0'; PALS[1].id = 'p1';
const T0 = {team:'#4fc3f7', stripe:'#4fc3f7'};
const PAINTS = {   // unlockable paint jobs for your tank (Act II rewards)
  olive:  {name:'Olive',        base:'#5f6a4c', light:'#8a9670', dark:'#2c3324', camo:'#3a4430', camo2:'#24261e'},
  black:  {name:'Black Ops',    base:'#34373a', light:'#5a5e62', dark:'#141618', camo:'#222426', camo2:'#4a4e52'},
  stripes:{name:'Tiger Stripe', base:'#c2a565', light:'#e0c88c', dark:'#5e4a24', camo:'#4a3b25', camo2:'#7a6038'},
  winter: {name:'Winter',       base:'#c9d0d5', light:'#eef2f5', dark:'#6f787e', camo:'#8d969c', camo2:'#5d666c'},
  urban:  {name:'Urban',        base:'#6e7378', light:'#9aa0a5', dark:'#33373b', camo:'#4a4f54', camo2:'#a4aab0'},
  navy:   {name:'Navy',         base:'#3b4f66', light:'#6d86a3', dark:'#1b2635', camo:'#26364a', camo2:'#5f7690'},
  red:    {name:'Crimson',      base:'#7a2e2a', light:'#b0544c', dark:'#3b1210', camo:'#4f1b19', camo2:'#a8463e'},
  desert: {name:'Desert',       base:'#c8b07a', light:'#e6d3a4', dark:'#6e5a32', camo:'#a88e58', camo2:'#8c7444'},
  gold:   {name:'Gold',         base:'#b8952e', light:'#f3d982', dark:'#6a500f', camo:'#9c7a1e', camo2:'#e0bd52'},
};
for (const k in PAINTS) Object.assign(PAINTS[k], T0, {id:'paint-' + k});
const WRECK = {base:'#2b2927', light:'#45413d', dark:'#121110', camo:'#1c1a19', camo2:'#36302a', team:'#3a3633', stripe:'#3a3633', wreck:true};

// ---------- sprites (rendered once at 2x, then reused) ----------
const sprCache = {};
const SPR = 2;   // sprite resolution
function camo(x, X, Y, W, H, p) {   // soft-edged camouflage blotches (shadow trick gives the soft edge)
  for (const [col, n] of [[p.camo, 6], [p.camo2, 4]]) {
    x.save(); x.shadowColor = col; x.shadowBlur = 2.5 * SPR; x.shadowOffsetX = 500 * SPR; x.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const cx = X + rnd() * W, cy = Y + rnd() * H, r = 2.5 + rnd() * Math.min(W, H) * .32, k = 7;
      x.beginPath();
      for (let j = 0; j < k; j++) { const a = j / k * 6.283, d = r * (.55 + rnd() * .6); const px = cx + Math.cos(a) * d * 1.4 - 500, py = cy + Math.sin(a) * d; j ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.closePath(); x.fill();
    }
    x.restore();
  }
}
function weather(x, X, Y, W, H, n) {
  for (let i = 0; i < n; i++) { x.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.2)' : 'rgba(255,250,230,.15)'; x.fillRect(X + rnd() * W, Y + rnd() * H, .5 + rnd() * 1.2, .5 + rnd() * 1.2); }
  x.strokeStyle = 'rgba(255,250,235,.22)'; x.lineWidth = .4;
  for (let i = 0; i < n / 30; i++) { const sx = X + rnd() * W, sy = Y + rnd() * H, a = rnd() * 6.28, l = 2 + rnd() * 5; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke(); }
}
function bolt(x, bx, by, r = .9) { x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.arc(bx + .3, by + .3, r, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,240,.3)'; x.beginPath(); x.arc(bx - .2, by - .2, r * .6, 0, 7); x.fill(); }
function hullSprite(G, p) {
  const hl = G.hl, hw = G.hw, CW = (hl + 12) * 2, CH = (hw + 10) * 2;
  const c = mk(CW * SPR, CH * SPR), x = c.getContext('2d'); x.scale(SPR, SPR); x.translate(CW / 2, CH / 2);
  const shape = () => {
    x.beginPath();
    if (G.taper) { x.moveTo(-hl, -hw + 4); x.quadraticCurveTo(-hl, -hw, -hl + 4, -hw); x.lineTo(hl - 7, -hw); x.lineTo(hl, -hw + 6); x.lineTo(hl, hw - 6); x.lineTo(hl - 7, hw); x.lineTo(-hl + 4, hw); x.quadraticCurveTo(-hl, hw, -hl, hw - 4); }
    else { x.moveTo(-hl + 3, -hw); x.lineTo(hl - 4, -hw); x.lineTo(hl, -hw + 4); x.lineTo(hl, hw - 4); x.lineTo(hl - 4, hw); x.lineTo(-hl + 3, hw); x.lineTo(-hl, hw - 3); x.lineTo(-hl, -hw + 3); }
    x.closePath();
  };
  shape(); x.fillStyle = p.base; x.fill();
  x.save(); shape(); x.clip();
  if (!p.wreck) camo(x, -hl, -hw, hl * 2, hw * 2, p);
  let gr = x.createLinearGradient(-hl, -hw, hl * .4, hw);
  gr.addColorStop(0, 'rgba(255,252,235,.24)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.32)');
  x.fillStyle = gr; x.fillRect(-hl, -hw, hl * 2, hw * 2);
  weather(x, -hl, -hw, hl * 2, hw * 2, 240);
  x.fillStyle = p.wreck ? 'rgba(0,0,0,.35)' : 'rgba(150,126,90,.2)';   // dust kicked up on the sides and rear
  x.fillRect(-hl, -hw, hl * 2, 2.5); x.fillRect(-hl, hw - 2.5, hl * 2, 2.5); x.fillRect(-hl, -hw, 3, hw * 2);
  x.restore();
  // engine deck louvres + exhaust soot
  const ex = -hl + 2, ew = 9;
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(ex, -hw + 5, ew, hw * 2 - 10);
  for (let y = -hw + 6; y < hw - 5; y += 2.2) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(ex + .5, y, ew - 1, 1); x.fillStyle = 'rgba(255,255,240,.14)'; x.fillRect(ex + .5, y + 1, ew - 1, .5); }
  for (const y of [-hw + 3, hw - 3]) { gr = x.createRadialGradient(-hl, y, 0, -hl, y, 7); gr.addColorStop(0, 'rgba(10,8,6,.55)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); x.fillStyle = gr; x.fillRect(-hl - 2, y - 7, 9, 14); }
  x.fillStyle = '#1e1e1e'; x.fillRect(-hl - 2, -hw + 2, 3, 3.5); x.fillRect(-hl - 2, hw - 5.5, 3, 3.5);
  // panel seams
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = .7;
  x.beginPath(); x.moveTo(ex + ew + 2, -hw + 1); x.lineTo(ex + ew + 2, hw - 1); x.moveTo(hl - 8, -hw + 2); x.lineTo(hl - 8, hw - 2); x.stroke();
  x.strokeStyle = 'rgba(255,255,240,.16)'; x.beginPath(); x.moveTo(ex + ew + 2.7, -hw + 1); x.lineTo(ex + ew + 2.7, hw - 1); x.moveTo(hl - 7.3, -hw + 2); x.lineTo(hl - 7.3, hw - 2); x.stroke();
  // front glacis with spare track links
  x.fillStyle = 'rgba(255,252,235,.1)'; x.fillRect(hl - 8, -hw + 2, 7, hw * 2 - 4);
  for (let i = -1; i <= 1; i++) { x.fillStyle = '#2c2d2f'; x.fillRect(hl - 6.5, i * 4.4 - 1.8, 4, 3.6); x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(hl - 6.5, i * 4.4 - 1.8, 4, .8); }
  for (const y of [-hw + 4, hw - 4]) {   // headlights with guards
    x.fillStyle = '#1b1b1b'; x.beginPath(); x.arc(hl - 2, y, 2, 0, 7); x.fill();
    x.fillStyle = p.wreck ? '#333' : '#e8dcaa'; x.beginPath(); x.arc(hl - 2.3, y - .3, 1.2, 0, 7); x.fill();
  }
  // tools: shovel (left side) and tow cable (right side)
  x.strokeStyle = '#6b5236'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-hl + 14, -hw + 2.2); x.lineTo(hl - 14, -hw + 2.2); x.stroke();
  x.fillStyle = '#55595c'; x.fillRect(hl - 15, -hw + .8, 4, 2.8);
  x.strokeStyle = '#2b2b2b'; x.lineWidth = 1.4; x.setLineDash([1.2, .8]); x.beginPath(); x.moveTo(-hl + 14, hw - 2.2); x.lineTo(hl - 12, hw - 2.2); x.stroke(); x.setLineDash([]);
  // jerry cans on the rear corners
  if (!G.big && !G.plow) for (const y of [-hw + 1, hw - 6]) { x.fillStyle = p.wreck ? '#2a2a2a' : p.dark; rr(x, -hl + 11.5, y, 4, 5, .8); x.fill(); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = .5; x.beginPath(); x.moveTo(-hl + 12, y + .5); x.lineTo(-hl + 15, y + 4.5); x.moveTo(-hl + 15, y + .5); x.lineTo(-hl + 12, y + 4.5); x.stroke(); }
  for (let i = -hl + 4; i <= hl - 4; i += 5) for (const y of [-hw + 1.2, hw - 1.2]) bolt(x, i, y, .55);
  // team identification panel on the rear deck
  if (!p.wreck) { x.globalAlpha = .8; x.fillStyle = p.team; x.fillRect(ex + ew + 3.5, -2.5, 3, 5); x.globalAlpha = 1; }
  if (G.big) {
    for (const y of [-hw * .45, hw * .45]) { x.fillStyle = p.dark; x.beginPath(); x.arc(hl - 13, y, 3.2, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = .7; x.beginPath(); x.arc(hl - 13, y, 2.2, Math.PI, 1.5 * Math.PI); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.35)'; for (const y of [-hw + 4, hw - 9]) x.fillRect(-hl + 13, y, 9, 5);
  }
  shape(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1; x.stroke();
  x.save(); shape(); x.clip(); x.strokeStyle = 'rgba(255,252,235,.25)'; x.lineWidth = 1; x.translate(.8, .8); shape(); x.stroke(); x.restore();
  return {c, w:CW, h:CH};
}
function turretSprite(G, p) {
  const tr = G.tr, S = (tr + 10) * 2;
  const c = mk(S * SPR, S * SPR), x = c.getContext('2d'); x.scale(SPR, SPR); x.translate(S / 2, S / 2);
  const rad = G.box ? tr * .3 : tr * .8;
  const shape = () => rr(x, -tr - 2, -tr, tr * 2 + (G.box ? 1 : 0), tr * 2, rad);
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 5 * SPR; x.shadowOffsetX = 2.5 * SPR; x.shadowOffsetY = 3 * SPR;
  shape(); x.fillStyle = p.base; x.fill(); x.restore();
  x.save(); shape(); x.clip();
  if (!p.wreck) camo(x, -tr - 2, -tr, tr * 2, tr * 2, p);
  const gr = x.createRadialGradient(-tr * .55, -tr * .5, 1, -1, 0, tr * 1.5);
  gr.addColorStop(0, 'rgba(255,252,235,.3)'); gr.addColorStop(.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = gr; x.fillRect(-tr - 2, -tr, tr * 2 + 2, tr * 2);
  if (!p.wreck) {   // painted team band, a little worn
    x.globalAlpha = .9; x.fillStyle = p.team; x.fillRect(-tr * .05, -tr, tr * .34, tr * 2); x.globalAlpha = 1;
    for (let i = 0; i < 26; i++) { x.fillStyle = rnd() < .6 ? p.base : 'rgba(0,0,0,.25)'; x.fillRect(-tr * .05 + rnd() * tr * .34, -tr + rnd() * tr * 2, .6 + rnd(), .6 + rnd()); }
  }
  weather(x, -tr - 2, -tr, tr * 2, tr * 2, 120);
  x.restore();
  shape(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1; x.stroke();
  // gun mantlet
  const mg = x.createLinearGradient(0, -tr * .5, 0, tr * .5); mg.addColorStop(0, p.light); mg.addColorStop(.4, p.base); mg.addColorStop(1, p.dark);
  x.fillStyle = mg; rr(x, tr - 4, -tr * .5, 6, tr, 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = .7; x.stroke();
  // commander's cupola with vision blocks
  const cx = -tr * .38, cy = -tr * .3, cr = tr * .38;
  x.fillStyle = p.dark; x.beginPath(); x.arc(cx, cy, cr + 1, 0, 7); x.fill();
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; x.fillStyle = p.wreck ? '#222' : '#8fb4c8'; x.fillRect(cx + Math.cos(a) * cr - .8, cy + Math.sin(a) * cr - .8, 1.6, 1.6); }
  const hg = x.createRadialGradient(cx - cr * .3, cy - cr * .3, .5, cx, cy, cr * .8); hg.addColorStop(0, p.light); hg.addColorStop(1, p.dark);
  x.fillStyle = hg; x.beginPath(); x.arc(cx, cy, cr * .72, 0, 7); x.fill();
  x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(cx - cr * .6, cy - .5, cr * 1.2, 1);
  // roof machine gun
  x.strokeStyle = '#1a1a1a'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(cx + cr * .5, cy + cr * .6); x.lineTo(cx + cr * .5 + tr * .7, cy + cr * .6); x.stroke();
  x.fillStyle = '#262626'; x.fillRect(cx + cr * .2, cy + cr * .3, 3, 2.4);
  // loader hatch
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(-tr * .3, tr * .45, tr * .25, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,240,.2)'; x.lineWidth = .6; x.beginPath(); x.arc(-tr * .3, tr * .45, tr * .2, Math.PI, 1.6 * Math.PI); x.stroke();
  // smoke grenade launchers
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { x.fillStyle = '#222'; x.beginPath(); x.arc(tr * .45 + i * 2.2, s * (tr * .82), 1, 0, 7); x.fill(); }
  // rear stowage bin
  x.fillStyle = p.wreck ? '#2a2a2a' : p.dark; rr(x, -tr - 7, -tr * .6, 6, tr * 1.2, 1.5); x.fill();
  x.strokeStyle = 'rgba(255,255,240,.15)'; x.lineWidth = .6; x.beginPath(); x.moveTo(-tr - 6.5, -tr * .2); x.lineTo(-tr - 1.5, -tr * .2); x.moveTo(-tr - 6.5, tr * .2); x.lineTo(-tr - 1.5, tr * .2); x.stroke();
  return {c, w:S, h:S};
}
function tankSprites(ck, pal, key) {
  const k = ck + '|' + key;
  if (!sprCache[k]) { const save = seed; seed = 99 + key.length * 7 + ck.length * 13; const G = CLASSES[ck].g; sprCache[k] = {hull:hullSprite(G, pal), turret:turretSprite(G, pal)}; seed = save; }
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
      if (q.k === 'smoke') { ctx.globalAlpha = Math.min(1, (1 - t) * 6) * t * .55; ctx.fillStyle = q.c || '#3c3c3c'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
      else if (q.k === 'dust') { ctx.globalAlpha = t * .45; ctx.fillStyle = q.c || '#a08a62'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
      else if (q.k === 'dirt') { ctx.globalAlpha = Math.min(1, t * 3); ctx.fillStyle = q.c || '#5a4630'; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.size, q.size * .7, q.rot, 0, 7); ctx.fill(); }
      else if (q.k === 'debris') { ctx.globalAlpha = Math.min(1, t * 3); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.c || '#1c1c1c'; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * .66); ctx.restore(); }
      else if (q.k === 'text') { ctx.globalAlpha = Math.min(1, t * 2.5); ctx.font = "18px 'Black Ops One', Impact, sans-serif"; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(q.txt, q.x + 2, q.y + 2); ctx.fillStyle = q.c; ctx.fillText(q.txt, q.x, q.y); }
    } else {
      if (q.k === 'fire') { ctx.globalAlpha = t; const s = q.size * 2.6; ctx.drawImage(glow(t > .5 ? '#ffd27a' : '#ff6a22'), q.x - s / 2, q.y - s / 2, s, s); }
      else if (q.k === 'boost') { ctx.globalAlpha = t * .8; const s = q.size * 2.4; ctx.drawImage(glow(q.c === 'o' ? '#ff8a3c' : '#69f0ae'), q.x - s / 2, q.y - s / 2, s, s); }
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
  const spr = p.alive ? tankSprites(p.ck, p.pal, p.pal.id || 'p' + p.idx) : tankSprites(p.ck, WRECK, 'wreck');
  ctx.save(); ctx.translate(p.x + 7, p.y + 9); ctx.rotate(p.a); ctx.scale(TS, TS);   // soft shadow
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 9; ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, -hl - 5, -hw - 8, (hl + 5) * 2, (hw + 8) * 2, 6); ctx.fill(); ctx.restore();

  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(TS, TS);
  for (const [y0, v] of [[-hw - 8, p.tl], [hw - 2, p.tr]]) {      // tracks: individual steel links, each side moves on its own
    ctx.fillStyle = p.alive ? '#161719' : '#0b0b0b'; rr(ctx, -hl - 5, y0, (hl + 5) * 2, 10, 4); ctx.fill();
    const off = ((v % 5) + 5) % 5;
    for (let x = -hl - 5 + off; x < hl + 4; x += 5) {
      ctx.fillStyle = p.alive ? '#3d3f42' : '#1d1d1d'; ctx.fillRect(x, y0 + 1, 3.6, 8);
      ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(x, y0 + 1, 3.6, .9);
      ctx.fillStyle = p.alive ? '#5d6064' : '#262626'; ctx.fillRect(x + 1, y0 + 4, 1.6, 2);
    }
    ctx.fillStyle = 'rgba(120,100,70,.16)'; ctx.fillRect(-hl - 5, y0, (hl + 5) * 2, 10);
    if (G.skirt) {
      ctx.fillStyle = p.alive ? p.pal.dark : '#1a1918'; ctx.fillRect(-hl + 1, y0 + 1, hl * 2 - 2, 8);
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .8;
      for (let x = -hl + 1 + (hl * 2 - 2) / 5; x < hl - 1; x += (hl * 2 - 2) / 5) { ctx.beginPath(); ctx.moveTo(x, y0 + 1); ctx.lineTo(x, y0 + 9); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,240,.14)'; ctx.fillRect(-hl + 1, y0 + 1, hl * 2 - 2, 1.2);
    }
  }
  ctx.drawImage(spr.hull.c, -spr.hull.w / 2, -spr.hull.h / 2, spr.hull.w, spr.hull.h);
  if (G.plow) {   // dozer blade + mine rack
    const bg = ctx.createLinearGradient(hl + 2, 0, hl + 7, 0); bg.addColorStop(0, p.alive ? '#8a7428' : '#2a2620'); bg.addColorStop(1, p.alive ? '#5a4a18' : '#1a1814');
    ctx.fillStyle = bg; rr(ctx, hl + 2, -hw - 7, 5, hw * 2 + 14, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,.25)'; ctx.fillRect(hl + 2, -hw - 7, 1, hw * 2 + 14);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(hl - 1, -hw * .5, 3, 2); ctx.fillRect(hl - 1, hw * .5 - 2, 3, 2);
    for (let i = 0; i < Math.min(4, p.mines || 0); i++) {
      const my = -hw + 5 + i * (hw * 2 - 10) / 3;
      ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(-hl + 5, my, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#a33'; ctx.beginPath(); ctx.arc(-hl + 5, my, .9, 0, 7); ctx.fill();
    }
  }
  if (G.vents && p.alive) {   // glowing repair vents
    const pulse = p.regening ? .6 + Math.sin(t / 120) * .4 : .2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse;
    for (const y of [-hw + 4, hw - 4]) ctx.drawImage(glow('#7dff9a'), -hl + 2, y - 7, 14, 14);
    ctx.restore();
    ctx.fillStyle = '#7dff9a'; ctx.globalAlpha = .4 + pulse * .5;
    for (const y of [-hw + 3, hw - 5]) ctx.fillRect(-hl + 5, y, 8, 2);
    ctx.globalAlpha = 1;
  }
  if (p.alive) {   // antenna with a team pennant
    const aa = Math.PI + p.ant, ax = -hl + 8, ay = hw - 5, L = 22, ex = ax + Math.cos(aa) * L, ey = ay + Math.sin(aa) * L;
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    const wave = Math.sin(t / 90 + p.idx) * 1.5;
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(aa - .3) * 7 + wave * .3, ey + Math.sin(aa - .3) * 7 + wave); ctx.lineTo(ax + Math.cos(aa) * (L - 4), ay + Math.sin(aa) * (L - 4)); ctx.closePath(); ctx.fill();
  }
  if (p.flash > 0 && p.alive) { ctx.globalAlpha = p.flash / .15 * .55; ctx.fillStyle = '#fff6dc'; rr(ctx, -hl, -hw, hl * 2, hw * 2, 5); ctx.fill(); ctx.globalAlpha = 1; }

  ctx.translate(G.toff || 0, 0); ctx.rotate(p.ta - p.a);   // turret can point away from the hull
  const rc = p.recoil * 7, b0 = G.tr * .4 - rc, bl = G.bl - rc, pal = p.alive ? p.pal : WRECK;
  const barrel = (y, w) => {
    const gr = ctx.createLinearGradient(0, y - w / 2, 0, y + w / 2);
    gr.addColorStop(0, pal.dark); gr.addColorStop(.3, pal.light); gr.addColorStop(.55, pal.base); gr.addColorStop(1, '#141414');
    ctx.fillStyle = gr; ctx.fillRect(b0, y - w / 2, bl - b0, w);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(b0 + (bl - b0) * .45, y - w / 2, .8, w);
  };
  if (G.pods) {
    for (const s of [-1, 1]) {
      const y = s * G.pod, gr = ctx.createLinearGradient(0, y - 4, 0, y + 4);
      gr.addColorStop(0, pal.light); gr.addColorStop(.5, pal.base); gr.addColorStop(1, pal.dark);
      ctx.fillStyle = gr; rr(ctx, b0 - 4, y - 4, bl - b0 + 4, 8, 1.5); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .7; ctx.stroke();
      for (const o of [-1.9, 1.9]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(bl - .5, y + o, 1.5, 0, 7); ctx.fill(); }
    }
  } else if (G.twin) { barrel(-G.bw / 2 - 1.5, G.bw); barrel(G.bw / 2 + 1.5, G.bw); } else barrel(0, G.bw);
  const steel = (x, y, w, h) => { const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2b2e31'); gr.addColorStop(.35, p.alive ? '#6a6f73' : '#333'); gr.addColorStop(1, '#141516'); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h); };
  if (G.fume) { const gr = ctx.createLinearGradient(0, -G.bw / 2 - 1.5, 0, G.bw / 2 + 1.5); gr.addColorStop(0, pal.dark); gr.addColorStop(.3, pal.light); gr.addColorStop(1, '#141414'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(G.bl * .62 - rc, 0, 4.5, G.bw / 2 + 1.5, 0, 0, 7); ctx.fill(); }
  if (G.collar) steel(G.bl * .55 - rc, -G.bw / 2 - 1, 3, G.bw + 2);
  if (G.coax) { steel(G.tr * .6 - rc * .6, G.bw / 2 + 2, G.tr * .9, 3.2); }
  if (G.flare) { ctx.fillStyle = '#1e2124'; ctx.beginPath(); ctx.moveTo(bl - 6, -G.bw / 2); ctx.lineTo(bl + 1, -G.bw / 2 - 3); ctx.lineTo(bl + 1, G.bw / 2 + 3); ctx.lineTo(bl - 6, G.bw / 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(bl - 6, -G.bw / 2 - 1, 7, 1); }
  else if (G.brake) { steel(bl - 7, -G.bw / 2 - 2.5, 3, G.bw + 5); steel(bl - 2, -G.bw / 2 - 2.5, 3, G.bw + 5); }
  else if (G.twin) for (const y of [-G.bw / 2 - 1.5, G.bw / 2 + 1.5]) steel(bl - 4, y - G.bw / 2 - 1, 5, G.bw + 2);
  else if (!G.pods) steel(bl - 5, -G.bw / 2 - 1.5, 6, G.bw + 3);
  if (p.muzzle > 0) {
    ctx.save(); ctx.translate(0, p.mside || 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(p.muzzle / .07, 0, 1);
    ctx.drawImage(glow('#ffb347'), bl - 26, -32, 64, 64);
    ctx.fillStyle = '#fff4d0';
    ctx.beginPath(); ctx.moveTo(bl + 1, -2); ctx.lineTo(bl + 22, 0); ctx.lineTo(bl + 1, 2); ctx.lineTo(bl + 6, 7); ctx.lineTo(bl + 3, 0); ctx.lineTo(bl + 6, -7); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  ctx.drawImage(spr.turret.c, -spr.turret.w / 2, -spr.turret.h / 2, spr.turret.w, spr.turret.h);
  ctx.restore();

  if (p.alive && p.over > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 + Math.sin(t / 70) * .12;
    ctx.drawImage(glow('#ff7a2a'), p.x - C.r * 2, p.y - C.r * 2, C.r * 4, C.r * 4); ctx.restore();
  }
  if (p.alive && p.dome > 0) {
    const r = C.r + 18;
    ctx.save(); const gr = ctx.createRadialGradient(p.x - r * .3, p.y - r * .4, r * .1, p.x, p.y, r);
    gr.addColorStop(0, 'rgba(255,240,180,.28)'); gr.addColorStop(.75, 'rgba(255,213,79,.14)'); gr.addColorStop(1, 'rgba(255,213,79,.5)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    ctx.globalAlpha = p.dome < 1 && (t / 100 | 0) % 2 ? .3 : .9; ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = .35; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI + t / 900; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * Math.abs(Math.cos(a)), 0, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  if (p.alive && p.emp > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      let a = Math.random() * 6.28, r = C.r * (.6 + Math.random() * .7); ctx.globalAlpha = .5 + Math.random() * .5; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      for (let j = 0; j < 5; j++) { a += rand(-.6, .6); r = C.r * (.4 + Math.random() * 1); ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
      ctx.stroke();
    }
    ctx.globalAlpha = .4; ctx.drawImage(glow('#64b5f6'), p.x - C.r * 1.8, p.y - C.r * 1.8, C.r * 3.6, C.r * 3.6);
    ctx.restore();
  }
  if (p.alive && p.shield) {
    const r = C.r + 14 + Math.sin(t / 180) * 1.5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3;
    ctx.drawImage(glow('#80deea'), p.x - r * 1.4, p.y - r * 1.4, r * 2.8, r * 2.8);
    ctx.globalAlpha = .8; ctx.strokeStyle = '#a5f3ff'; ctx.lineWidth = 1.5; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t / 25;
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
function tankPreview(canvas, ck, palIdx, pal) {
  const x = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  x.clearRect(0, 0, w, h);
  const p = {ck, mines:4, pal:pal || PALS[palIdx], idx:palIdx, x:0, y:0, a:-Math.PI / 2, ta:-Math.PI / 2, alive:true, tl:0, tr:0, ant:0, recoil:0, muzzle:0, flash:0, color:'#fff'};
  const G = CLASSES[ck].g, top = Math.max(G.bl + (G.toff || 0), G.hl + 4) * TS, bot = (G.hl + 4) * TS + 4, s = Math.min(1.05, (h - 6) / (top + bot));
  x.save(); x.translate(w / 2, 3 + top * s); x.scale(s, s); drawTank(x, p, 0); x.restore();
}
