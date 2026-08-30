/* =================================================================
   "Light-Day Gap" v3 — 300-second fulldome film, no controls, no input.
   Square fisheye (equidistant, all-sky) master frame for dome projection.
   0–240s: Voyager 1's real past → present. 240–300s: speculative future.

   "내가 지금 보고 있는 것도 이미 늦게 도착한 것이다."
   ================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('artCanvas');
  const ctx = canvas.getContext('2d');
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');

  const renderModal = document.getElementById('renderModal');
  const renderProgress = document.getElementById('renderProgress');
  const renderStatusText = document.getElementById('renderStatusText');
  const renderTimeText = document.getElementById('renderTimeText');
  const domePanel = document.getElementById('domePanel');
  const btnRecord = document.getElementById('btnRecord');
  const recordDurationSelect = document.getElementById('recordDuration');
  const chapterBtns = Array.from(document.querySelectorAll('.chapter-btn'));

  /* Square fisheye master frame, centered — the dome only ever sees a circle. */
  let w = 1, h = 1;
  function resize() {
    const size = Math.min(window.innerWidth, window.innerHeight);
    w = canvas.width = size; h = canvas.height = size;
    buffer.width = w; buffer.height = h;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------------------------------------------------------------
     Global clock. No modulo, no scene index, nothing resets itself.
  --------------------------------------------------------------- */
  const DURATION = 300000;
  const FADE_MS = 12000;
  const SINGLE_PLAY_MS = DURATION + FADE_MS;
  let elapsed = 0;
  let isMuted = false;
  let lastFrameTime = performance.now();
  let isExporting = false;

  /* ---------------------------------------------------------------
     Math / evolving noise
  --------------------------------------------------------------- */
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const TWO_PI = Math.PI * 2;

  function noise1(x) {
    return (Math.sin(x) * 0.5 + Math.sin(x * 2.13 + 1.7) * 0.25 +
            Math.sin(x * 4.71 + 3.1) * 0.125 + Math.sin(x * 9.23 + 0.4) * 0.0625) / 0.9375;
  }
  function noise2(x, y) { return noise1(x * 1.7 + noise1(y * 0.6) * 3.1); }
  function bump(t, start, peakStart, peakEnd, end) {
    if (t < start || t > end) return 0;
    if (t < peakStart) return smoothstep(start, peakStart, t);
    if (t > peakEnd) return 1 - smoothstep(peakEnd, end, t);
    return 1;
  }

  const PHASE = {};
  ['star', 'sun', 'voy', 'dome', 'scale', 'tension', 'flow'].forEach(k => PHASE[k] = Math.random() * 1000);

  function curveFromPoints(points) {
    return (tSec) => {
      if (tSec <= points[0][0]) return points[0][1];
      for (let i = 1; i < points.length; i++) {
        if (tSec <= points[i][0]) {
          const [t0, v0] = points[i - 1], [t1, v1] = points[i];
          return lerp(v0, v1, smoothstep(t0, t1, tSec));
        }
      }
      return points[points.length - 1][1];
    };
  }

  /* ---------------------------------------------------------------
     0–300s narrative arc.
     0–240s: launch → Jupiter → Saturn → heliopause → present (23:46:00 delay).
     240–300s: speculative future — sparser sky, Voyager nears the rim,
     a single distant point hints at the star it will one day pass near.
  --------------------------------------------------------------- */
  const T = { launch: 20, jupiter: 60, saturn: 100, outer: 160, heliopause: 215, present: 240, end: 300 };

  const sunSizeCurve      = curveFromPoints([[0,1],[20,.82],[60,.5],[100,.32],[160,.17],[215,.08],[240,.05],[300,.015]]);
  const voyagerOutCurve   = curveFromPoints([[0,.02],[20,.14],[60,.34],[100,.52],[160,.72],[215,.88],[240,.93],[260,.96],[300,.985]]);
  const starDensityCurve  = curveFromPoints([[0,.5],[60,.6],[160,.75],[215,.85],[240,.55],[270,.3],[300,.18]]);
  const noiseAmountCurve  = curveFromPoints([[0,.04],[100,.15],[215,.35],[240,.5],[300,.75]]);
  const delayAmountCurve  = curveFromPoints([[0,.4],[100,1.2],[215,3.5],[240,5],[300,1.5]]);
  const harmonicTensionCurve = curveFromPoints([[0,.05],[60,.2],[100,.35],[215,.5],[240,.65],[270,.4],[300,.1]]);
  const domeSpinCurve     = curveFromPoints([[0,.015],[100,.02],[215,.012],[240,.008],[300,.004]]);
  const breathCurve       = curveFromPoints([[0,1],[60,1.08],[100,.95],[215,1.05],[240,1],[300,.85]]);
  const futureCurve       = curveFromPoints([[0,0],[240,0],[260,.4],[280,.75],[300,1]]);

  function curve(name, tSec, evoSpeed, variation, phase) {
    const base = {
      star: starDensityCurve, noise: noiseAmountCurve, delay: delayAmountCurve,
      tension: harmonicTensionCurve, dome: domeSpinCurve, breath: breathCurve, future: futureCurve
    }[name](tSec);
    return base + noise1(tSec * evoSpeed + phase) * variation;
  }

  /* ---------------------------------------------------------------
     Fisheye dome projection — every object lives at (azimuth, elevFromZenith).
     elevFromZenith: 0 = straight up / dome center, 1 = horizon / dome rim.
     This is the only geometry in the piece; there is no flat "camera view".
  --------------------------------------------------------------- */
  let domeAz = Math.random() * TWO_PI;
  let domeSpin = 0.01;
  let domeBurstUntil = 0;

  function toScreen(az, elevFromZenith, radiusScale) {
    const R = (w / 2) * 0.985 * (radiusScale ?? 1);
    const r = clamp01(elevFromZenith) * R;
    const a = az + domeAz;
    return { x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r, r };
  }

  function paletteHue(tSec) { return 195 + noise1(tSec * 0.011 + PHASE.star) * 85 + tSec * 0.08; }

  /* ---------------------------------------------------------------
     Star field — full-sky distribution, independent per-star life.
  --------------------------------------------------------------- */
  const MAX_STARS = 1000;
  let stars = [];
  function spawnStar(tSec) {
    return {
      az: Math.random() * TWO_PI, elev: Math.pow(Math.random(), 0.7),
      size: 0.5 + Math.random() * 2.2, hueOff: (Math.random() - 0.5) * 50,
      flicker: 2 + Math.random() * 8, depth: Math.random(),
      born: tSec, life: 5 + Math.random() * 25, seed: Math.random() * 1000
    };
  }
  for (let i = 0; i < 500; i++) stars.push(spawnStar(0));

  function updateStars(tSec, dt) {
    const targetCount = Math.floor(200 + curve('star', tSec, 0.0015, 0.05, PHASE.star) * MAX_STARS);
    for (const s of stars) {
      const age = tSec - s.born;
      s.az += noise2(s.az, s.seed) * 0.00025 * dt * 60;
      s.elev += noise2(s.elev * 4, s.seed + 50) * 0.00012 * dt * 60;
      s.elev = clamp01(s.elev);
      if (age > s.life) {
        if (Math.random() < 0.06) sfx.starDeath();
        Object.assign(s, spawnStar(tSec));
        if (Math.random() < 0.1) sfx.starSpawn();
      }
    }
    while (stars.length < targetCount && stars.length < MAX_STARS) stars.push(spawnStar(tSec));
    while (stars.length > targetCount + 40) stars.pop();
  }

  function renderStars(tSec, hue) {
    for (const s of stars) {
      const lifeT = clamp01((tSec - s.born) / s.life);
      const fade = Math.min(1, lifeT * 6) * Math.min(1, (1 - lifeT) * 6);
      const flick = 0.5 + 0.5 * Math.sin(tSec * s.flicker + s.seed);
      const alpha = fade * flick * (0.25 + s.depth * 0.6);
      const { x, y } = toScreen(s.az, s.elev, breathAmt);
      ctx.globalAlpha = clamp01(alpha);
      ctx.fillStyle = `hsl(${hue + s.hueOff}, 75%, ${60 + s.depth * 25}%)`;
      ctx.beginPath(); ctx.arc(x, y, s.size * (0.6 + s.depth), 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     The Sun — bright near dome-center at launch, continuously
     shrinking as Voyager's real distance from it grows.
  --------------------------------------------------------------- */
  const SUN_AZ = 0.4;
  function renderSun(tSec) {
    const s = sunSizeCurve(tSec) * 60;
    if (s < 0.5) return;
    const { x, y } = toScreen(SUN_AZ, 0.03, breathAmt);
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
    g.addColorStop(0, `hsla(48, 95%, 85%, .9)`);
    g.addColorStop(0.3, `hsla(40, 95%, 65%, .4)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 3, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, s * 0.4), 0, TWO_PI); ctx.fill();
  }

  /* ---------------------------------------------------------------
     Planets — Jupiter and Saturn are Voyager 1's real flybys and get
     a close, prominent pass; the rest of the solar system drifts by
     as distant ambient scenery, present but never actually visited.
  --------------------------------------------------------------- */
  const PLANETS = [
    { name: 'MERCURY', az: 0.9,  elevBase: .10, orbit: .05, size: 3,  hue: 30,  ambient: true },
    { name: 'VENUS',   az: 1.6,  elevBase: .14, orbit: .04, size: 5,  hue: 45,  ambient: true },
    { name: 'MARS',    az: 2.6,  elevBase: .20, orbit: .03, size: 4,  hue: 10,  ambient: true },
    { name: 'JUPITER', az: 3.4,  elevBase: .30, orbit: .018, size: 22, hue: 35, flyby: [T.launch-5, 32, 48, T.jupiter+10] },
    { name: 'SATURN',  az: 4.3,  elevBase: .42, orbit: .012, size: 18, hue: 48, flyby: [T.jupiter-5, 72, 88, T.saturn+12], ring: true },
    { name: 'URANUS',  az: 5.1,  elevBase: .55, orbit: .008, size: 8,  hue: 190, ambient: true },
    { name: 'NEPTUNE', az: 5.8,  elevBase: .62, orbit: .006, size: 8,  hue: 220, ambient: true }
  ];

  function renderPlanets(tSec) {
    const fade = 1 - smoothstep(T.outer, T.heliopause, tSec); // solar system left behind after heliopause
    for (const p of PLANETS) {
      const az = p.az + tSec * p.orbit;
      let elev = p.elevBase;
      let vis = p.ambient ? fade * 0.6 : 0;
      let sizeMul = 1;
      if (p.flyby) {
        const v = bump(tSec, p.flyby[0], p.flyby[1], p.flyby[2], p.flyby[3]);
        vis = Math.max(vis, v);
        sizeMul = 1 + v * 2.4;
        elev = lerp(p.elevBase, 0.12, v); // swings close to center during the flyby
      }
      if (vis < 0.02) continue;
      const { x, y } = toScreen(az, elev, breathAmt);
      const r = p.size * sizeMul;
      ctx.globalAlpha = clamp01(vis);
      ctx.fillStyle = `hsl(${p.hue}, 55%, 62%)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TWO_PI); ctx.fill();
      if (p.name === 'JUPITER') {
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(1, r * 0.12);
        for (let b = -1; b <= 1; b++) { ctx.beginPath(); ctx.moveTo(x - r, y + b * r * 0.4); ctx.lineTo(x + r, y + b * r * 0.4); ctx.stroke(); }
      }
      if (p.ring) {
        ctx.strokeStyle = `hsla(${p.hue + 10}, 60%, 78%, .8)`; ctx.lineWidth = Math.max(1, r * 0.15);
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.55, 0.4, 0, TWO_PI); ctx.stroke();
      }
      if (vis > 0.5 && Math.abs(elev - 0.12) < 0.02 && Math.random() < 0.01) showCaption(p.name, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Comets — unique, one-shot streaks across the dome. Never repeat.
  --------------------------------------------------------------- */
  const comets = [];
  function spawnComet(tSec, duration) {
    const az0 = Math.random() * TWO_PI, az1 = az0 + (Math.random() - 0.5) * 2.4;
    comets.push({
      start: tSec, dur: duration || (4 + Math.random() * 6),
      az0, az1, elev0: 0.15 + Math.random() * 0.2, elev1: 0.7 + Math.random() * 0.25,
      hue: 190 + Math.random() * 60, trail: []
    });
  }
  function updateAndRenderComets(tSec) {
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      const p = (tSec - c.start) / c.dur;
      if (p > 1) { comets.splice(i, 1); continue; }
      if (p < 0) continue;
      const az = lerp(c.az0, c.az1, smoothstep(0, 1, p));
      const elev = lerp(c.elev0, c.elev1, p);
      c.trail.push({ az, elev });
      if (c.trail.length > 18) c.trail.shift();
      for (let j = 0; j < c.trail.length; j++) {
        const tp = c.trail[j];
        const { x, y } = toScreen(tp.az, tp.elev, breathAmt);
        ctx.globalAlpha = (j / c.trail.length) * 0.7;
        ctx.fillStyle = `hsl(${c.hue}, 80%, 80%)`;
        ctx.beginPath(); ctx.arc(x, y, 2 + (j / c.trail.length) * 2.5, 0, TWO_PI); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Voyager 1 — a single point moving from the inner solar system
     toward the rim of the dome; past Jupiter/Saturn it is mostly
     implied, not depicted, matching the real emptiness of the crossing.
  --------------------------------------------------------------- */
  function voyagerState(tSec) {
    const az = SUN_AZ + 0.15 + noise1(tSec * 0.015 + PHASE.voy) * 0.06;
    const elev = clamp01(voyagerOutCurve(tSec) + noise1(tSec * 0.03 + PHASE.voy) * 0.015);
    return { az, elev };
  }
  let voyagerFlashUntil = 0;
  function renderVoyager(tSec) {
    const { az, elev } = voyagerState(tSec);
    const { x, y } = toScreen(az, elev, breathAmt);
    const flash = tSec < voyagerFlashUntil;
    const baseVis = tSec > T.jupiter - 10 ? 0.55 : 0.85;
    ctx.globalAlpha = flash ? 1 : baseVis;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    const size = flash ? 4.5 : 1.4;
    ctx.beginPath(); ctx.arc(x, y, size, 0, TWO_PI); ctx.fill();
    if (flash) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * 3.5, y - size * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + size * 3.5, y - size * 2, size * 1.2, 0, TWO_PI); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return { x, y };
  }

  /* ---------------------------------------------------------------
     Future segment (240–300s) — sparse sky, a single distant point
     Voyager drifts toward: the real star it will one day pass near.
  --------------------------------------------------------------- */
  function renderFutureBeacon(tSec) {
    const f = clamp01(curve('future', tSec, 0, 0, 0));
    if (f <= 0.01) return;
    const az = SUN_AZ + 0.4, elev = 0.97;
    const { x, y } = toScreen(az, elev, breathAmt);
    ctx.globalAlpha = f * (0.5 + 0.5 * Math.sin(tSec * 1.3));
    ctx.fillStyle = '#dff2ff';
    ctx.beginPath(); ctx.arc(x, y, 1 + f * 2.5, 0, TWO_PI); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Distortion — brief (0.5–3s) post-process events, autonomously
     triggered by the schedule, never by viewer input (there is none).
  --------------------------------------------------------------- */
  let activeDistortion = null;
  function triggerDistortion(kind, dur) { activeDistortion = { kind, start: elapsed / 1000, dur: dur || (0.6 + Math.random() * 2) }; }
  function applyDistortion(tSec) {
    if (!activeDistortion) return;
    const t = tSec - activeDistortion.start;
    if (t > activeDistortion.dur) { activeDistortion = null; return; }
    const strength = Math.sin(clamp01(t / activeDistortion.dur) * Math.PI);
    bctx.clearRect(0, 0, w, h); bctx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    switch (activeDistortion.kind) {
      case 'wave': {
        const strips = 48, sh = h / strips;
        for (let i = 0; i < strips; i++) {
          const off = Math.sin(tSec * 4 + i * 0.4) * 16 * strength;
          ctx.drawImage(buffer, 0, i * sh, w, sh + 1, off, i * sh, w, sh + 1);
        }
        break;
      }
      case 'chroma': {
        const off = 6 * strength;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
        ctx.drawImage(buffer, -off, 0); ctx.drawImage(buffer, off, 0); ctx.drawImage(buffer, 0, off * 0.6);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'pixel': {
        const block = Math.max(2, Math.floor(2 + strength * 20));
        const sw = Math.max(1, Math.floor(w / block)), sh2 = Math.max(1, Math.floor(h / block));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buffer, 0, 0, w, h, 0, 0, sw, sh2);
        ctx.drawImage(canvas, 0, 0, sw, sh2, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        break;
      }
      default: ctx.drawImage(buffer, 0, 0);
    }
    /* re-mask to the dome circle after any post-process */
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }

  /* ---------------------------------------------------------------
     Captions — brief, minimal vocabulary, drawn on the canvas itself
     so they are baked into the exported dome master.
  --------------------------------------------------------------- */
  let caption = null;
  function showCaption(text, dur) { caption = { text, start: elapsed / 1000, dur: dur || (0.4 + Math.random() * 1.2) }; }
  function renderCaption(tSec) {
    if (!caption) return;
    const t = tSec - caption.start;
    if (t > caption.dur) { caption = null; return; }
    const alpha = Math.sin(clamp01(t / caption.dur) * Math.PI);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.font = `300 ${Math.round(w * 0.018)}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(caption.text, w / 2, h * 0.5 - h * 0.32);
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Non-repeating major event schedule across the full 300s arc.
  --------------------------------------------------------------- */
  const EVENTS = [
    { base: 4,   fn: () => { showCaption('EARTH'); triggerDistortion('chroma'); sfx.signalPulse(); } },
    { base: 12,  fn: () => { triggerDistortion('wave'); domeBurstUntil = elapsed/1000 + 2; } },
    { base: 30,  fn: () => { voyagerFlashUntil = elapsed/1000 + 1; sfx.voyagerCue(); } },
    { base: 40,  fn: () => { showCaption('JUPITER', 1.4); triggerDistortion('pixel'); } },
    { base: 58,  fn: () => { for (let i=0;i<20;i++) stars.push(spawnStar(elapsed/1000)); } },
    { base: 70,  fn: () => { voyagerFlashUntil = elapsed/1000 + 1; sfx.voyagerCue(); } },
    { base: 80,  fn: () => { showCaption('SATURN', 1.4); triggerDistortion('wave'); } },
    { base: 96,  fn: () => { spawnComet(elapsed/1000); } },
    { base: 118, fn: () => { spawnComet(elapsed/1000); triggerDistortion('chroma'); } },
    { base: 140, fn: () => { showCaption('SIGNAL'); sfx.signalPulse(); } },
    { base: 163, fn: () => { domeBurstUntil = elapsed/1000 + 3; triggerDistortion('wave', 3); } },
    { base: 178, fn: () => { spawnComet(elapsed/1000); } },
    { base: 196, fn: () => { showCaption('DELAY'); } },
    { base: 215, fn: () => { showCaption('NOW', 1); triggerDistortion('pixel'); } },
    { base: 225, fn: () => { showCaption('23:46:00', 1.8); sfx.signalPulse(); } },
    { base: 240, fn: () => { showCaption('VOYAGER 1', 1.6); triggerDistortion('chroma', 2.5); } },
    { base: 256, fn: () => { stars = stars.slice(0, Math.floor(stars.length * 0.5)); } },
    { base: 270, fn: () => { spawnComet(elapsed/1000, 8); } },
    { base: 288, fn: () => { showCaption('1 LIGHT-DAY', 2.2); } },
    { base: 298, fn: () => { caption = null; } }
  ].map(e => ({ ...e, time: Math.max(0.5, Math.min(299, e.base * (1 + (Math.random()*0.3-0.15)))) * 1000, fired: false }));

  function runEvents(tSec) {
    const ms = tSec * 1000;
    for (const ev of EVENTS) if (!ev.fired && ms >= ev.time) { ev.fired = true; try { ev.fn(); } catch (_) {} }
  }

  /* ---------------------------------------------------------------
     Audio — five drifting layers, no fixed chord progression.
  --------------------------------------------------------------- */
  let audioCtx = null, master = null, earth = null, voyagerVoice = null, lightVoice = null;
  const soundLog = [];

  function evolvingScale(tSec) {
    const root = 50 * Math.pow(2, noise1(tSec * 0.0032 + PHASE.scale) * 1.1);
    const tension = clamp01(curve('tension', tSec, 0.006, 0.15, PHASE.tension));
    const ratios = [1, lerp(1.125,1.06,tension)+noise1(tSec*0.01+1)*0.02, lerp(1.5,1.42,tension)+noise1(tSec*0.012+2)*0.03, lerp(1.78,1.9,tension)+noise1(tSec*0.013+3)*0.03, 2];
    return { root, ratios, tension };
  }
  function makeDrone(w1, w2, filterFreq) {
    const o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
    const f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    o1.type = w1; o2.type = w2; f.type = 'lowpass'; f.frequency.value = filterFreq;
    g.gain.value = 0.001;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    return { o1, o2, f, g };
  }
  function initAudio() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.setValueAtTime(isMuted ? 0.0001 : 0.28, audioCtx.currentTime);
      master.connect(audioCtx.destination);
      earth = makeDrone('sine', 'triangle', 320);
      voyagerVoice = makeDrone('sine', 'sine', 500);
      lightVoice = { filter: audioCtx.createBiquadFilter() };
      lightVoice.filter.type = 'highpass'; lightVoice.filter.frequency.value = 2000;
      lightVoice.filter.connect(master);
      scheduleLightShimmer();
    } catch (e) {}
  }
  function updateAudio(tSec) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime, scale = evolvingScale(tSec);
    earth.o1.frequency.setTargetAtTime(scale.root * 0.5, now, 0.6);
    earth.o2.frequency.setTargetAtTime(scale.root * scale.ratios[1] * 0.5, now, 0.6);
    earth.g.gain.setTargetAtTime(isMuted ? 0.0001 : 0.05, now, 1.2);
    earth.f.frequency.setTargetAtTime(280 + scale.tension * 300, now, 1);
    const voyProx = clamp01(voyagerOutCurve(tSec));
    voyagerVoice.o1.frequency.setTargetAtTime(scale.root * 0.25, now, 1.5);
    voyagerVoice.o2.frequency.setTargetAtTime(scale.root * scale.ratios[4] * 0.25, now, 1.5);
    voyagerVoice.g.gain.setTargetAtTime(isMuted ? 0.0001 : 0.025 + voyProx * 0.07, now, 1.5);
    lightVoice.filter.frequency.setTargetAtTime(1500 + curve('noise', tSec, 0.02, 0.1, PHASE.flow) * 4000, now, 0.5);
  }
  function scheduleLightShimmer() {
    const next = () => {
      if (!audioCtx || elapsed >= DURATION) return;
      if (!isMuted) playBlip(lightVoice.filter, 2000 + Math.random()*3000, 0.05, 0.05);
      setTimeout(next, 90 + Math.random() * 260);
    };
    next();
  }
  function playBlip(dest, freq, dur, vol) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function playDelayedEcho(entry) {
    if (!audioCtx) return;
    const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.connect(master);
    playBlip(f, entry.freq * 0.5, entry.dur * 1.6, entry.vol * 0.35);
  }
  const sfx = {
    starSpawn() { if (!audioCtx || isMuted) return; playBlip(null, 1800 + Math.random()*1400, 0.12, 0.018); },
    starDeath() { if (!audioCtx || isMuted) return; playBlip(null, 200 + Math.random()*80, 0.3, 0.012); },
    signalPulse() {
      if (!audioCtx || isMuted) return;
      const scale = evolvingScale(elapsed / 1000);
      const freq = scale.root * scale.ratios[2] * 3;
      playBlip(null, freq, 0.25, 0.06);
      soundLog.push({ t: elapsed/1000, freq, dur: 0.25, vol: 0.06, played: false });
    },
    voyagerCue() {
      if (!audioCtx || isMuted) return;
      const scale = evolvingScale(elapsed / 1000);
      setTimeout(() => playBlip(null, scale.root * 0.5, 1.4, 0.05), 200 + Math.random()*600);
    }
  };
  function updateDelayLayer(tSec) {
    const delaySec = curve('delay', tSec, 0.008, 0.6, PHASE.tension);
    for (const e of soundLog) if (!e.played && tSec - e.t >= delaySec) { e.played = true; playDelayedEcho(e); }
    while (soundLog.length && tSec - soundLog[0].t > 14) soundLog.shift();
  }

  /* Silent audio unlock — no visible prompt, any first gesture works. */
  document.body.addEventListener('click', () => { if (!audioCtx) initAudio(); }, { once: true });
  document.body.addEventListener('touchstart', () => { if (!audioCtx) initAudio(); }, { once: true, passive: true });
  document.body.addEventListener('keydown', () => { if (!audioCtx) initAudio(); }, { once: true });

  /* ---------------------------------------------------------------
     Main render loop.
  --------------------------------------------------------------- */
  let breathAmt = 1;
  function render(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    if (elapsed < DURATION) elapsed += (now - (render.prevReal ?? now));
    render.prevReal = now;
    const tSec = elapsed / 1000;

    runEvents(tSec);
    if (elapsed < DURATION) {
      updateStars(tSec, dt);
      updateDelayLayer(tSec);
      updateAudio(tSec);
      domeSpin = curve('dome', tSec, 0.01, 0.006, PHASE.dome) * (tSec < domeBurstUntil ? 6 : 1);
      domeAz += domeSpin * dt;
      breathAmt = curve('breath', tSec, 0.02, 0.03, PHASE.sun);
    }

    const hue = paletteHue(tSec);
    const endFade = elapsed > DURATION ? clamp01((elapsed - DURATION) / FADE_MS) : 0;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, TWO_PI); ctx.clip();
    ctx.fillStyle = '#01030a'; ctx.fillRect(0, 0, w, h);
    renderStars(tSec, hue);
    renderSun(tSec);
    renderPlanets(tSec);
    updateAndRenderComets(tSec);
    renderVoyager(tSec);
    renderFutureBeacon(tSec);
    ctx.restore();

    applyDistortion(tSec);
    renderCaption(tSec);

    if (endFade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${endFade})`;
      ctx.fillRect(0, 0, w, h);
      if (master && audioCtx) master.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 3);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  /* ---------------------------------------------------------------
     Producer/preview panel — invisible to a dome audience (nobody
     touches a mouse during an actual show), revealed only on pointer
     movement. Lets someone jump to a chapter to check it looks right,
     and record the full 300s master from a visible RECORD button.
  --------------------------------------------------------------- */
  let panelHideTimer = null;
  function showPanel() {
    domePanel.classList.add('visible');
    clearTimeout(panelHideTimer);
    panelHideTimer = setTimeout(() => domePanel.classList.remove('visible'), 3000);
  }
  window.addEventListener('pointermove', showPanel);
  window.addEventListener('touchstart', showPanel, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') startExport();
    if (e.key === 'm' || e.key === 'M') toggleMute();
  });

  function toggleMute() {
    isMuted = !isMuted;
    if (master && audioCtx) master.gain.linearRampToValueAtTime(isMuted ? 0.0001 : 0.28, audioCtx.currentTime + 0.3);
  }

  /* Jumping to a chapter re-derives every continuous system (stars,
     planets, sun, dome rotation are all pure functions of elapsed
     time) and marks past one-shot events as already-fired so a jump
     doesn't dump their stale captions/blips all at once — the scene
     still looks fully populated for whichever moment was picked. */
  function jumpTo(tSec) {
    elapsed = tSec * 1000;
    render.prevReal = performance.now();
    caption = null;
    activeDistortion = null;
    comets.length = 0;
    voyagerFlashUntil = 0;
    domeBurstUntil = 0;
    for (const ev of EVENTS) ev.fired = ev.time <= elapsed;
  }

  chapterBtns.forEach(btn => {
    btn.addEventListener('click', () => jumpTo(parseFloat(btn.dataset.t)));
  });

  btnRecord.addEventListener('click', () => startExport());

  // '5' maps to the full single play-through (narrative + its 12s fade-out),
  // not a hard 300000ms cut, so the default export ends resolved rather than
  // abruptly mid-fade.
  const RECORD_DURATIONS = { '1': 60000, '5': SINGLE_PLAY_MS, '10': 600000, '40': 2400000 };

  function formatClock(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function pickSupportedMimeType() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    for (const mt of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mt)) return mt;
    }
    return '';
  }

  async function startExport() {
    if (isExporting) return;

    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      alert('This browser does not support video recording. Please try a recent Chrome/Edge browser.');
      return;
    }

    const minutes = recordDurationSelect.value;
    const RECORD_TOTAL = RECORD_DURATIONS[minutes] || DURATION;

    isExporting = true;
    btnRecord.disabled = true;
    btnRecord.textContent = 'RECORDING…';
    recordDurationSelect.disabled = true;
    chapterBtns.forEach(b => b.disabled = true);
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();

    renderModal.classList.add('show');
    renderProgress.style.width = '0%';
    renderStatusText.textContent = '0%';
    renderTimeText.textContent = `00:00 / ${formatClock(RECORD_TOTAL)}`;

    let poll = null;

    function cleanupUI() {
      isExporting = false;
      btnRecord.disabled = false;
      btnRecord.textContent = '● RECORD';
      recordDurationSelect.disabled = false;
      chapterBtns.forEach(b => b.disabled = false);
      if (poll) { clearInterval(poll); poll = null; }
    }

    try {
      const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
      const tracks = [videoTrack];
      if (audioCtx && master) {
        const dest = audioCtx.createMediaStreamDestination();
        master.connect(dest);
        const track = dest.stream.getAudioTracks()[0];
        if (track) tracks.push(track);
      }
      const combinedStream = new MediaStream(tracks);

      const mimeType = pickSupportedMimeType();
      const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const recorder = mimeType
        ? new MediaRecorder(combinedStream, { mimeType })
        : new MediaRecorder(combinedStream);
      const chunks = [];

      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      recorder.onerror = (e) => {
        cleanupUI();
        renderModal.classList.remove('show');
        alert('Recording error: ' + (e.error ? e.error.message : 'unknown error'));
      };

      recorder.onstop = () => {
        cleanupUI();

        if (chunks.length === 0) {
          renderModal.classList.remove('show');
          alert('No video data was captured. Please try again.');
          return;
        }

        renderStatusText.textContent = 'Saving...';

        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `light_day_gap_dome_${minutes}min_${Date.now()}.${fileExt}`;
        document.body.appendChild(a);
        a.click();

        // Long recordings can produce large files; revoking the object URL
        // right after click() can cut the download off before the browser
        // finishes writing it, so keep it alive well past that.
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 30000);

        renderModal.classList.remove('show');
      };

      // Reset the narrative to the start for a clean master take. If the
      // requested length is longer than one play-through (DURATION + fade),
      // the poll below seamlessly restarts it so the export becomes a
      // continuous multi-loop file rather than mostly a black/silent tail —
      // the on-screen single-play behavior for a live dome show is unaffected.
      elapsed = 0; render.prevReal = performance.now();
      EVENTS.forEach(ev => ev.fired = false);
      comets.length = 0;
      recorder.start(1000);

      const recordStartWall = Date.now();
      poll = setInterval(() => {
        const recElapsed = Date.now() - recordStartWall;
        const pct = Math.min(100, Math.floor((recElapsed / RECORD_TOTAL) * 100));
        renderProgress.style.width = `${pct}%`;
        renderStatusText.textContent = `${pct}%`;
        renderTimeText.textContent = `${formatClock(Math.min(recElapsed, RECORD_TOTAL))} / ${formatClock(RECORD_TOTAL)}`;

        if (elapsed >= SINGLE_PLAY_MS && recElapsed < RECORD_TOTAL - 500) {
          elapsed = 0; render.prevReal = performance.now();
          EVENTS.forEach(ev => ev.fired = false);
          comets.length = 0;
          if (master && audioCtx) master.gain.setTargetAtTime(isMuted ? 0.0001 : 0.28, audioCtx.currentTime, 0.3);
        }

        if (recElapsed >= RECORD_TOTAL) {
          clearInterval(poll); poll = null;
          renderStatusText.textContent = 'Encoding...';
          if (recorder.state !== 'inactive') recorder.stop();
        }
      }, 250);
    } catch (err) {
      cleanupUI();
      renderModal.classList.remove('show');
      alert('Recording error: ' + err.message);
    }
  }
});
