/* =================================================================
   "Light-Day Gap" v2 — 300-second non-looping generative audiovisual piece
   "내가 지금 보고 있는 것도 이미 늦게 도착한 것이다."

   One global clock, zero modulo scene-cycling. Every visual/audio system
   is a continuous function of elapsed time (curve + drifting noise) plus
   a one-shot, non-repeating event schedule. Nothing here is designed to
   return to a prior state.
   ================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('artCanvas');
  const ctx = canvas.getContext('2d');
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnSound = document.getElementById('btnSound');
  const soundIcon = document.getElementById('soundIcon');
  const btnExportVideo = document.getElementById('btnExportVideo');
  const timeLabel = document.getElementById('timeLabel');
  const toolbar = document.querySelector('.bottom-toolbar');

  const renderModal = document.getElementById('renderModal');
  const renderProgress = document.getElementById('renderProgress');
  const renderStatusText = document.getElementById('renderStatusText');

  let w = 1, h = 1;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    buffer.width = w; buffer.height = h;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------------------------------------------------------------
     Global clock — the only source of truth for "when we are".
     No modulo. No scene index. State is always derived from elapsed.
  --------------------------------------------------------------- */
  const DURATION = 300000; // exactly 5 minutes, always
  let startTime = performance.now();
  let elapsed = 0;
  let isPlaying = true;
  let isMuted = false;
  let lastFrameTime = performance.now();
  let isExporting = false;

  /* ---------------------------------------------------------------
     Math / evolving-noise utilities
  --------------------------------------------------------------- */
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const TWO_PI = Math.PI * 2;

  // deterministic, non-periodic-within-300s layered-sine noise in [-1,1]
  function noise1(x) {
    return (Math.sin(x) * 0.5 + Math.sin(x * 2.13 + 1.7) * 0.25 +
            Math.sin(x * 4.71 + 3.1) * 0.125 + Math.sin(x * 9.23 + 0.4) * 0.0625) / 0.9375;
  }
  function noise2(x, y) { return noise1(x * 1.7 + noise1(y * 0.6) * 3.1); }

  // per-run random phase offsets so no two playthroughs evolve identically
  const PHASE = {};
  ['star', 'orbit', 'cam', 'voy', 'light', 'scale', 'tension', 'flow'].forEach(k => PHASE[k] = Math.random() * 1000);

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
     0–300s parameter curves (macro direction). Evolving noise is
     layered on top of every one of these at use-time, never used raw.
  --------------------------------------------------------------- */
  const starDensityCurve      = curveFromPoints([[0,.06],[30,.28],[70,.55],[115,.7],[165,.85],[215,.62],[260,.95],[300,.22]]);
  const cameraDistanceCurve   = curveFromPoints([[0,1.7],[30,1.35],[70,1.05],[115,.85],[165,.65],[215,1.35],[260,.45],[300,2.3]]);
  const noiseAmountCurve      = curveFromPoints([[0,.04],[30,.09],[70,.18],[115,.32],[165,.48],[215,.66],[260,.82],[300,.28]]);
  const delayAmountCurve      = curveFromPoints([[0,.4],[30,.9],[70,1.8],[115,3.0],[165,6.0],[215,4.5],[260,2.0],[300,.8]]); // seconds
  const lightIntensityCurve   = curveFromPoints([[0,.08],[30,.22],[70,.42],[115,.55],[165,.5],[215,.68],[260,.88],[300,1.0]]);
  const voyagerVisibilityCurve= curveFromPoints([[0,0],[30,.04],[70,.14],[115,.34],[165,.78],[215,.42],[260,.16],[300,.02]]);
  const harmonicTensionCurve  = curveFromPoints([[0,.05],[30,.14],[70,.28],[115,.44],[165,.64],[215,.82],[260,.55],[300,.08]]);
  const particleSpeedCurve    = curveFromPoints([[0,.2],[30,.4],[70,.7],[115,.9],[165,1.15],[215,1.45],[260,1.85],[300,.35]]);
  const convergenceCurve      = curveFromPoints([[0,0],[260,0],[280,.5],[294,.9],[300,1]]); // final collapse to one point

  function curve(name, tSec, evoSpeed, variation, phase) {
    const base = {
      star: starDensityCurve, cam: cameraDistanceCurve, noise: noiseAmountCurve,
      delay: delayAmountCurve, light: lightIntensityCurve, voyager: voyagerVisibilityCurve,
      tension: harmonicTensionCurve, speed: particleSpeedCurve, converge: convergenceCurve
    }[name](tSec);
    return base + noise1(tSec * evoSpeed + phase) * variation;
  }

  /* ---------------------------------------------------------------
     Palette — hue drifts continuously, never snaps back
  --------------------------------------------------------------- */
  function paletteHue(tSec) {
    return 190 + noise1(tSec * 0.011 + PHASE.star) * 90 + tSec * 0.15; // slow unbounded drift
  }

  /* ---------------------------------------------------------------
     Particle / star field — independent per-particle life, no two
     particles share a phase; they are born, drift, split, and die.
  --------------------------------------------------------------- */
  const MAX_PARTICLES = 900;
  let particles = [];
  function spawnParticle(tSec, x, y) {
    return {
      x: x ?? Math.random(), y: y ?? Math.random(),
      vx: (Math.random() - 0.5) * 0.00025, vy: (Math.random() - 0.5) * 0.00025,
      size: 0.5 + Math.random() * 2.4,
      hueOff: (Math.random() - 0.5) * 60,
      flicker: 2 + Math.random() * 8,
      depth: Math.random(),
      born: tSec, life: 4 + Math.random() * 22,
      seed: Math.random() * 1000
    };
  }
  for (let i = 0; i < 400; i++) particles.push(spawnParticle(0));

  function updateParticles(tSec, dt) {
    const targetCount = Math.floor(120 + curve('star', tSec, 0.002, 0.05, PHASE.star) * MAX_PARTICLES);
    const flow = curve('speed', tSec, 0.0017, 0.15, PHASE.flow);

    for (const p of particles) {
      const age = tSec - p.born;
      const fx = noise2(p.x * 3 + tSec * 0.05, p.seed) * 0.0006 * flow;
      const fy = noise2(p.y * 3 + tSec * 0.05 + 50, p.seed) * 0.0006 * flow;
      p.x += (p.vx + fx) * dt * 60;
      p.y += (p.vy + fy) * dt * 60;
      if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05;
      if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;

      if (age > p.life) {
        if (Math.random() < 0.1 && particles.length < MAX_PARTICLES) {
          particles.push(spawnParticle(tSec, p.x + (Math.random()-0.5)*0.02, p.y + (Math.random()-0.5)*0.02));
          sfx.starSplit();
        } else if (Math.random() < 0.08) {
          sfx.starDeath();
        }
        Object.assign(p, spawnParticle(tSec));
      }
    }
    while (particles.length < targetCount && particles.length < MAX_PARTICLES) {
      particles.push(spawnParticle(tSec));
      if (Math.random() < 0.15) sfx.starSpawn();
    }
    while (particles.length > targetCount + 40) particles.pop();
  }

  function renderParticles(tSec, hue) {
    for (const p of particles) {
      const age = tSec - p.born;
      const lifeT = clamp01(age / p.life);
      const fade = Math.min(1, lifeT * 6) * Math.min(1, (1 - lifeT) * 6);
      const flick = 0.55 + 0.45 * Math.sin(tSec * p.flicker + p.seed);
      const alpha = fade * flick * (0.25 + p.depth * 0.55);
      const px = p.x * w, py = p.y * h;
      const size = p.size * (0.6 + p.depth * 1.1);
      ctx.globalAlpha = clamp01(alpha);
      ctx.fillStyle = `hsl(${hue + p.hueOff}, 80%, ${60 + p.depth * 25}%)`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Celestial body — a single form that keeps re-expressing itself:
     point -> circle -> ring -> orbit -> light-blur -> noise -> line -> point
  --------------------------------------------------------------- */
  const CELESTIAL_STATES = ['point','circle','ring','orbit','blur','noise','line'];
  const celestial = { state: 'point', next: 'circle', stateStart: 0, duration: 4, x: 0.5, y: 0.42, r: 40 };
  function stepCelestial(tSec) {
    if (tSec - celestial.stateStart > celestial.duration) {
      celestial.state = celestial.next;
      let n; do { n = CELESTIAL_STATES[Math.floor(Math.random() * CELESTIAL_STATES.length)]; } while (n === celestial.state);
      celestial.next = n;
      celestial.stateStart = tSec;
      celestial.duration = 3 + Math.random() * 7;
    }
  }
  function forceCelestialState(tSec, state, duration) {
    celestial.state = state; celestial.next = CELESTIAL_STATES[Math.floor(Math.random()*CELESTIAL_STATES.length)];
    celestial.stateStart = tSec; celestial.duration = duration || (3 + Math.random() * 7);
  }

  function celestialPosition(tSec) {
    return {
      cx: w * (celestial.x + noise1(tSec * 0.03 + PHASE.orbit) * 0.05),
      cy: h * (celestial.y + noise1(tSec * 0.037 + PHASE.orbit + 9) * 0.05)
    };
  }

  function renderCelestial(tSec, hue) {
    const morphT = clamp01((tSec - celestial.stateStart) / Math.min(0.8, celestial.duration));
    const { cx, cy } = celestialPosition(tSec);
    const r = celestial.r * (0.85 + curve('light', tSec, 0.02, 0.2, PHASE.light) * 0.6);
    const state = morphT < 1 ? celestial.state : celestial.next;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
    glow.addColorStop(0, `hsla(${hue}, 90%, 75%, ${0.35 + morphT * 0.1})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3, 0, TWO_PI); ctx.fill();

    ctx.strokeStyle = `hsla(${hue + 20}, 85%, 70%, .85)`;
    ctx.fillStyle = `hsla(${hue + 20}, 85%, 80%, .9)`;
    ctx.lineWidth = 2;
    switch (state) {
      case 'point': ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TWO_PI); ctx.fill(); break;
      case 'circle': ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TWO_PI); ctx.fill(); break;
      case 'ring': ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, TWO_PI); ctx.stroke(); break;
      case 'orbit':
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(tSec * 0.4);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.3, 0, 0, TWO_PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(r * 0.8, 0, 4, 0, TWO_PI); ctx.fill();
        ctx.restore(); break;
      case 'blur':
        for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(cx + (Math.random()-0.5)*r*0.4, cy+(Math.random()-0.5)*r*0.4, r*0.4, 0, TWO_PI); ctx.fill(); }
        ctx.globalAlpha = 1; break;
      case 'noise':
        for (let i = 0; i < 40; i++) { const a = Math.random()*TWO_PI, rr = Math.random()*r*0.7; ctx.fillRect(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr, 1.4, 1.4); }
        break;
      case 'line':
        ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy); ctx.lineTo(cx + r * 0.7, cy); ctx.stroke(); break;
    }
    return { cx, cy };
  }

  /* ---------------------------------------------------------------
     Voyager 1 — hinted, never fully explained. Small early, briefly
     legible mid-piece, small again near the end. Motion is noise-driven.
  --------------------------------------------------------------- */
  function voyagerPosition(tSec) {
    const baseX = w * 0.72, baseY = h * 0.58;
    const amp = 60 + noise1(tSec * 0.02 + PHASE.voy) * 40;
    const x = baseX + noise1(tSec * 0.06 + PHASE.voy) * amp;
    const y = baseY + Math.sin(tSec * 0.13 + PHASE.voy) * (30 + curve('noise', tSec, 0.01, 10, PHASE.voy));
    return { x, y };
  }
  let voyagerFlashUntil = 0;
  function renderVoyager(tSec, hue) {
    const vis = clamp01(curve('voyager', tSec, 0.015, 0.15, PHASE.voy)) + (tSec < voyagerFlashUntil ? 0.5 : 0);
    if (vis < 0.03) return;
    const { x, y } = voyagerPosition(tSec);
    const size = (tSec < voyagerFlashUntil ? 5 : 1.6) + vis * 4;
    ctx.globalAlpha = clamp01(vis);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    if (tSec < voyagerFlashUntil) {
      // brief silhouette: body + antenna dish
      ctx.beginPath(); ctx.arc(x, y, size, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * 4, y - size * 2.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + size * 4, y - size * 2.4, size * 1.4, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x, y, size * 0.5, 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    return { x, y };
  }

  /* ---------------------------------------------------------------
     Light time-layers — one source, several pasts shown at once.
     current = point, 0.5s ago = ring, 1.5s = cloud, 3s = broken line,
     6s/10s ago = faint speckle. Delay amount itself keeps drifting.
  --------------------------------------------------------------- */
  const lightHistory = [];
  function recordLight(tSec, x, y, intensity) {
    lightHistory.push({ t: tSec, x, y, i: intensity });
    while (lightHistory.length && tSec - lightHistory[0].t > 14) lightHistory.shift();
  }
  function sampleLight(tSec, delaySec) {
    const target = tSec - delaySec;
    let best = null, bestD = Infinity;
    for (const e of lightHistory) { const d = Math.abs(e.t - target); if (d < bestD) { bestD = d; best = e; } }
    return (best && bestD < 0.6) ? best : null;
  }
  function renderLightLayers(tSec, sourceX, sourceY, hue) {
    recordLight(tSec, sourceX, sourceY, curve('light', tSec, 0.02, 0.1, PHASE.light));
    const layers = [
      { d: 0,   shape: 'point' },
      { d: 0.5, shape: 'ring' },
      { d: 1.5, shape: 'cloud' },
      { d: 3.0, shape: 'broken' },
      { d: 6.0, shape: 'speckle' },
      { d: 10.0, shape: 'speckle' }
    ];
    for (const layer of layers) {
      const s = sampleLight(tSec, layer.d);
      if (!s) continue;
      const alpha = (1 - layer.d / 11) * 0.65;
      ctx.globalAlpha = clamp01(alpha);
      ctx.strokeStyle = ctx.fillStyle = `hsla(${hue + layer.d * 8}, 85%, 75%, 1)`;
      switch (layer.shape) {
        case 'point': ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TWO_PI); ctx.fill(); break;
        case 'ring': ctx.beginPath(); ctx.arc(s.x, s.y, 10 + layer.d * 6, 0, TWO_PI); ctx.stroke(); break;
        case 'cloud': {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 26);
          g.addColorStop(0, `hsla(${hue}, 80%, 75%, .5)`); g.addColorStop(1, 'transparent');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, TWO_PI); ctx.fill(); break;
        }
        case 'broken':
          for (let i = 0; i < 4; i++) { const a = i * 1.6; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a)*10, s.y+Math.sin(a)*10); ctx.lineTo(s.x+Math.cos(a)*22, s.y+Math.sin(a)*22); ctx.stroke(); }
          break;
        case 'speckle':
          for (let i = 0; i < 5; i++) ctx.fillRect(s.x + (Math.random()-0.5)*24, s.y + (Math.random()-0.5)*24, 1.2, 1.2);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Gaze / pointer — response is always delayed, and the delay itself
     keeps changing. Never a 1:1 cursor follower.
  --------------------------------------------------------------- */
  const pointerHistory = [];
  let pointer = { x: 0.5, y: 0.5, active: false };
  let dwell = 0;
  function onPointer(x, y) { pointer.x = x / w; pointer.y = y / h; pointer.active = true; }
  canvas.addEventListener('pointermove', e => onPointer(e.clientX, e.clientY));
  canvas.addEventListener('pointerdown', e => onPointer(e.clientX, e.clientY));
  canvas.addEventListener('touchmove', e => { if (e.touches[0]) onPointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  function gazeDelaySeconds(tSec) {
    // cycles through the specified steps but never settles into a fixed period
    const steps = [0.15, 0.4, 0.9, 1.8, 3.0];
    const idx = Math.floor((tSec * 0.05 + noise1(tSec * 0.03) * 2) % steps.length);
    return steps[Math.max(0, idx)] + noise1(tSec * 0.09 + 7) * 0.3;
  }

  let lastPointerSpeed = 0;
  function updateGaze(tSec, dt) {
    pointerHistory.push({ t: tSec, x: pointer.x, y: pointer.y });
    while (pointerHistory.length && tSec - pointerHistory[0].t > 6) pointerHistory.shift();

    const delay = gazeDelaySeconds(tSec);
    let target = pointerHistory[0] || pointer;
    let bestD = Infinity;
    for (const e of pointerHistory) { const d = Math.abs(e.t - (tSec - delay)); if (d < bestD) { bestD = d; target = e; } }

    const dx = target.x - (updateGaze.lastX ?? target.x);
    const dy = target.y - (updateGaze.lastY ?? target.y);
    const speed = Math.hypot(dx, dy) / Math.max(dt, 0.001);
    lastPointerSpeed = lerp(lastPointerSpeed, speed, 0.2);
    updateGaze.lastX = target.x; updateGaze.lastY = target.y;

    if (lastPointerSpeed < 0.15) dwell = Math.min(6, dwell + dt); else dwell = Math.max(0, dwell - dt * 2);
    return { x: target.x * w, y: target.y * h, dwell, speed: lastPointerSpeed, delay };
  }

  /* ---------------------------------------------------------------
     Camera / viewpoint system — periodically re-frames the whole
     scene via zoom/rotate/offset/shake, transitions by warp not cut.
  --------------------------------------------------------------- */
  const camera = { zoom: 1, rot: 0, ox: 0, oy: 0, shake: 0 };
  const camTarget = { zoom: 1, rot: 0, ox: 0, oy: 0, shake: 0 };
  let camModeStart = 0, camModeDuration = 5;
  const CAM_MODES = ['closeup','zoomout','driftSide','pullCenter','fullRotate','shake','flip','plain'];
  function pickCamMode(tSec) {
    const mode = CAM_MODES[Math.floor(Math.random() * CAM_MODES.length)];
    camModeStart = tSec; camModeDuration = 2 + Math.random() * 13;
    switch (mode) {
      case 'closeup': Object.assign(camTarget, { zoom: 1.8 + Math.random()*0.6, rot: 0, ox: 0, oy: 0, shake: 0 }); break;
      case 'zoomout': Object.assign(camTarget, { zoom: 0.55 + Math.random()*0.15, rot: 0, ox: 0, oy: 0, shake: 0 }); break;
      case 'driftSide': Object.assign(camTarget, { zoom: 1.1, rot: 0, ox: (Math.random()-0.5)*w*0.3, oy: 0, shake: 0 }); break;
      case 'pullCenter': Object.assign(camTarget, { zoom: 1.4, rot: 0, ox: 0, oy: (Math.random()-0.5)*h*0.2, shake: 0 }); break;
      case 'fullRotate': Object.assign(camTarget, { zoom: 1.15, rot: camTarget.rot + (Math.random()>0.5?1:-1)*TWO_PI, ox: 0, oy: 0, shake: 0 }); break;
      case 'shake': Object.assign(camTarget, { zoom: 1.05, rot: camTarget.rot, ox: 0, oy: 0, shake: 6 + Math.random()*8 }); break;
      case 'flip': Object.assign(camTarget, { zoom: 1, rot: camTarget.rot + Math.PI, ox: 0, oy: 0, shake: 0 }); break;
      default: Object.assign(camTarget, { zoom: 1, rot: camTarget.rot, ox: 0, oy: 0, shake: 0 });
    }
  }
  function updateCamera(tSec, dt) {
    if (tSec - camModeStart > camModeDuration) pickCamMode(tSec);
    const k = 1 - Math.pow(0.001, dt);
    camera.zoom = lerp(camera.zoom, camTarget.zoom * (1 - convergenceFactor(tSec)*0.5), k);
    camera.rot = lerp(camera.rot, camTarget.rot, k * 0.6);
    camera.ox = lerp(camera.ox, camTarget.ox, k);
    camera.oy = lerp(camera.oy, camTarget.oy, k);
    camera.shake = lerp(camera.shake, camTarget.shake, k);
  }
  function convergenceFactor(tSec) { return clamp01(curve('converge', tSec, 0, 0, 0)); }
  function applyCameraTransform(tSec) {
    const sx = (Math.random() - 0.5) * camera.shake;
    const sy = (Math.random() - 0.5) * camera.shake;
    ctx.translate(w / 2 + camera.ox + sx, h / 2 + camera.oy + sy);
    ctx.rotate(camera.rot);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-w / 2, -h / 2);
  }

  /* ---------------------------------------------------------------
     Space distortion — short (0.5–3s) post-process events, never a
     permanent screen state.
  --------------------------------------------------------------- */
  let activeDistortion = null; // { kind, start, dur }
  function triggerDistortion(kind, dur) { activeDistortion = { kind, start: elapsed / 1000, dur: dur || (0.5 + Math.random() * 2.5) }; }

  function applyDistortion(tSec) {
    if (!activeDistortion) return;
    const t = tSec - activeDistortion.start;
    if (t > activeDistortion.dur) { activeDistortion = null; return; }
    const p = t / activeDistortion.dur;
    const strength = Math.sin(p * Math.PI); // ramps in and out, never a hard cut

    bctx.clearRect(0, 0, w, h);
    bctx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);

    switch (activeDistortion.kind) {
      case 'wave': {
        const strips = 48, sh = h / strips;
        for (let i = 0; i < strips; i++) {
          const off = Math.sin(tSec * 4 + i * 0.4) * 18 * strength;
          ctx.drawImage(buffer, 0, i * sh, w, sh + 1, off, i * sh, w, sh + 1);
        }
        break;
      }
      case 'chroma': {
        const off = 6 * strength;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(buffer, -off, 0); ctx.drawImage(buffer, off, 0); ctx.drawImage(buffer, 0, off * 0.6);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'tear': {
        ctx.drawImage(buffer, 0, 0);
        const bands = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < bands; i++) {
          const y = Math.random() * h, bh = 4 + Math.random() * 30;
          const shift = (Math.random() - 0.5) * 60 * strength;
          ctx.drawImage(buffer, 0, y, w, bh, shift, y, w, bh);
        }
        break;
      }
      case 'pixel': {
        const block = Math.max(2, Math.floor(2 + strength * 22));
        const sw = Math.max(1, Math.floor(w / block)), sh2 = Math.max(1, Math.floor(h / block));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buffer, 0, 0, w, h, 0, 0, sw, sh2);
        ctx.drawImage(canvas, 0, 0, sw, sh2, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        break;
      }
      case 'mirror': {
        ctx.drawImage(buffer, 0, 0);
        ctx.save();
        ctx.globalAlpha = 0.5 * strength;
        ctx.translate(w, 0); ctx.scale(-1, 1);
        ctx.drawImage(buffer, 0, 0);
        ctx.restore();
        break;
      }
      default:
        ctx.drawImage(buffer, 0, 0);
    }
  }

  /* ---------------------------------------------------------------
     Captions — canvas-drawn (so exported video carries them too),
     short-lived, minimal vocabulary only.
  --------------------------------------------------------------- */
  let caption = null; // { text, start, dur }
  function showCaption(text, dur) { caption = { text, start: elapsed / 1000, dur: dur || (0.3 + Math.random() * 1.4) }; }
  function renderCaption(tSec) {
    if (!caption) return;
    const t = tSec - caption.start;
    if (t > caption.dur) { caption = null; return; }
    const p = t / caption.dur;
    const alpha = Math.sin(clamp01(p) * Math.PI);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.font = '300 15px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText(caption.text, w / 2, h * 0.14);
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------
     Non-repeating major event schedule. Each fires exactly once.
     Base times jittered ±25% at load so no two runs are identical.
  --------------------------------------------------------------- */
  const EVENTS = [
    { base: 7,   fn: () => { triggerDistortion('chroma'); showCaption('SIGNAL'); sfx.signalPulse(); } },
    { base: 14,  fn: () => { forceCelestialState(elapsed/1000, 'blur', 4); } },
    { base: 19,  fn: () => { triggerDistortion('wave'); } },
    { base: 26,  fn: () => { for (let i=0;i<30;i++) particles.push(spawnParticle(elapsed/1000)); } },
    { base: 31,  fn: () => { showCaption('EARTH'); sfx.signalPulse(); } },
    { base: 38,  fn: () => { triggerDistortion('tear'); } },
    { base: 44,  fn: () => { pickCamMode(elapsed/1000); } },
    { base: 51,  fn: () => { forceCelestialState(elapsed/1000, 'ring', 5); } },
    { base: 58,  fn: () => { triggerDistortion('mirror'); sfx.signalPulse(); } },
    { base: 63,  fn: () => { showCaption('NOW'); } },
    { base: 73,  fn: () => { voyagerFlashUntil = elapsed/1000 + 1.4; showCaption('VOYAGER 1', 1.6); sfx.voyagerCue(); } },
    { base: 89,  fn: () => { triggerDistortion('wave', 3); } },
    { base: 97,  fn: () => { pickCamMode(elapsed/1000); } },
    { base: 104, fn: () => { triggerDistortion('pixel'); } },
    { base: 121, fn: () => { showCaption('SIGNAL'); sfx.signalPulse(); } },
    { base: 132, fn: () => { forceCelestialState(elapsed/1000, 'orbit', 6); } },
    { base: 139, fn: () => { showCaption('DELAY'); } },
    { base: 157, fn: () => { pickCamMode(elapsed/1000); triggerDistortion('chroma'); } },
    { base: 176, fn: () => { voyagerFlashUntil = elapsed/1000 + 1.2; sfx.voyagerCue(); } },
    { base: 182, fn: () => { triggerDistortion('mirror'); } },
    { base: 194, fn: () => { triggerDistortion('tear', 2.2); } },
    { base: 211, fn: () => { pickCamMode(elapsed/1000); showCaption('23:46:00', 1.8); } },
    { base: 228, fn: () => { particles = particles.slice(0, Math.floor(particles.length*0.4)); } },
    { base: 238, fn: () => { triggerDistortion('pixel'); } },
    { base: 246, fn: () => { triggerDistortion('wave', 3); sfx.signalPulse(); } },
    { base: 264, fn: () => { forceCelestialState(elapsed/1000, 'noise', 8); } },
    { base: 280, fn: () => { showCaption('1 LIGHT-DAY', 2); sfx.voyagerCue(); } },
    { base: 294, fn: () => { triggerDistortion('chroma', 3); } },
    { base: 300, fn: () => { caption = null; } }
  ].map(e => ({ ...e, time: clamp01Time(e.base * (1 + (Math.random() * 0.5 - 0.25))), fired: false }));
  function clamp01Time(s) { return Math.max(0.5, Math.min(299, s)) * 1000; }

  function runEvents(tSec) {
    const ms = tSec * 1000;
    for (const ev of EVENTS) if (!ev.fired && ms >= ev.time) { ev.fired = true; try { ev.fn(); } catch (_) {} }
  }

  /* ---------------------------------------------------------------
     Audio — five independently evolving layers sharing one drifting
     scale. Nothing here repeats a fixed chord progression.
  --------------------------------------------------------------- */
  let audioCtx = null, master = null;
  let earth = null, voyagerVoice = null, lightVoice = null;
  const soundLog = [];

  function evolvingScale(tSec) {
    const root = 55 * Math.pow(2, noise1(tSec * 0.0035 + PHASE.scale) * 1.1);
    const tension = clamp01(curve('tension', tSec, 0.006, 0.15, PHASE.tension));
    const ratios = [
      1,
      lerp(1.125, 1.06, tension) + noise1(tSec * 0.01 + 1) * 0.02,
      lerp(1.5, 1.42, tension) + noise1(tSec * 0.012 + 2) * 0.03,
      lerp(1.78, 1.9, tension) + noise1(tSec * 0.013 + 3) * 0.03,
      2
    ];
    return { root, ratios, tension };
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
      voyagerVoice = makeDrone('sine', 'sine', 500, 0.5);
      lightVoice = { filter: audioCtx.createBiquadFilter() };
      lightVoice.filter.type = 'highpass';
      lightVoice.filter.frequency.value = 2000;
      lightVoice.filter.connect(master);

      scheduleLightShimmer();
      scheduleSignalChatter();
    } catch (e) {}
  }

  function makeDrone(w1, w2, filterFreq, gainMul) {
    const o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
    const f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    o1.type = w1; o2.type = w2; f.type = 'lowpass'; f.frequency.value = filterFreq;
    g.gain.value = 0.001;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    return { o1, o2, f, g, gainMul: gainMul ?? 1 };
  }

  function updateAudio(tSec) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const scale = evolvingScale(tSec);

    earth.o1.frequency.setTargetAtTime(scale.root * 0.5, now, 0.6);
    earth.o2.frequency.setTargetAtTime(scale.root * scale.ratios[1] * 0.5, now, 0.6);
    earth.g.gain.setTargetAtTime(isMuted ? 0.0001 : 0.05, now, 1.2);
    earth.f.frequency.setTargetAtTime(280 + scale.tension * 300, now, 1);

    const voyVis = clamp01(curve('voyager', tSec, 0.015, 0.1, PHASE.voy));
    voyagerVoice.o1.frequency.setTargetAtTime(scale.root * 0.25, now, 1.5);
    voyagerVoice.o2.frequency.setTargetAtTime(scale.root * scale.ratios[4] * 0.25, now, 1.5);
    voyagerVoice.g.gain.setTargetAtTime(isMuted ? 0.0001 : 0.03 + voyVis * 0.06, now, 1.5);

    const lightAmt = clamp01(curve('light', tSec, 0.02, 0.1, PHASE.light));
    lightVoice.filter.frequency.setTargetAtTime(1500 + lightAmt * 4000, now, 0.5);
  }

  function scheduleLightShimmer() {
    const next = () => {
      if (!audioCtx || elapsed >= DURATION) return;
      if (isPlaying && !isMuted) playBlip(lightVoice.filter, 2000 + Math.random()*3000, 0.05, 0.06);
      setTimeout(next, 80 + Math.random() * 220);
    };
    next();
  }
  function scheduleSignalChatter() {
    const next = () => {
      if (!audioCtx || elapsed >= DURATION) return;
      if (isPlaying && !isMuted && Math.random() < 0.6) sfx.signalPulse();
      setTimeout(next, 1000 + Math.random() * 7000);
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
    starSpawn() { if (!audioCtx || isMuted) return; playBlip(null, 1800 + Math.random()*1400, 0.12, 0.02); },
    starDeath() { if (!audioCtx || isMuted) return; playBlip(null, 200 + Math.random()*80, 0.3, 0.015); },
    starSplit() { if (!audioCtx || isMuted) return; playBlip(null, 900 + Math.random()*600, 0.18, 0.02); },
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
    },
    gazeShift(pitchBendCents) {
      if (!audioCtx || isMuted) return;
      const t = audioCtx.currentTime;
      voyagerVoice.o1.detune.setTargetAtTime(pitchBendCents, t, 0.2);
    },
    gazeSettle() { if (!audioCtx || isMuted) return; playBlip(null, 1200, 0.5, 0.03); }
  };

  function updateDelayLayer(tSec) {
    const delaySec = curve('delay', tSec, 0.008, 0.6, PHASE.tension);
    for (const e of soundLog) {
      if (!e.played && tSec - e.t >= delaySec) { e.played = true; playDelayedEcho(e); }
    }
    while (soundLog.length && tSec - soundLog[0].t > 14) soundLog.shift();
  }

  document.body.addEventListener('click', () => { if (!audioCtx) initAudio(); }, { once: true });
  document.body.addEventListener('touchstart', () => { if (!audioCtx) initAudio(); }, { once: true, passive: true });

  /* ---------------------------------------------------------------
     Main render loop — a single forward-only pass over elapsed time.
  --------------------------------------------------------------- */
  function render(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (isPlaying && elapsed < DURATION) elapsed += (now - (render.prevReal ?? now));
    render.prevReal = now;
    const tSec = elapsed / 1000;

    if (isPlaying) runEvents(tSec);
    if (isPlaying && elapsed < DURATION) {
      updateParticles(tSec, dt);
      stepCelestial(tSec);
      updateCamera(tSec, dt);
      updateAudio(tSec);
      updateDelayLayer(tSec);
    }

    const hue = paletteHue(tSec);
    const endFade = elapsed > DURATION ? clamp01((elapsed - DURATION) / 12000) : 0;

    ctx.fillStyle = '#01030a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    applyCameraTransform(tSec);
    renderParticles(tSec, hue);
    const { cx: srcX, cy: srcY } = celestialPosition(tSec);
    renderLightLayers(tSec, srcX, srcY, hue);
    renderCelestial(tSec, hue);
    renderVoyager(tSec, hue);

    const gaze = isPlaying ? (render.lastGaze = updateGaze(tSec, dt)) : (render.lastGaze || { x: w/2, y: h/2, dwell: 0, speed: 0 });
    if (gaze.dwell > 0.3) {
      const g2 = ctx.createRadialGradient(gaze.x, gaze.y, 0, gaze.x, gaze.y, 60 + gaze.dwell * 30);
      g2.addColorStop(0, `hsla(${hue}, 90%, 80%, ${Math.min(0.35, gaze.dwell * 0.08)})`);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(gaze.x, gaze.y, 60 + gaze.dwell*30, 0, TWO_PI); ctx.fill();
      if (isPlaying && Math.floor(tSec * 2) !== Math.floor((tSec - dt) * 2)) sfx.gazeShift(gaze.dwell * 14);
      if (isPlaying && gaze.dwell > 3 && Math.floor(tSec) !== Math.floor(tSec - dt)) sfx.gazeSettle();
    }
    if (isPlaying && gaze.speed > 1.2 && Math.random() < 0.06) triggerDistortion('chroma', 0.6);

    ctx.restore();

    applyDistortion(tSec);
    renderCaption(tSec);

    if (endFade > 0) {
      ctx.fillStyle = `rgba(1,3,10,${endFade})`;
      ctx.fillRect(0, 0, w, h);
      if (master && audioCtx) master.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 3);
    }

    if (timeLabel) {
      const shown = Math.min(elapsed, DURATION);
      const mm = String(Math.floor(shown / 60000)).padStart(2, '0');
      const ss = String(Math.floor((shown % 60000) / 1000)).padStart(2, '0');
      timeLabel.textContent = `${mm}:${ss} / 05:00`;
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  /* ---------------------------------------------------------------
     UI — hidden by default, fades in only while the pointer moves.
  --------------------------------------------------------------- */
  let uiHideTimer = null;
  function showUI() {
    toolbar.classList.add('visible');
    clearTimeout(uiHideTimer);
    uiHideTimer = setTimeout(() => toolbar.classList.remove('visible'), 2600);
  }
  window.addEventListener('pointermove', showUI);
  window.addEventListener('touchstart', showUI, { passive: true });

  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playIcon.textContent = isPlaying ? 'PAUSE' : 'PLAY';
  });

  btnSound.addEventListener('click', () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    isMuted = !isMuted;
    if (master) master.gain.linearRampToValueAtTime(isMuted ? 0.0001 : 0.28, audioCtx.currentTime + 0.3);
    soundIcon.textContent = isMuted ? 'SOUND OFF' : 'SOUND ON';
  });

  /* ---------------------------------------------------------------
     Export — records the full, single, non-looping 300s run.
  --------------------------------------------------------------- */
  btnExportVideo.addEventListener('click', async () => {
    if (isExporting) return;
    isExporting = true;
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();

    renderModal.classList.add('show');
    renderProgress.style.width = '0%';
    renderStatusText.textContent = '0%';

    try {
      const canvasStream = canvas.captureStream(30);
      if (audioCtx && master) {
        const dest = audioCtx.createMediaStreamDestination();
        master.connect(dest);
        const track = dest.stream.getAudioTracks()[0];
        if (track) canvasStream.addTrack(track);
      }

      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
      const recorder = new MediaRecorder(canvasStream, options);
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none'; a.href = url; a.download = `light_day_gap_5min_${Date.now()}.webm`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); renderModal.classList.remove('show'); isExporting = false; }, 100);
      };

      elapsed = 0; startTime = performance.now(); render.prevReal = performance.now();
      isPlaying = true; playIcon.textContent = 'PAUSE';
      EVENTS.forEach(e => e.fired = false);
      recorder.start();

      const poll = setInterval(() => {
        const pct = Math.min(100, Math.floor((elapsed / DURATION) * 100));
        renderProgress.style.width = `${pct}%`;
        renderStatusText.textContent = `${pct}%`;
        if (elapsed >= DURATION + 500) { clearInterval(poll); recorder.stop(); }
      }, 250);
    } catch (err) {
      alert('Recording error: ' + err.message);
      renderModal.classList.remove('show');
      isExporting = false;
    }
  });
});
