// ============ SOUND: everything is synthesised with WebAudio, no sound files ============
const Sfx = (() => {
  let ac = null, master = null, comp = null, noiseBuf = null, enabled = true, muted = false;
  const engines = [];
  const VOL = .5;

  function init() {
    if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}   // unlocks audio on Safari/iOS
    master = ac.createGain(); master.gain.value = enabled && !muted ? VOL : 0;
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const apply = () => { if (master) master.gain.setTargetAtTime(enabled && !muted ? VOL : 0, ac.currentTime, .03); };
  function out(pan) {
    const g = ac.createGain();
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); g.connect(p); p.connect(master); }
    else g.connect(master);
    return g;
  }
  function noise(t0, dur, {type = 'lowpass', f0 = 2000, f1 = 200, q = 1, vol = .5, pan = 0} = {}) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = out(pan); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
    s.connect(f); f.connect(g); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
  }
  function tone(t0, dur, {type = 'sine', f0 = 440, f1 = null, vol = .3, pan = 0, attack = .005} = {}) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = out(pan); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); o.start(t0); o.stop(t0 + dur + .05);
  }
  const S = fn => (...a) => { if (!ac || !enabled || muted) return; fn(ac.currentTime, ...a); };

  // ---------- menu music: a looping military march in D minor, scheduled live ----------
  const Music = (() => {
    const BPM = 100, STEP = 60 / BPM / 4, BARS = 8;
    const mf = m => 440 * Math.pow(2, (m - 69) / 12);
    const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];   // Dm  Bb  Gm  A
    const BASS = [38, 34, 31, 33];
    const MELODY = [   // [step, midi note, length in steps] for each of the 8 bars
      [[0, 62, 6], [6, 65, 2], [8, 69, 6], [14, 67, 2]], [[0, 65, 4], [4, 62, 4], [8, 70, 8]],
      [[0, 67, 6], [6, 65, 2], [8, 62, 4], [12, 65, 4]], [[0, 64, 8], [8, 61, 4], [12, 64, 4]],
      [[0, 69, 4], [4, 72, 4], [8, 74, 8]], [[0, 72, 4], [4, 70, 4], [8, 69, 4], [12, 65, 4]],
      [[0, 67, 4], [4, 70, 4], [8, 74, 4], [12, 72, 4]], [[0, 73, 8], [8, 69, 8]],
    ];
    let on = false, bus = null, timer = null, step = 0, nextT = 0;
    const env = (g, t, a, peak, rel, end) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, Math.max(t + a, end - rel)); g.gain.exponentialRampToValueAtTime(.0001, end); };
    function voice(t, freq, dur, {type = 'sawtooth', detune = 0, cut = 1200, cutEnd = null, a = .02, peak = .1, rel = .1, vib = 0} = {}) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
      if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + .1); }
      f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); if (cutEnd) f.frequency.exponentialRampToValueAtTime(cutEnd, t + dur);
      env(g, t, a, peak, rel, t + dur);
      o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .05);
    }
    function hit(t, dur, {type = 'bandpass', f0 = 1800, f1 = 900, q = .8, vol = .2} = {}) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + .05);
    }
    function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .22); g.gain.setValueAtTime(.7, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .32); }
    function snare(t, v) { hit(t, .16, {f0:2200, f1:1200, q:.7, vol:v}); voice(t, 200, .07, {type:'triangle', cut:3000, a:.002, peak:v * .5, rel:.05}); }
    function timpani(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(58, t + 1.2); g.gain.setValueAtTime(.55, t); g.gain.exponentialRampToValueAtTime(.0001, t + 1.5); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 1.55); hit(t, .25, {type:'lowpass', f0:400, f1:120, vol:.25}); }
    function schedule(s, t) {
      const bar = Math.floor(s / 16) % BARS, st = s % 16, ch = bar % 4;
      if (st === 0) {
        for (const n of CHORDS[ch]) for (const d of [-7, 7]) voice(t, mf(n + 12), STEP * 16, {detune:d, cut:1000, a:.35, peak:.028, rel:.5});
        if (bar % 4 === 0) timpani(t);
      }
      if (st % 2 === 0) voice(t, mf(BASS[ch] + (st === 6 || st === 14 ? 12 : 0)), STEP * 1.8, {cut:420, cutEnd:220, a:.01, peak:.14, rel:.08});
      if (st === 0 || st === 8 || (st === 10 && bar % 2)) kick(t);
      if (st === 4 || st === 12) snare(t, .2);
      if ((bar % 4 === 3) && st >= 12) snare(t, .07 + (st - 12) * .03);   // roll into the next phrase
      else if (st % 4 === 2) snare(t, .035);                              // ghost notes
      if (st % 2 === 1) hit(t, .04, {type:'highpass', f0:7000, f1:6000, vol:.035});
      for (const [ms, n, len] of MELODY[bar]) if (ms === st) {
        voice(t, mf(n), STEP * len, {cut:2400, cutEnd:1400, a:.03, peak:.075, rel:.12, vib:6});
        voice(t, mf(n), STEP * len, {detune:9, cut:2000, a:.04, peak:.05, rel:.12, vib:5});
        voice(t, mf(n - 12), STEP * len, {type:'triangle', cut:1500, a:.03, peak:.05, rel:.1});
      }
    }
    function tick() { if (nextT < ac.currentTime - .1) nextT = ac.currentTime + .05; while (nextT < ac.currentTime + .2) { schedule(step, nextT); nextT += STEP; step = (step + 1) % (16 * BARS); } }
    return {
      start() {
        if (!ac || on) return; on = true;
        bus = ac.createGain(); bus.gain.setValueAtTime(.0001, ac.currentTime); bus.gain.exponentialRampToValueAtTime(.8, ac.currentTime + 1.2); bus.connect(comp);
        step = 0; nextT = ac.currentTime + .1; tick(); timer = setInterval(tick, 25);
      },
      stop() {
        if (!on) return; on = false; clearInterval(timer);
        const b = bus; b.gain.cancelScheduledValues(ac.currentTime); b.gain.setValueAtTime(b.gain.value, ac.currentTime); b.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + 1);
        setTimeout(() => b.disconnect(), 1500);
      },
      get playing() { return on; },
      get audible() { return on && ac && ac.state === 'running'; },
    };
  })();

  return {
    init, music:Music, get ready() { return !!ac && ac.state === 'running'; },
    setEnabled(v) { enabled = v; apply(); },
    setMuted(v) { muted = v; apply(); },
    fire: S((t, pan, heavy) => { noise(t, .35, {f0:3200, f1:150, vol:.55, pan}); tone(t, .28, {f0:heavy ? 100 : 150, f1:38, vol:.7, pan}); }),
    rail: S((t, pan) => { noise(t, .3, {type:'bandpass', f0:5000, f1:700, q:.8, vol:.45, pan}); tone(t, .22, {type:'sawtooth', f0:1400, f1:110, vol:.16, pan}); tone(t, .3, {f0:130, f1:40, vol:.6, pan}); }),
    ricochet: S((t, pan) => { const f = 1400 + Math.random() * 1000; tone(t, .22, {type:'triangle', f0:f, f1:f * .55, vol:.16, pan}); noise(t, .05, {type:'highpass', f0:6000, f1:3000, vol:.12, pan}); }),
    hit: S((t, pan) => { tone(t, .18, {type:'square', f0:220, f1:90, vol:.15, pan}); tone(t, .35, {type:'triangle', f0:660, f1:420, vol:.14, pan}); noise(t, .16, {type:'bandpass', f0:2600, f1:900, q:2, vol:.4, pan}); }),
    explode: S((t, pan) => { noise(t, 1.5, {f0:2000, f1:50, vol:.9, pan}); tone(t, .9, {f0:85, f1:24, vol:.9, pan}); noise(t + .04, .5, {type:'bandpass', f0:700, f1:150, q:.7, vol:.4, pan}); }),
    mine: S((t, pan) => { noise(t, 1, {f0:1500, f1:60, vol:.8, pan}); tone(t, .6, {f0:110, f1:30, vol:.8, pan}); }),
    wood: S((t, pan) => { noise(t, .14, {type:'bandpass', f0:1400, f1:500, q:3, vol:.35, pan}); tone(t, .06, {type:'square', f0:260, f1:140, vol:.06, pan}); }),
    woodBreak: S((t, pan) => { for (let i = 0; i < 4; i++) noise(t + i * .035, .12, {type:'bandpass', f0:1300 - i * 160, f1:300, q:4, vol:.35, pan}); noise(t, .45, {f0:900, f1:90, vol:.4, pan}); }),
    sand: S((t, pan) => { noise(t, .22, {f0:700, f1:90, vol:.45, pan}); }),
    sandBreak: S((t, pan) => { noise(t, .6, {f0:1100, f1:60, vol:.6, pan}); }),
    pickup: S((t, pan) => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * .055, .16, {type:'triangle', f0:f, vol:.2, pan})); }),
    shieldPop: S((t, pan) => { noise(t, .3, {type:'highpass', f0:3500, f1:900, vol:.3, pan}); tone(t, .35, {f0:1000, f1:180, vol:.2, pan}); }),
    mineDrop: S((t, pan) => { tone(t, .07, {type:'square', f0:320, vol:.08, pan}); tone(t + .1, .07, {type:'square', f0:480, vol:.08, pan}); }),
    spawn: S(t => { tone(t, .25, {type:'sine', f0:600, f1:1200, vol:.08}); }),
    beep: S((t, hi) => { tone(t, hi ? .45 : .14, {type:'square', f0:hi ? 880 : 440, vol:.1}); }),
    zone: S(t => { for (let i = 0; i < 3; i++) tone(t + i * .35, .3, {type:'sawtooth', f0:200, f1:140, vol:.1}); }),
    ui: S(t => { tone(t, .05, {type:'triangle', f0:900, vol:.07}); }),
    jet: S(t => { const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .7;
      f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2200, t + 1.8); f.frequency.linearRampToValueAtTime(500, t + 3);
      const g = out(0); g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.5, t + 1.7); g.gain.exponentialRampToValueAtTime(.001, t + 3.2); s.connect(f); f.connect(g); s.start(t); s.stop(t + 3.3);
      tone(t, .5, {type:'square', f0:660, vol:.05}); tone(t + .55, .5, {type:'square', f0:520, vol:.05}); }),
    whistle: S((t, pan) => { tone(t, .45, {type:'sine', f0:1500, f1:500, vol:.07, pan}); }),
    zap: S((t, pan) => { tone(t, .5, {type:'sawtooth', f0:1800, f1:80, vol:.18, pan}); noise(t, .4, {type:'highpass', f0:6000, f1:2000, vol:.3, pan}); tone(t, .7, {f0:60, f1:30, vol:.4, pan}); }),
    rev: S((t, pan) => { tone(t, .6, {type:'sawtooth', f0:90, f1:320, vol:.14, pan}); tone(t, .6, {type:'square', f0:45, f1:160, vol:.08, pan}); }),
    heal: S((t, pan) => { [523, 784, 1047, 1319].forEach((f, i) => tone(t + i * .07, .35, {type:'sine', f0:f, vol:.14, pan})); }),
    dome: S((t, pan) => { tone(t, .8, {type:'triangle', f0:220, f1:880, vol:.16, pan}); tone(t + .1, .8, {type:'sine', f0:440, f1:1320, vol:.1, pan}); }),
    domeHit: S((t, pan) => { tone(t, .25, {type:'triangle', f0:1600, f1:1200, vol:.12, pan}); }),
    ready: S(t => { tone(t, .12, {type:'triangle', f0:880, vol:.12}); tone(t + .12, .2, {type:'triangle', f0:1320, vol:.12}); }),
    rocket: S((t, pan) => { noise(t, .6, {type:'bandpass', f0:900, f1:2500, q:.8, vol:.4, pan}); tone(t, .25, {f0:200, f1:80, vol:.3, pan}); }),
    win: S(t => { [392, 523, 659, 784].forEach((f, i) => tone(t + i * .12, .4, {type:'triangle', f0:f, vol:.18})); }),
    // continuous engine hum per tank
    engine(i, level, pan, on) {
      if (!ac) return;
      let e = engines[i];
      if (!e) {
        const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
        o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = 7; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0;
        const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
        o1.connect(f); o2.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(master); } else g.connect(master);
        o1.start(); o2.start(); e = engines[i] = {o1, o2, f, g, p};
      }
      const t = ac.currentTime, live = on && enabled && !muted;
      e.o1.frequency.setTargetAtTime(38 + level * 46, t, .1); e.o2.frequency.setTargetAtTime(19 + level * 23, t, .1);
      e.f.frequency.setTargetAtTime(200 + level * 500, t, .1);
      e.g.gain.setTargetAtTime(live ? .035 + level * .07 : 0, t, .08);
      if (e.p) e.p.pan.setTargetAtTime(clamp(pan, -1, 1), t, .1);
    },
  };
})();
