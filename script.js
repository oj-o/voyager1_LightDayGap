/* =================================================================
   "Light-Day Gap" - 1-Minute Generative Audiovisual Artwork Engine
   - 60-Second Structured Playtime Cycle
   - Bottom Control Toolbar & Random Variation Generator
   - Generative Web Audio Synthesizer
   - MediaRecorder 1-Minute Video Export (.webm)
   ================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('artCanvas');
  const ctx = canvas.getContext('2d');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnSound = document.getElementById('btnSound');
  const soundIcon = document.getElementById('soundIcon');
  const btnRandomize = document.getElementById('btnRandomize');
  const btnExportVideo = document.getElementById('btnExportVideo');

  const renderModal = document.getElementById('renderModal');
  const renderProgress = document.getElementById('renderProgress');
  const renderStatusText = document.getElementById('renderStatusText');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 1-Minute Playtime Cycle Configuration (60,000 ms)
  const CYCLE_DURATION = 60000;
  let startTime = Date.now();
  let isPlaying = true;
  let isMuted = false;
  let animationFrameId = null;

  // =========================================================
  // Generative Randomization State (Randomized on each run)
  // =========================================================
  const PALETTES = [
    { name: 'Aurora Cyan', primary: '#00f0ff', secondary: '#ffc83b', accent: '#7c3aed', bgGrad: '#01040f' },
    { name: 'Solar Magenta', primary: '#e056fd', secondary: '#ff9f43', accent: '#00d2d3', bgGrad: '#0a010f' },
    { name: 'Emerald Nebula', primary: '#10b981', secondary: '#3b82f6', accent: '#f59e0b', bgGrad: '#010f0a' },
    { name: 'Supernova Violet', primary: '#ec4899', secondary: '#8b5cf6', accent: '#06b6d4', bgGrad: '#0f010a' }
  ];

  let currentSeed = {
    palette: PALETTES[0],
    bpm: 72,
    baseFreq: 55, // A1
    waveCount: 6,
    starCount: 400,
    monadShape: 4, // 4 = Diamond/Square, 3 = Triangle, 6 = Hexagon
    waveSpeed: 1.0
  };

  let stars = [];
  function generateStars() {
    stars = [];
    for (let i = 0; i < currentSeed.starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 0.4,
        speed: Math.random() * 0.0003 + 0.00005,
        alpha: Math.random() * 0.7 + 0.2
      });
    }
  }

  function randomizeArt() {
    const paletteIndex = Math.floor(Math.random() * PALETTES.length);
    currentSeed.palette = PALETTES[paletteIndex];
    currentSeed.bpm = 60 + Math.floor(Math.random() * 24); // 60 - 84 BPM
    currentSeed.baseFreq = [43.65, 55.0, 65.41, 73.42][Math.floor(Math.random() * 4)]; // F1, A1, C2, D2
    currentSeed.waveCount = 4 + Math.floor(Math.random() * 5);
    currentSeed.monadShape = [3, 4, 6][Math.floor(Math.random() * 3)];
    currentSeed.waveSpeed = 0.8 + Math.random() * 0.4;

    generateStars();
    resetAudioPulseTimer();
    startTime = Date.now();
  }

  // =========================================================
  // Generative Web Audio API Engine
  // =========================================================
  let audioCtx = null;
  let masterGain = null;
  let droneOsc1 = null;
  let droneOsc2 = null;
  let droneFilter = null;
  let pulseTimer = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0.001 : 0.25, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Deep Space Base Drone
      droneOsc1 = audioCtx.createOscillator();
      droneOsc1.type = 'sawtooth';
      droneOsc1.frequency.setValueAtTime(currentSeed.baseFreq, audioCtx.currentTime);

      droneOsc2 = audioCtx.createOscillator();
      droneOsc2.type = 'sine';
      droneOsc2.frequency.setValueAtTime(currentSeed.baseFreq * 2, audioCtx.currentTime);

      droneFilter = audioCtx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(160, audioCtx.currentTime);

      droneOsc1.connect(droneFilter);
      droneOsc2.connect(droneFilter);
      droneFilter.connect(masterGain);

      droneOsc1.start();
      droneOsc2.start();

      resetAudioPulseTimer();
    } catch (e) {
      console.warn("Audio Context init error:", e);
    }
  }

  function resetAudioPulseTimer() {
    if (pulseTimer) clearInterval(pulseTimer);
    const intervalMs = Math.floor((60 / currentSeed.bpm) * 1000);
    pulseTimer = setInterval(() => {
      if (audioCtx && isPlaying && !isMuted) {
        playHumanBiologicalPulse();
      }
    }, intervalMs);
  }

  function playHumanBiologicalPulse() {
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;

      // Heartbeat Sub-Kick Sound
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.16);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.16);

      // Clock Tick Harmonic Sparkle
      const tick = audioCtx.createOscillator();
      const tickGain = audioCtx.createGain();
      tick.type = 'triangle';
      tick.frequency.setValueAtTime(1400, now);
      tick.frequency.exponentialRampToValueAtTime(500, now + 0.03);

      tickGain.gain.setValueAtTime(0.04, now);
      tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      tick.connect(tickGain);
      tickGain.connect(masterGain);

      tick.start(now);
      tick.stop(now + 0.03);
    } catch (e) {}
  }

  function play1LightDayEchoSound() {
    if (!audioCtx || isMuted) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const freq = currentSeed.baseFreq * 8; // High crystalline overtone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 1.5);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 1.8);
    } catch (e) {}
  }

  // =========================================================
  // Canvas Rendering Engine (60-Second Playtime Cycle)
  // =========================================================
  generateStars();

  let lastEchoTriggered = false;

  function render(timestamp) {
    if (!isPlaying) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const elapsed = (Date.now() - startTime) % CYCLE_DURATION;
    const cycleT = elapsed / CYCLE_DURATION; // 0.0 to 1.0 across 60 seconds

    // Dark Cosmic Background Gradient
    ctx.fillStyle = currentSeed.palette.bgGrad;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1.0;

    // Render Generative Starfield
    stars.forEach(s => {
      s.x -= s.speed;
      if (s.x < 0) s.x = 1;

      const starAlpha = Math.max(0.1, s.alpha + Math.sin(timestamp * 0.002 + s.x * 20) * 0.2);
      ctx.fillStyle = currentSeed.palette.primary;
      ctx.globalAlpha = starAlpha * 0.7;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Abstract Nodes
    const humanX = w * 0.18;      // Left: Earth / Human Time Node
    const humanY = h * 0.5;

    const distantX = w * 0.82;    // Right: 1 Light-Day Distant Monad
    const distantY = h * 0.5;

    // ---------------------------------------------------
    // 1. Human Time Node (Warm Biological Core)
    // ---------------------------------------------------
    const pulseFactor = Math.sin(timestamp * 0.008) * 0.15 + 1.0;
    
    const humanGlow = ctx.createRadialGradient(humanX, humanY, 5, humanX, humanY, 150 * pulseFactor);
    humanGlow.addColorStop(0, currentSeed.palette.secondary);
    humanGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)');
    humanGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = humanGlow;
    ctx.beginPath();
    ctx.arc(humanX, humanY, 150 * pulseFactor, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Fractal Clock Rings
    ctx.save();
    ctx.translate(humanX, humanY);
    ctx.rotate(timestamp * 0.001);
    ctx.strokeStyle = currentSeed.palette.secondary;
    ctx.lineWidth = 1.5;
    for (let r = 30; r <= 70; r += 14) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.rotate(-timestamp * 0.0006);
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(humanX, humanY, 12 * pulseFactor, 0, Math.PI * 2);
    ctx.fill();

    // ---------------------------------------------------
    // 2. Light Wave Dilation across 1 Light-Day (60s Progress)
    // ---------------------------------------------------
    const distTotal = distantX - humanX;
    const currentLightX = humanX + distTotal * cycleT;

    // Concentric Wave Fronts (Diatonic Dilation)
    for (let i = 0; i < currentSeed.waveCount; i++) {
      const waveT = (cycleT - i * (0.8 / currentSeed.waveCount) + 1) % 1;
      const waveX = humanX + distTotal * waveT;
      const waveRadius = 35 + waveT * 150;
      const waveAlpha = (1 - waveT) * 0.6;

      ctx.strokeStyle = currentSeed.palette.primary;
      ctx.globalAlpha = waveAlpha;
      ctx.lineWidth = 2 + waveT * 3;
      ctx.beginPath();
      ctx.arc(waveX, humanY, waveRadius, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Speed of Light Front Spark
    const sparkGlow = ctx.createRadialGradient(currentLightX, humanY, 2, currentLightX, humanY, 40);
    sparkGlow.addColorStop(0, '#ffffff');
    sparkGlow.addColorStop(0.4, currentSeed.palette.primary);
    sparkGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sparkGlow;
    ctx.beginPath();
    ctx.arc(currentLightX, humanY, 40, 0, Math.PI * 2);
    ctx.fill();

    // Connecting Gravitational Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(humanX, humanY);
    ctx.lineTo(distantX, distantY);
    ctx.stroke();

    // ---------------------------------------------------
    // 3. 1 Light-Day Monad Node & Echo Effect (At 50s-60s)
    // ---------------------------------------------------
    const isWaveArriving = cycleT > 0.85;
    if (isWaveArriving && !lastEchoTriggered) {
      play1LightDayEchoSound();
      lastEchoTriggered = true;
    } else if (!isWaveArriving) {
      lastEchoTriggered = false;
    }

    const monadScale = isWaveArriving ? 1.8 : (1.0 + Math.sin(timestamp * 0.002) * 0.1);

    const monadGlow = ctx.createRadialGradient(distantX, distantY, 4, distantX, distantY, 110 * monadScale);
    monadGlow.addColorStop(0, isWaveArriving ? '#ffffff' : currentSeed.palette.accent);
    monadGlow.addColorStop(0.6, 'rgba(120, 0, 255, 0.25)');
    monadGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = monadGlow;
    ctx.beginPath();
    ctx.arc(distantX, distantY, 110 * monadScale, 0, Math.PI * 2);
    ctx.fill();

    // Polygon Shape Monad (Triangle, Square, or Hexagon)
    ctx.save();
    ctx.translate(distantX, distantY);
    ctx.rotate(timestamp * 0.0005);
    ctx.strokeStyle = currentSeed.palette.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const sides = currentSeed.monadShape;
    const r = 24 * monadScale;
    for (let s = 0; s < sides; s++) {
      const angle = (s * 2 * Math.PI) / sides;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(distantX, distantY, 6 * monadScale, 0, Math.PI * 2);
    ctx.fill();

    // 1 Light-Day Echo Wave Propagation back
    if (isWaveArriving) {
      const echoProgress = (cycleT - 0.85) / 0.15;
      ctx.strokeStyle = currentSeed.palette.accent;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1.0 - echoProgress;
      ctx.beginPath();
      ctx.arc(distantX, distantY, echoProgress * 280, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  // Controls Event Listeners
  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playIcon.textContent = isPlaying ? "⏸ 일시정지" : "▶ 재생";
    btnPlayPause.classList.toggle('active', isPlaying);
  });

  btnSound.addEventListener('click', () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    isMuted = !isMuted;
    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(isMuted ? 0.001 : 0.25, audioCtx.currentTime + 0.3);
    }
    soundIcon.textContent = isMuted ? "🔇 사운드 켜기" : "🔊 사운드 끄기";
    btnSound.classList.toggle('active', !isMuted);
  });

  btnRandomize.addEventListener('click', () => {
    randomizeArt();
  });

  // 1-Minute Video Recorder (.webm)
  btnExportVideo.addEventListener('click', async () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    renderModal.classList.add('show');
    renderProgress.style.width = '0%';
    renderStatusText.textContent = '0%';

    try {
      const canvasStream = canvas.captureStream(30);
      let combinedStream = canvasStream;

      if (audioCtx && masterGain) {
        const dest = audioCtx.createMediaStreamDestination();
        masterGain.connect(dest);
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          combinedStream.addTrack(audioTrack);
        }
      }

      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }

      const mediaRecorder = new MediaRecorder(combinedStream, options);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `light_day_gap_1min_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          renderModal.classList.remove('show');
        }, 100);
      };

      // Restart 1-minute cycle from 0
      startTime = Date.now();
      isPlaying = true;
      mediaRecorder.start();

      const recInterval = setInterval(() => {
        const recElapsed = Date.now() - startTime;
        const percent = Math.min(100, Math.floor((recElapsed / CYCLE_DURATION) * 100));

        renderProgress.style.width = `${percent}%`;
        renderStatusText.textContent = `${percent}%`;

        if (recElapsed >= CYCLE_DURATION) {
          clearInterval(recInterval);
          mediaRecorder.stop();
        }
      }, 250);

    } catch (err) {
      alert("영상 녹화 중 오류: " + err.message);
      renderModal.classList.remove('show');
    }
  });
});
