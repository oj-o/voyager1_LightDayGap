/* ===================================================
   Voyager 1 Light-Day Teaser Engine
   Canvas Space Renderer, Web Audio Synth, MediaRecorder
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const canvas = document.getElementById('spaceCanvas');
  const ctx = canvas.getContext('2d');
  
  const captionMain = document.getElementById('captionMain');
  const captionSub = document.getElementById('captionSub');
  const sceneTag = document.getElementById('sceneTag');
  const distanceVal = document.getElementById('distanceVal');
  
  const goldenRecordOverlay = document.getElementById('goldenRecordOverlay');
  const signalPulseContainer = document.getElementById('signalPulseContainer');
  
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnSound = document.getElementById('btnSound');
  const soundIcon = document.getElementById('soundIcon');
  const btnExportVideo = document.getElementById('btnExportVideo');
  const btnFullscreen = document.getElementById('btnFullscreen');
  
  const sceneBtns = document.querySelectorAll('.scene-btn');
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

  // Video Story Scenes
  const SCENES = [
    {
      id: 0,
      tag: "SCENE 01 / LAUNCH 1977",
      main: "1977년 9월 5일",
      sub: "지구를 떠나 광활한 태양계 탐사에 나선 인류의 최전방 척후병, 보이저 1호",
      duration: 4000,
      camZoom: 1.2,
      voyagerSpeed: 0.5,
      showSignal: false,
      showRecord: false,
      distanceBase: 0
    },
    {
      id: 1,
      tag: "SCENE 02 / 1 LIGHT-DAY MILESTONE",
      main: "49년 만의 위대한 이정표",
      sub: "2026년 11월 18일, 지구로부터 인류 최초로 '1광일(259억 km)' 거리를 통과한다!",
      duration: 5000,
      camZoom: 0.8,
      voyagerSpeed: 1.2,
      showSignal: false,
      showRecord: false,
      distanceBase: 25902068356
    },
    {
      id: 2,
      tag: "SCENE 03 / 48-HOUR COMMUNICATION DELAY",
      main: "빛의 속도로 꼬박 이틀",
      sub: "월요일 아침 '안녕'이라는 명령을 보내면, 수요일 아침이 되어서야 응답을 수신한다",
      duration: 5000,
      camZoom: 0.6,
      voyagerSpeed: 0.3,
      showSignal: true,
      showRecord: false,
      distanceBase: 25902068356
    },
    {
      id: 3,
      tag: "SCENE 04 / POWER DEPLETION & SILENCE",
      main: "식어가는 원자력 전력",
      sub: "10개 과학장비 중 단 2개만 가동 중... 2030년대 초, 마지막 통신이 끊어진다",
      duration: 4500,
      camZoom: 1.5,
      voyagerSpeed: 0.2,
      showSignal: false,
      showRecord: false,
      distanceBase: 25980000000
    },
    {
      id: 4,
      tag: "SCENE 05 / GOLDEN RECORD TIME CAPSULE",
      main: "영원한 인류의 타임캡슐",
      sub: "지구의 소리, 50개 언어 인사말, 음악을 담은 '골든 레코드'를 싣고 우주 속으로",
      duration: 4500,
      camZoom: 1.0,
      voyagerSpeed: 0.4,
      showSignal: false,
      showRecord: true,
      distanceBase: 26050000000
    },
    {
      id: 5,
      tag: "SCENE 06 / EPILOGUE",
      main: "인류가 도달한 가장 먼 우주",
      sub: "통신이 끊겨도 보이저 1호는 광활한 성간 공간을 외로이, 영원히 항해할 것이다",
      duration: 4000,
      camZoom: 0.5,
      voyagerSpeed: 1.5,
      showSignal: false,
      showRecord: false,
      distanceBase: 26100000000
    }
  ];

  let currentSceneIndex = 0;
  let sceneStartTime = Date.now();
  let isPlaying = true;
  let isMuted = true;
  let animationFrameId = null;

  // Starfield Data
  const STARS_COUNT = 300;
  const stars = [];
  for (let i = 0; i < STARS_COUNT; i++) {
    stars.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.03 + 0.01
    });
  }

  // Nebula Cloud Particles
  const NEBULAE = [
    { x: -300, y: -150, radius: 400, color: 'rgba(0, 150, 255, 0.08)' },
    { x: 400, y: 200, radius: 500, color: 'rgba(120, 0, 255, 0.06)' },
    { x: 100, y: -300, radius: 350, color: 'rgba(255, 100, 0, 0.04)' }
  ];

  // Web Audio API Synthesizer Engine
  let audioCtx = null;
  let mainDroneGain = null;
  let synthOsc1 = null;
  let synthOsc2 = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      // Main Gain Node
      mainDroneGain = audioCtx.createGain();
      mainDroneGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      mainDroneGain.connect(audioCtx.destination);

      // Low Space Synth Oscillators
      synthOsc1 = audioCtx.createOscillator();
      synthOsc1.type = 'sawtooth';
      synthOsc1.frequency.setValueAtTime(55, audioCtx.currentTime); // A1 note

      synthOsc2 = audioCtx.createOscillator();
      synthOsc2.type = 'sine';
      synthOsc2.frequency.setValueAtTime(110, audioCtx.currentTime); // A2 note

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, audioCtx.currentTime);

      synthOsc1.connect(filter);
      synthOsc2.connect(filter);
      filter.connect(mainDroneGain);

      synthOsc1.start();
      synthOsc2.start();
    } catch (e) {
      console.warn("Web Audio API unavailable:", e);
    }
  }

  function playTransitionSound() {
    if (!audioCtx || isMuted) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch (e) {}
  }

  function toggleAudio() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isMuted = !isMuted;
    if (mainDroneGain) {
      mainDroneGain.gain.linearRampToValueAtTime(isMuted ? 0.001 : 0.15, audioCtx.currentTime + 0.5);
    }

    soundIcon.textContent = isMuted ? "🔊 오디오 켜기" : "🔇 오디오 끄기";
    btnSound.classList.toggle('active', !isMuted);
  }

  btnSound.addEventListener('click', toggleAudio);

  // Scene Switching
  function switchScene(index) {
    currentSceneIndex = index;
    sceneStartTime = Date.now();
    const scene = SCENES[currentSceneIndex];

    // Update UI elements
    sceneTag.textContent = scene.tag;
    captionMain.textContent = scene.main;
    captionSub.textContent = scene.sub;

    // Update buttons
    sceneBtns.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === currentSceneIndex);
    });

    // Update Golden Record Overlay
    if (scene.showRecord) {
      goldenRecordOverlay.classList.add('show');
    } else {
      goldenRecordOverlay.classList.remove('show');
    }

    // Update Signal Overlay
    if (scene.showSignal) {
      signalPulseContainer.classList.add('show');
    } else {
      signalPulseContainer.classList.remove('show');
    }

    playTransitionSound();
  }

  sceneBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      switchScene(idx);
    });
  });

  // Render Voyager 1 Vector Model
  function drawVoyager1(x, y, scale, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(Math.sin(time * 0.001) * 0.03); // Subtle pitch float

    // Magnetometer Boom (Long Rod extending to upper left)
    ctx.strokeStyle = '#6882a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-240, -120);
    ctx.stroke();

    // Magnetometer sensors
    ctx.fillStyle = '#ffc83b';
    ctx.beginPath();
    ctx.arc(-240, -120, 6, 0, Math.PI * 2);
    ctx.fill();

    // Science Boom (Upper right)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(120, -100);
    ctx.stroke();

    // Scan platform camera
    ctx.fillStyle = '#445875';
    ctx.fillRect(110, -115, 30, 20);

    // RTG (Radioisotope Thermoelectric Generator - Lower left)
    ctx.strokeStyle = '#880000';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-90, 80);
    ctx.stroke();

    // RTG Power core glow
    const rtgGlow = ctx.createRadialGradient(-90, 80, 2, -90, 80, 15);
    rtgGlow.addColorStop(0, '#ff3b5c');
    rtgGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = rtgGlow;
    ctx.beginPath();
    ctx.arc(-90, 80, 15, 0, Math.PI * 2);
    ctx.fill();

    // High Gain Parabolic Dish Antenna (White Parabola)
    ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
    ctx.shadowBlur = 25;

    ctx.fillStyle = '#eef5ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 85, 45, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Dish Rim & Feed Horn Subreflector
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#112233';
    ctx.beginPath();
    ctx.ellipse(0, 0, 75, 35, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Feed Horn Tripod
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(25, -35);
    ctx.stroke();

    ctx.fillStyle = '#ffc83b';
    ctx.beginPath();
    ctx.arc(25, -35, 5, 0, Math.PI * 2);
    ctx.fill();

    // Radio Wave Beams (Sending signal to Earth)
    const waveRadius = (time * 0.05) % 150;
    ctx.strokeStyle = `rgba(0, 240, 255, ${1 - waveRadius / 150})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(25, -35, waveRadius, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    ctx.restore();
  }

  // Render Earth (Pale Blue Dot) in background
  function drawEarth(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);

    // Pale Blue Dot Glow
    const earthGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, 30 * scale);
    earthGlow.addColorStop(0, 'rgba(0, 180, 255, 0.9)');
    earthGlow.addColorStop(0.3, 'rgba(0, 120, 255, 0.4)');
    earthGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = earthGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Core Dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Main Canvas Render Loop
  function render(timestamp) {
    const elapsed = Date.now() - sceneStartTime;
    const currentScene = SCENES[currentSceneIndex];

    // Check if scene duration finished -> auto move to next scene if playing
    if (isPlaying && elapsed > currentScene.duration) {
      const nextIndex = (currentSceneIndex + 1) % SCENES.length;
      switchScene(nextIndex);
    }

    // Clear Canvas
    ctx.fillStyle = '#030611';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Draw Nebulae
    NEBULAE.forEach(neb => {
      const grad = ctx.createRadialGradient(
        centerX + neb.x, centerY + neb.y, 10,
        centerX + neb.x, centerY + neb.y, neb.radius
      );
      grad.addColorStop(0, neb.color);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX + neb.x, centerY + neb.y, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Stars with Twinkle
    stars.forEach(star => {
      star.alpha += Math.sin(timestamp * star.twinkleSpeed) * 0.01;
      const clampedAlpha = Math.max(0.1, Math.min(1, star.alpha));

      ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
      ctx.beginPath();
      ctx.arc(centerX + star.x, centerY + star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Update Distance Ticker Value
    const liveDist = currentScene.distanceBase + Math.floor(timestamp * 15);
    distanceVal.textContent = liveDist.toLocaleString('en-US');

    // Scene Specific Animations
    const sceneProgress = Math.min(1, elapsed / currentScene.duration);

    // Draw Pale Blue Dot (Earth)
    const earthX = 150;
    const earthY = canvas.height - 150;
    drawEarth(earthX, earthY, 1.2);

    // Draw Voyager 1 Probe
    const voyagerX = centerX + (Math.sin(timestamp * 0.0005) * 50) + (currentScene.id * 20);
    const voyagerY = centerY + (Math.cos(timestamp * 0.0005) * 30);
    const voyagerScale = currentScene.camZoom;

    drawVoyager1(voyagerX, voyagerY, voyagerScale, timestamp);

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  // Play / Pause Controls
  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playIcon.textContent = isPlaying ? "⏸ 일시정지" : "▶ 재생";
    btnPlayPause.classList.toggle('active', isPlaying);
  });

  // Fullscreen
  btnFullscreen.addEventListener('click', () => {
    const elem = document.getElementById('videoContainer');
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  });

  // Video Export Engine (MediaRecorder)
  btnExportVideo.addEventListener('click', async () => {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    renderModal.classList.add('show');
    renderProgress.style.width = '0%';
    renderStatusText.textContent = '0%';

    try {
      // Create Canvas Stream (30 FPS)
      const canvasStream = canvas.captureStream(30);

      // Create Web Audio Destination Stream if sound enabled
      let combinedStream = canvasStream;
      if (audioCtx && mainDroneGain) {
        const dest = audioCtx.createMediaStreamDestination();
        mainDroneGain.connect(dest);
        
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          combinedStream.addTrack(audioTrack);
        }
      }

      // Check supported MIME types
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
        a.download = 'voyager1_teaser_1lightday.webm';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          renderModal.classList.remove('show');
        }, 100);
      };

      // Start Recording all 6 scenes (approx 24 seconds total)
      switchScene(0);
      isPlaying = true;
      mediaRecorder.start();

      const totalDuration = SCENES.reduce((acc, s) => acc + s.duration, 0);
      const startTime = Date.now();

      const progressInterval = setInterval(() => {
        const pElapsed = Date.now() - startTime;
        const percent = Math.min(100, Math.floor((pElapsed / totalDuration) * 100));
        
        renderProgress.style.width = `${percent}%`;
        renderStatusText.textContent = `${percent}%`;

        if (pElapsed >= totalDuration) {
          clearInterval(progressInterval);
          mediaRecorder.stop();
        }
      }, 200);

    } catch (err) {
      alert("비디오 녹화 실패: " + err.message);
      renderModal.classList.remove('show');
    }
  });
});
