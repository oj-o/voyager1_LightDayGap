/* =================================================================
   Voyager 1 Light-Day Pure Visualization & Deep Space Audio Engine
   - Pure Visual Motion (No On-screen Text)
   - 1 Light-Day Earth to Voyager Signal Propagation Motion
   - Web Audio API Procedural Deep Space Sound Synth
   - MediaRecorder Video Exporter (.webm)
   ================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('spaceCanvas');
  const ctx = canvas.getContext('2d');
  
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnSound = document.getElementById('btnSound');
  const soundIcon = document.getElementById('soundIcon');
  const btnExportVideo = document.getElementById('btnExportVideo');
  const btnFullscreen = document.getElementById('btnFullscreen');
  
  const renderModal = document.getElementById('renderModal');
  const renderProgress = document.getElementById('renderProgress');
  const renderStatusText = document.getElementById('renderStatusText');

  // Canvas Sizing
  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth || 1280;
    canvas.height = canvas.parentElement.clientHeight || 720;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Global Timeline (Total Cycle: 30 Seconds = 30,000 ms)
  const TOTAL_DURATION = 30000;
  let startTime = Date.now();
  let isPlaying = true;
  let isMuted = false;
  let animationFrameId = null;

  // Starfield & Cosmic Dust Data
  const STARS_COUNT = 450;
  const stars = [];
  for (let i = 0; i < STARS_COUNT; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      z: Math.random() * 2000 + 1,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.05 + 0.01,
      color: ['#ffffff', '#aee5ff', '#ffdca8', '#c4b5fd'][Math.floor(Math.random() * 4)]
    });
  }

  // Solar Wind Particles
  const PARTICLES_COUNT = 80;
  const particles = [];
  for (let i = 0; i < PARTICLES_COUNT; i++) {
    particles.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      speed: Math.random() * 4 + 2,
      length: Math.random() * 40 + 10,
      alpha: Math.random() * 0.4 + 0.1
    });
  }

  // Nebulae Clouds
  const NEBULAE = [
    { x: -500, y: -300, radius: 600, color: 'rgba(0, 180, 255, 0.07)' },
    { x: 600, y: 300, radius: 700, color: 'rgba(140, 0, 255, 0.05)' },
    { x: 200, y: -400, radius: 500, color: 'rgba(255, 120, 0, 0.04)' }
  ];

  // ==========================================
  // Web Audio API Synthesizer (Deep Space Sound)
  // ==========================================
  let audioCtx = null;
  let masterGain = null;
  let droneOsc1 = null;
  let droneOsc2 = null;
  let droneFilter = null;
  let noiseNode = null;
  let noiseGain = null;
  let telemetryInterval = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0.001 : 0.25, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Deep Sub-Bass Space Hum (43.65Hz F0 / 87.31Hz F1)
      droneOsc1 = audioCtx.createOscillator();
      droneOsc1.type = 'sawtooth';
      droneOsc1.frequency.setValueAtTime(43.65, audioCtx.currentTime);

      droneOsc2 = audioCtx.createOscillator();
      droneOsc2.type = 'sine';
      droneOsc2.frequency.setValueAtTime(87.31, audioCtx.currentTime);

      droneFilter = audioCtx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(150, audioCtx.currentTime);

      droneOsc1.connect(droneFilter);
      droneOsc2.connect(droneFilter);
      droneFilter.connect(masterGain);

      droneOsc1.start();
      droneOsc2.start();

      // Cosmic Noise (Solar Wind Hum)
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(300, audioCtx.currentTime);
      noiseFilter.Q.setValueAtTime(3.0, audioCtx.currentTime);

      noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.02, audioCtx.currentTime);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseNode.start();

      // Periodic Telemetry Radio Beeps
      startTelemetryBeeps();
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
    }
  }

  function playTelemetryPulse(freq = 1800, duration = 0.08) {
    if (!audioCtx || isMuted) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  function startTelemetryBeeps() {
    if (telemetryInterval) clearInterval(telemetryInterval);
    telemetryInterval = setInterval(() => {
      if (!isMuted && isPlaying) {
        playTelemetryPulse(1600 + Math.random() * 800, 0.06);
        if (Math.random() > 0.5) {
          setTimeout(() => playTelemetryPulse(2200, 0.04), 100);
        }
      }
    }, 1800);
  }

  function toggleAudio() {
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
  }

  btnSound.addEventListener('click', toggleAudio);

  // Initialize audio on first click anywhere
  document.body.addEventListener('click', () => {
    if (!audioCtx) initAudio();
  }, { once: true });

  // ==========================================
  // Render Vector Objects (Earth, Voyager, Beams)
  // ==========================================

  // Draw Detailed Earth (Departure Planet)
  function drawEarth(x, y, radius, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Atmosphere Outer Glow
    const atmosGlow = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, radius * 1.6);
    atmosGlow.addColorStop(0, 'rgba(0, 180, 255, 0.6)');
    atmosGlow.addColorStop(0.5, 'rgba(0, 100, 255, 0.2)');
    atmosGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = atmosGlow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Planet Body
    const planetGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
    planetGrad.addColorStop(0, '#4ba3e3');
    planetGrad.addColorStop(0.5, '#195697');
    planetGrad.addColorStop(1, '#051833');
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Continent Shading
    ctx.fillStyle = 'rgba(46, 139, 87, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.2, -radius * 0.1, radius * 0.4, radius * 0.2, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Voyager 1 Probe Vector Graphics
  function drawVoyager1(x, y, scale, rotation, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(rotation);

    // Magnetometer Boom (Long Rod extending left)
    ctx.strokeStyle = '#647e9e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-260, -130);
    ctx.stroke();

    // Magnetometer Tip Sensor
    ctx.fillStyle = '#ffc83b';
    ctx.beginPath();
    ctx.arc(-260, -130, 6, 0, Math.PI * 2);
    ctx.fill();

    // RTG Power Core (Lower Left Boom)
    ctx.strokeStyle = '#8a2be2';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-100, 90);
    ctx.stroke();

    // RTG Power Core Amber Glow
    const rtgGlow = ctx.createRadialGradient(-100, 90, 2, -100, 90, 18);
    rtgGlow.addColorStop(0, '#ff9900');
    rtgGlow.addColorStop(0.6, 'rgba(255, 50, 0, 0.4)');
    rtgGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = rtgGlow;
    ctx.beginPath();
    ctx.arc(-100, 90, 18, 0, Math.PI * 2);
    ctx.fill();

    // Main Body Bus (Octagonal Box)
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Golden Record Mounted on Bus Body
    const recordRot = time * 0.002;
    ctx.save();
    ctx.translate(-20, 15);
    ctx.rotate(recordRot);
    
    // Gold disc
    const goldGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    goldGrad.addColorStop(0, '#ffe17d');
    goldGrad.addColorStop(0.7, '#b8860b');
    goldGrad.addColorStop(1, '#4a3300');
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffc83b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Disc Center
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // High Gain Parabolic Dish Antenna (White Parabola facing Earth direction)
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
    ctx.shadowBlur = 30;

    // Antenna Outer White Shell
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(15, -10, 95, 50, -Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();

    // Antenna Dish Inner Blue Shading
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(15, -10, 85, 40, -Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Antenna Feed Horn Tripod
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, -10);
    ctx.lineTo(45, -45);
    ctx.stroke();

    // Feed Horn Subreflector Light Pulse
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(45, -45, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Render 1 Light-Day Signal Beam Traveling from Earth to Voyager
  function drawLightDaySignalBeam(earthX, earthY, voyagerX, voyagerY, progress) {
    ctx.save();

    // 1 Light-Day Distance Boundary Ring expanding from Earth
    const maxRadius = Math.hypot(voyagerX - earthX, voyagerY - earthY);
    const currentRadius = maxRadius * Math.min(1, progress);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(earthX, earthY, currentRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Signal Pulse Beam Line
    const grad = ctx.createLinearGradient(earthX, earthY, voyagerX, voyagerY);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
    grad.addColorStop(Math.min(1, progress), 'rgba(255, 200, 59, 1)');
    grad.addColorStop(Math.min(1, progress + 0.05), 'rgba(0, 240, 255, 0.1)');
    grad.addColorStop(1, 'transparent');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    const targetX = earthX + (voyagerX - earthX) * Math.min(1, progress);
    const targetY = earthY + (voyagerY - earthY) * Math.min(1, progress);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    // Pulsing Light Head (Speed of Light Wavefront)
    if (progress <= 1) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffc83b';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ==========================================
  // Main Animation Loop
  // ==========================================
  function render(timestamp) {
    if (!isPlaying) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }

    const elapsed = (Date.now() - startTime) % TOTAL_DURATION;
    const progress = elapsed / TOTAL_DURATION;

    // Clear Canvas
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    // Draw Deep Space Nebulae
    NEBULAE.forEach(neb => {
      const grad = ctx.createRadialGradient(
        centerX + neb.x, centerY + neb.y, 20,
        centerX + neb.x, centerY + neb.y, neb.radius
      );
      grad.addColorStop(0, neb.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX + neb.x, centerY + neb.y, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Starfield (Parallax & Twinkle)
    stars.forEach(star => {
      const alpha = Math.max(0.1, Math.min(1, star.alpha + Math.sin(timestamp * star.twinkleSpeed) * 0.2));
      ctx.fillStyle = star.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(centerX + star.x, centerY + star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Solar Wind Stream Lines
    particles.forEach(p => {
      p.x -= p.speed;
      if (p.x < -w / 2) p.x = w / 2 + 200;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX + p.x, centerY + p.y);
      ctx.lineTo(centerX + p.x + p.length, centerY + p.y - p.length * 0.2);
      ctx.stroke();
    });

    // ----------------------------------------------------
    // Motion Journey Phases (0s - 30s)
    // ----------------------------------------------------
    let earthX, earthY, earthRadius, earthAlpha;
    let voyagerX, voyagerY, voyagerScale, voyagerRot;
    let signalProgress = 0;

    if (progress < 0.25) {
      // Phase 1 (0s - 7.5s): Earth Departure & Solar System Zoom Out
      const phaseT = progress / 0.25;

      earthX = w * 0.25 - phaseT * (w * 0.15);
      earthY = h * 0.4;
      earthRadius = 80 * (1 - phaseT * 0.7);
      earthAlpha = 1.0 - phaseT * 0.4;

      voyagerX = w * 0.5 + phaseT * (w * 0.25);
      voyagerY = h * 0.5 - phaseT * (h * 0.15);
      voyagerScale = 0.6 + phaseT * 0.3;
      voyagerRot = Math.sin(timestamp * 0.001) * 0.05;

    } else if (progress < 0.65) {
      // Phase 2 (7.5s - 19.5s): 1 Light-Day Signal Journey (Earth to Voyager)
      const phaseT = (progress - 0.25) / 0.40;

      earthX = w * 0.1;
      earthY = h * 0.75;
      earthRadius = 16;
      earthAlpha = 0.6;

      voyagerX = w * 0.82;
      voyagerY = h * 0.28;
      voyagerScale = 0.95;
      voyagerRot = 0.05 + Math.sin(timestamp * 0.0008) * 0.03;

      signalProgress = phaseT;

    } else {
      // Phase 3 (19.5s - 30s): Interstellar Heliosphere Boundary & Deep Drift
      const phaseT = (progress - 0.65) / 0.35;

      earthX = w * 0.08;
      earthY = h * 0.8;
      earthRadius = 8;
      earthAlpha = 0.3 * (1 - phaseT);

      voyagerX = w * 0.82 - phaseT * (w * 0.15);
      voyagerY = h * 0.28 + phaseT * (h * 0.1);
      voyagerScale = 0.95 - phaseT * 0.35;
      voyagerRot = 0.08 + phaseT * 0.1;

      signalProgress = 1.0;

      // Draw Glowing Heliosphere Boundary Wave
      ctx.save();
      const helioGrad = ctx.createLinearGradient(w * 0.4, 0, w * 0.6, h);
      helioGrad.addColorStop(0, 'rgba(147, 51, 234, 0.0)');
      helioGrad.addColorStop(0.5, `rgba(168, 85, 247, ${0.4 * Math.sin(phaseT * Math.PI)})`);
      helioGrad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

      ctx.strokeStyle = helioGrad;
      ctx.lineWidth = 20;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, -100);
      ctx.bezierCurveTo(w * 0.45, h * 0.3, w * 0.55, h * 0.7, w * 0.5, h + 100);
      ctx.stroke();
      ctx.restore();
    }

    // Render Earth
    drawEarth(earthX, earthY, earthRadius, earthAlpha);

    // Render 1 Light-Day Signal Beam Propagation
    if (signalProgress > 0) {
      drawLightDaySignalBeam(earthX, earthY, voyagerX, voyagerY, signalProgress);
    }

    // Render Voyager 1 Probe
    drawVoyager1(voyagerX, voyagerY, voyagerScale, voyagerRot, timestamp);

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  // Controls
  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playIcon.textContent = isPlaying ? "⏸ 일시정지" : "▶ 재생";
    btnPlayPause.classList.toggle('active', isPlaying);
  });

  btnFullscreen.addEventListener('click', () => {
    const elem = document.getElementById('videoContainer');
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  });

  // Video Export Engine (MediaRecorder for pure video & audio)
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
        a.download = 'voyager1_1lightday_motion_journey.webm';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          renderModal.classList.remove('show');
        }, 100);
      };

      // Restart cycle from 0 for clean recording
      startTime = Date.now();
      isPlaying = true;
      mediaRecorder.start();

      const recInterval = setInterval(() => {
        const recElapsed = Date.now() - startTime;
        const percent = Math.min(100, Math.floor((recElapsed / TOTAL_DURATION) * 100));
        
        renderProgress.style.width = `${percent}%`;
        renderStatusText.textContent = `${percent}%`;

        if (recElapsed >= TOTAL_DURATION) {
          clearInterval(recInterval);
          mediaRecorder.stop();
        }
      }, 200);

    } catch (err) {
      alert("비디오 녹화 중 오류: " + err.message);
      renderModal.classList.remove('show');
    }
  });
});
