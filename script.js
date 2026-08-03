/* =================================================================
   Abstract Audiovisual Artwork: "Light-Day Gap" (1광일의 시간차)
   - Zero Text, Zero Buttons, 100% Canvas Visual & Generative Audio
   - Visualizing Human Time vs Cosmic Light Time Dilation
   ================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('artCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Timeline (Cycle: 12 seconds per pulse propagation)
  let isPlaying = true;
  let startTime = Date.now();

  // Generative Web Audio Engine
  let audioCtx = null;
  let masterGain = null;
  let droneOsc = null;
  let heartbeatTimer = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Deep Cosmic Background Drone (Sine & Harmonic Overtone)
      droneOsc = audioCtx.createOscillator();
      droneOsc.type = 'sine';
      droneOsc.frequency.setValueAtTime(55, audioCtx.currentTime); // 55Hz (A1)

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, audioCtx.currentTime);

      droneOsc.connect(filter);
      filter.connect(masterGain);
      droneOsc.start();

      // Human Heartbeat / Clock Tick Rhythmic Generator (72 BPM)
      heartbeatTimer = setInterval(() => {
        if (audioCtx && isPlaying) {
          playHumanPulseSound();
        }
      }, 833); // ~72 BPM

    } catch (e) {
      console.warn("Audio unavailable", e);
    }
  }

  // Sound of Human Heartbeat / Ticking Time on Earth
  function playHumanPulseSound() {
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      
      // Warm Sub Heartbeat
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.15);

      // Gentle Clock Tick Shimmer
      const tick = audioCtx.createOscillator();
      const tickGain = audioCtx.createGain();
      tick.type = 'triangle';
      tick.frequency.setValueAtTime(1200, now);
      tick.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      tickGain.gain.setValueAtTime(0.03, now);
      tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      tick.connect(tickGain);
      tickGain.connect(masterGain);
      tick.start(now);
      tick.stop(now + 0.03);
    } catch (e) {}
  }

  // Sound when Light Wave reaches the 1 Light-Day Distant Monad
  function playLightEchoSound() {
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(880, now + 1.2); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 1.5);
    } catch (e) {}
  }

  // Click to start audio or toggle
  document.body.addEventListener('click', () => {
    if (!audioCtx) {
      initAudio();
    } else if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    } else {
      isPlaying = !isPlaying;
    }
  });

  // Abstract Particles
  const STAR_COUNT = 300;
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.0002 + 0.00005,
      alpha: Math.random() * 0.7 + 0.2
    });
  }

  let lastEchoPlayed = false;

  // Main Rendering Loop
  function draw(timestamp) {
    requestAnimationFrame(draw);

    const w = canvas.width;
    const h = canvas.height;
    const elapsed = Date.now() - startTime;
    const cycleT = (elapsed % 12000) / 12000; // 12-second cycle

    // Dark Cosmic Void Background with slight motion trail
    ctx.fillStyle = 'rgba(1, 2, 6, 0.25)';
    ctx.fillRect(0, 0, w, h);

    // Render Ambient Cosmic Dust / Stars
    stars.forEach(s => {
      s.x -= s.speed;
      if (s.x < 0) s.x = 1;

      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * (0.5 + 0.5 * Math.sin(timestamp * 0.002 + s.x * 10))})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Positions for Abstract Nodes
    const humanX = w * 0.18;      // Left: Earth / Human Time Node
    const humanY = h * 0.5;

    const distantX = w * 0.82;    // Right: 1 Light-Day Distant Monad
    const distantY = h * 0.5;

    // ---------------------------------------------------
    // 1. Human Time Node (Warm Pulsating Biological Core)
    // ---------------------------------------------------
    const humanPulse = Math.sin(timestamp * 0.007) * 0.15 + 1.0;
    
    // Outer Warm Aura
    const humanGlow = ctx.createRadialGradient(humanX, humanY, 5, humanX, humanY, 140 * humanPulse);
    humanGlow.addColorStop(0, 'rgba(255, 140, 50, 0.8)');
    humanGlow.addColorStop(0.4, 'rgba(255, 80, 20, 0.25)');
    humanGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = humanGlow;
    ctx.beginPath();
    ctx.arc(humanX, humanY, 140 * humanPulse, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Fractal Clock Rings (Human Time Ticking)
    ctx.save();
    ctx.translate(humanX, humanY);
    ctx.rotate(timestamp * 0.001);
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.35)';
    ctx.lineWidth = 1.5;
    for (let r = 25; r <= 65; r += 12) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.rotate(-timestamp * 0.0005);
    }
    ctx.restore();

    // Biological Inner Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(humanX, humanY, 10 * humanPulse, 0, Math.PI * 2);
    ctx.fill();

    // ---------------------------------------------------
    // 2. The Light Propagation & Time Dilation Waves
    // ---------------------------------------------------
    const currentLightX = humanX + (distantX - humanX) * cycleT;
    const distTotal = distantX - humanX;

    // Concentric Wave Fronts Traveling across 1 Light-Day
    for (let i = 0; i < 5; i++) {
      const waveT = (cycleT - i * 0.15 + 1) % 1;
      const waveX = humanX + distTotal * waveT;
      const waveRadius = 30 + waveT * 120; // Waves stretch & dilate as they travel
      const waveAlpha = (1 - waveT) * 0.6;

      ctx.strokeStyle = `rgba(0, 240, 255, ${waveAlpha})`;
      ctx.lineWidth = 2 * (1 + waveT * 2);
      ctx.beginPath();
      ctx.arc(waveX, humanY, waveRadius, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
    }

    // Speed-of-Light Energy Wavefront Spark
    const lightSparkGlow = ctx.createRadialGradient(currentLightX, humanY, 2, currentLightX, humanY, 35);
    lightSparkGlow.addColorStop(0, '#ffffff');
    lightSparkGlow.addColorStop(0.3, '#00f0ff');
    lightSparkGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = lightSparkGlow;
    ctx.beginPath();
    ctx.arc(currentLightX, humanY, 35, 0, Math.PI * 2);
    ctx.fill();

    // Connecting Time Line (Gravitational Field String)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(humanX, humanY);
    ctx.lineTo(distantX, distantY);
    ctx.stroke();

    // ---------------------------------------------------
    // 3. The 1 Light-Day Distant Monad (Cold Frozen Echo)
    // ---------------------------------------------------
    const isWaveArriving = cycleT > 0.92;
    if (isWaveArriving && !lastEchoPlayed) {
      playLightEchoSound();
      lastEchoPlayed = true;
    } else if (!isWaveArriving) {
      lastEchoPlayed = false;
    }

    const distantPulse = isWaveArriving ? 1.6 : (1.0 + Math.sin(timestamp * 0.002) * 0.08);

    // Distant Monad Cold Cyan Aura
    const monadGlow = ctx.createRadialGradient(distantX, distantY, 4, distantX, distantY, 100 * distantPulse);
    monadGlow.addColorStop(0, isWaveArriving ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 240, 255, 0.7)');
    monadGlow.addColorStop(0.5, 'rgba(120, 0, 255, 0.25)');
    monadGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = monadGlow;
    ctx.beginPath();
    ctx.arc(distantX, distantY, 100 * distantPulse, 0, Math.PI * 2);
    ctx.fill();

    // Crystalline Geometry
    ctx.save();
    ctx.translate(distantX, distantY);
    ctx.rotate(-timestamp * 0.0006);
    ctx.strokeStyle = isWaveArriving ? '#ffffff' : 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-18 * distantPulse, -18 * distantPulse, 36 * distantPulse, 36 * distantPulse);
    ctx.restore();

    // Distant Monad Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(distantX, distantY, 5 * distantPulse, 0, Math.PI * 2);
    ctx.fill();

    // Delayed Echo Ripples Returning to Earth
    if (isWaveArriving) {
      const echoT = (cycleT - 0.92) / 0.08;
      ctx.strokeStyle = `rgba(180, 100, 255, ${0.8 * (1 - echoT)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(distantX, distantY, echoT * 200, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  requestAnimationFrame(draw);
});
