// ============ SOUND: everything is synthesised with WebAudio, no sound files ============
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null, enabled = true, muted = false;
  const engines = [];
  const VOL = .5;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = enabled && !muted ? VOL : 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
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

  return {
    init,
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
