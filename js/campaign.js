// ============ CAMPAIGN: 8 missions against the CPU, progress saved in the browser ============
const CAMPAIGN = [
  {title:'Boot Camp',     map:'grass',  enemy:'scout',    ab:'repair', diff:'easy',   rounds:2, hp:1,    name:'RECRUIT',
   brief:'Welcome, commander. A light Scout is racing around the training grounds. Show it what a real tank can do.', reward:'hydra'},
  {title:'Desert Patrol', map:'desert', enemy:'striker',  ab:'over',   diff:'easy',   rounds:2, hp:1,    name:'PATROL',
   brief:'Enemy patrols were spotted near the desert outpost. Drive them back into the dunes.', reward:'brawler'},
  {title:'Rocket Alley',  map:'desert', enemy:'viper',    ab:'emp',    diff:'medium', rounds:2, hp:1,    name:'VIPER',
   brief:'A rocket tank guards the supply road. Its missiles follow you, so use walls to break their lock.', reward:'viper'},
  {title:'Frozen Front',  map:'winter', enemy:'sapper',   ab:'repair', diff:'medium', rounds:2, hp:1,    name:'SAPPER',
   brief:'The town streets are being mined. Watch where you drive and stop the engineer before every road is trapped.', reward:'sapper'},
  {title:'Iron Rain',     map:'grass',  enemy:'howitzer', ab:'air',    diff:'medium', rounds:2, hp:1.15, name:'GUNNER',
   brief:'Enemy artillery is shelling our lines and calling in bombers. Close the distance and silence the guns.', reward:'howitzer'},
  {title:'Silent Lancer', map:'desert', enemy:'sniper',   ab:'dome',   diff:'hard',   rounds:2, hp:1.15, name:'LANCER', aim:'off',
   brief:'An elite sniper hides among the dunes. Your aim line is jammed for this mission: trust your instincts.', reward:'sniper'},
  {title:'The Tiger',     map:'winter', enemy:'tiger',    ab:'dome',   diff:'hard',   rounds:2, hp:1.3,  name:'TIGER',
   brief:'A heavy Tiger leads the enemy armour through the town. Its 88 mm gun is deadly. Keep moving and flank it.', reward:'tiger'},
  {title:'Final Assault', map:'grass',  enemy:'maus',     ab:'air',    diff:'hard',   rounds:2, hp:1.6,  name:'GEN. KRIEG',
   brief:'General Krieg himself commands the super-heavy Maus, with bombers on call. Destroy it and the war is won.', reward:'maus'},
  // ---- Act II: Counterattack ----
  {title:'Night Raid',      map:'grass',  enemy:'striker',  ab:'emp',    diff:'medium', rounds:2, hp:1.2,  name:'NIGHTHAWK', night:true,
   brief:'Krieg\'s survivors strike under cover of darkness. You only see what your headlights reach, but watch for their beams.', reward:'black'},
  {title:'Minefield',       map:'desert', enemy:'sapper',   ab:'over',   diff:'medium', rounds:2, hp:1.2,  name:'MOLE', mines:12,
   brief:'The desert is full of buried mines, barely visible in the sand. Pick your path carefully, or let the enemy find them for you.', reward:'stripes'},
  {title:'Blitz',           map:'winter', enemy:'scout',    ab:'over',   diff:'hard',   rounds:2, hp:1.3,  name:'BLITZ', zoneDelay:12,
   brief:'A lightning-fast Scout squad. The danger zone starts closing after only 12 seconds, so there is no time to hide.', reward:'winter'},
  {title:'Rocket Storm',    map:'desert', enemy:'viper',    ab:'air',    diff:'hard',   rounds:2, hp:1.2,  name:'STORM', enemyCharge:5, night:true,
   brief:'A rocket battery calls in bombers twice as often as usual, at night. Keep moving and break line of sight.', reward:'urban'},
  {title:'Duel of Giants',  map:'grass',  enemy:'maus',     ab:'dome',   diff:'hard',   rounds:2, hp:1.1,  name:'COLOSSUS', player:'maus',
   brief:'Command has given you a Maus for this one. Two super-heavies, one battlefield. May the thicker armour win.', reward:'navy'},
  {title:'Lightweight',     map:'winter', enemy:'tiger',    ab:'repair', diff:'hard',   rounds:2, hp:1.2,  name:'IRON TIGER', player:'l33',
   brief:'Only an L33 is left in the garage. Use its speed to dance around the Tiger\'s slow turret.', reward:'red'},
  {title:'No Supplies',     map:'desert', enemy:'howitzer', ab:'air',    diff:'hard',   rounds:2, hp:1.35, name:'BOMBARDIER', noPU:true, aim:'off',
   brief:'Supply lines are cut: no power-ups, and your targeting computer is down. Pure skill against heavy artillery.', reward:'desert'},
  {title:'Krieg\'s Revenge', map:'winter', enemy:'maus',   ab:'emp',    diff:'hard',   rounds:3, hp:1.9,  name:'GEN. KRIEG', night:true, enemyCharge:6,
   brief:'Krieg escaped in a rebuilt Maus and attacks the town at night. Best of five. End this war for good.', reward:'gold'},
];
const ACTS = [{name:'Act I: Invasion', from:0, to:8}, {name:'Act II: Counterattack', from:8, to:16}];
const CAMP_START = ['l33', 'scout', 'striker', 'phoenix'];
const DIFF_NAME = {easy:'Easy', medium:'Medium', hard:'Hard'};

let camp = {stars:[]};   // best star rating per mission (0 = not completed)
try { Object.assign(camp, JSON.parse(localStorage.getItem('tankduel-campaign') || '{}')); } catch (e) {}
const saveCamp = () => { try { localStorage.setItem('tankduel-campaign', JSON.stringify(camp)); } catch (e) {} };
const campDone = i => (camp.stars[i] || 0) > 0;
const missionOpen = i => i === 0 || campDone(i - 1);
const campTanks = () => new Set([...CAMP_START, ...CAMPAIGN.filter((m, i) => campDone(i)).map(m => m.reward)]);
const paintsOwned = () => ['olive', ...CAMPAIGN.filter((m, i) => campDone(i) && PAINTS[m.reward]).map(m => m.reward)];
const paintOk = k => paintsOwned().includes(k) ? k : 'olive';
const tankLocked = k => settings.mode === 'campaign' && !campTanks().has(k);
let campResult = null;

function launchMission(i) {
  const M = CAMPAIGN[i];
  if (!M || !missionOpen(i)) return;
  if (tankLocked(settings.p1)) settings.p1 = 'striker';
  settings.mission = i; saveSettings();
  players[0].ck = M.player || settings.p1; players[0].ab = settings.a1; players[1].ck = M.enemy; players[1].ab = M.ab;
  campResult = null; hideMenu();
  startMatch('campaign', {turret:settings.turret, map:M.map, aim:M.aim || settings.aim, diff:M.diff, rounds:M.rounds, enemyHp:M.hp, enemyName:M.name, mission:i,
    night:!!M.night, mines:M.mines || 0, zoneDelay:M.zoneDelay, noPU:!!M.noPU, enemyCharge:M.enemyCharge || 0});
}
function campaignResult(winner) {
  const i = opts.mission, M = CAMPAIGN[i];
  if (winner && winner.idx === 0) {
    const stars = Math.max(1, 3 - players[1].wins), first = !campDone(i);
    camp.stars[i] = Math.max(camp.stars[i] || 0, stars); saveCamp();
    campResult = {win:true, stars, unlocked:first ? M.reward : null, last:i === CAMPAIGN.length - 1};
  } else campResult = {win:false};
}
function campaignNext() {
  const i = opts.mission;
  if (campResult && campResult.win) { if (i < CAMPAIGN.length - 1) launchMission(i + 1); else quitToMenu(); }
  else launchMission(i);
}
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);

function renderCampaign() {
  const list = document.getElementById('mlist'); if (!list) return;
  if (!missionOpen(settings.mission | 0)) settings.mission = 0;
  const sel = settings.mission | 0, act = ACTS.findIndex(a => sel >= a.from && sel < a.to), done = CAMPAIGN.filter((m, i) => campDone(i)).length;
  document.getElementById('campProgress').textContent = `${done} / ${CAMPAIGN.length} missions · ${camp.stars.reduce((a, b) => a + (b || 0), 0)} / ${CAMPAIGN.length * 3} ★`;
  const tabs = document.getElementById('acttabs');
  tabs.innerHTML = ACTS.map((a, k) => { const open = missionOpen(a.from); return `<button data-k="${k}" class="${k === act ? 'on' : ''}" ${open ? '' : 'disabled'}>${a.name}${open ? '' : ' (locked)'}</button>`; }).join('');
  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const A = ACTS[+b.dataset.k]; let m = A.from; for (let i = A.from; i < A.to; i++) if (missionOpen(i)) m = i; settings.mission = m; saveSettings(); Sfx.ui(); b.blur(); renderCampaign(); }));
  const A = ACTS[act];
  list.innerHTML = CAMPAIGN.slice(A.from, A.to).map((m, k) => {
    const i = A.from + k, open = missionOpen(i), st = camp.stars[i] || 0;
    return `<button class="mitem${i === sel ? ' on' : ''}${open ? '' : ' locked'}" data-i="${i}" ${open ? '' : 'disabled'}>
      <span class="mn">${i + 1}</span><span class="mt">${open ? m.title : 'Locked'}</span><span class="ms">${open ? (st ? starStr(st) : 'NEW') : ''}</span></button>`;
  }).join('');
  list.querySelectorAll('.mitem').forEach(b => b.addEventListener('click', () => { settings.mission = +b.dataset.i; saveSettings(); Sfx.ui(); b.blur(); renderCampaign(); }));
  const M = CAMPAIGN[sel], E = CLASSES[M.enemy], isTank = !!CLASSES[M.reward];
  const mods = [M.night && 'Night', M.mines && 'Minefield', M.zoneDelay && `Zone at ${M.zoneDelay}s`, M.noPU && 'No power-ups', M.aim && 'No aim line',
    M.enemyCharge && 'Enemy ability charges fast', M.player && `Assigned tank: ${CLASSES[M.player].name}`, M.hp > 1 && `Enemy armour +${Math.round((M.hp - 1) * 100)}%`].filter(Boolean);
  document.getElementById('brief').innerHTML = `
    <div class="bt"><b>Mission ${sel + 1}: ${M.title}</b>${camp.stars[sel] ? `<span class="bstars">${starStr(camp.stars[sel])}</span>` : ''}</div>
    <div class="chips"><span>${MAPS.find(x => x.id === M.map).name}</span><span>${DIFF_NAME[M.diff]}</span><span>Best of ${M.rounds * 2 - 1}</span>${mods.map(t => `<span class="warn">${t}</span>`).join('')}</div>
    <p>${M.brief}</p>
    <div class="vs"><div><canvas id="briefEnemy" width="64" height="70"></canvas><small>Enemy<br><b>${E.name}</b> · ${ABILITIES[M.ab].name}</small></div>
    <div><canvas id="briefReward" width="64" height="70"></canvas><small>Reward<br><b>${campDone(sel) ? 'Unlocked' : 'Unlocks'} ${isTank ? CLASSES[M.reward].name : PAINTS[M.reward].name + ' paint'}</b></small></div></div>`;
  tankPreview(document.getElementById('briefEnemy'), M.enemy, 1);
  if (isTank) tankPreview(document.getElementById('briefReward'), M.reward, 0, PAINTS[paintOk(settings.paint)]);
  else tankPreview(document.getElementById('briefReward'), M.player || settings.p1, 0, PAINTS[M.reward]);
}
// paint picker for your tank (paints are unlocked in Act II)
let shownPaint = null;
function renderPaints() {
  const box = document.getElementById('paints'); if (!box) return;
  const owned = paintsOwned(), cur = paintOk(settings.paint);
  box.parentElement.style.display = settings.mode === 'online' ? 'none' : '';
  box.innerHTML = Object.keys(PAINTS).map(k => {
    const P = PAINTS[k], own = owned.includes(k);
    return `<button data-v="${k}" class="sw${k === cur ? ' on' : ''}${own ? '' : ' locked'}" title="${own ? P.name : P.name + ' (win Act II missions to unlock)'}" style="--a:${P.base};--b:${P.camo};--c:${P.camo2}"></button>`;
  }).join('') + `<span class="pname">${PAINTS[cur].name} <em>${owned.length}/${Object.keys(PAINTS).length}</em></span>`;
  box.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('locked')) { toast('Win Act II campaign missions to unlock this paint'); b.blur(); return; }
    settings.paint = b.dataset.v; saveSettings(); Sfx.ui(); b.blur(); renderMenu();
  }));
  if (shownPaint !== cur) {   // repaint the tank pictures in the Blue player's picker
    shownPaint = cur;
    const pk = document.querySelector('.picker[data-opt=p1]');
    pk.querySelectorAll('.tthumb').forEach(c => tankPreview(c.querySelector('canvas'), c.dataset.v, 0, PAINTS[cur]));
    pk.dataset.shown = '';
  }
}
