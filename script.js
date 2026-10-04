"use strict";

/*
 * VOYAGER 1 — LIGHT DAY GAP
 * Fulldome Planetarium & Cinematic Web Preview
 * First-person perspective of Voyager 1 (210s / 3m 30s)
 */
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.querySelector("#artCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const timeline = document.querySelector("#timeline");
  const playButton = document.querySelector("#playButton");
  const muteButton = document.querySelector("#muteButton");
  const domeButton = document.querySelector("#domeButton");
  const recordButton = document.querySelector("#recordButton");
  const recordModeSelect = document.querySelector("#recordModeSelect");
  const explainButton = document.querySelector("#explainButton");
  const explainModal = document.querySelector("#explainModal");
  const closeExplainButton = document.querySelector("#closeExplainButton");
  const essayButton = document.querySelector("#essayButton");
  const essayModal = document.querySelector("#essayModal");
  const closeEssayButton = document.querySelector("#closeEssayButton");
  const clock = document.querySelector("#clock");
  const sceneId = document.querySelector("#sceneId");
  const sceneTitle = document.querySelector("#sceneTitle");
  const sceneMeta = document.querySelector("#sceneMeta");
  const captionText = document.querySelector("#captionText");
  const simpleHudText = document.querySelector("#simpleHudText");
  const chapterMarkers = document.querySelector("#chapterMarkers");

  const DURATION_S = 210; // 3 minutes 30 seconds
  const FPS = 30;
  const LAST_FRAME_S = 6299 / FPS;
  const COLORS = {
    background: "#03060b",
    cyan: "#68d8e8",
    gold: "#d8b778",
    white: "#e8f4f7",
    muted: "#92a9b5",
    blue: "#356f9c",
    violet: "#8068bb",
    domeGrid: "rgba(104, 216, 232, 0.22)"
  };

  const SCENES = [
    {
      id: "S01",
      start: 0,
      end: 15,
      title: "어둠 속의 신호",
      meta: "259억 km 심연 · 가상 수신 사건",
      caption: "칠흑의 우주에서, 어제의 지구가 보낸 신호가 내게 닿았다.",
      hud: "지구와의 거리: 1광일 (259억 km) · 신호 지연: 약 24시간"
    },
    {
      id: "S02",
      start: 15,
      end: 45,
      title: "떠나온 49년의 궤적",
      meta: "1977 발사 → 목성·토성 → 태양계 탈출",
      caption: "행성들의 중력을 딛고, 나는 태양의 품을 벗어났다.",
      hud: "항행 속도: 초속 약 17 km · 황도면 위쪽으로 비행 중"
    },
    {
      id: "S03",
      start: 45,
      end: 70,
      title: "마지막으로 본 집",
      meta: "1990 창백한 푸른 점 이후 카메라 영구 정지",
      caption: "1990년, 마지막으로 집을 뒤돌아본 뒤 나의 눈은 영원히 감겼다.",
      hud: "지구의 겉보기 크기: 0.1015 초각 (극미세 점광원)"
    },
    {
      id: "S04",
      start: 70,
      end: 105,
      title: "1광일의 심연",
      meta: "빛으로 하루 걸리는 거리 · 259억 km",
      caption: "빛조차 하루가 걸리는 거리. 내가 보는 것은 언제나 어제의 당신들.",
      hud: "1광일 = 25,902,068,371 km (약 173.1 AU)"
    },
    {
      id: "S05",
      start: 105,
      end: 135,
      title: "두 장소의 하루",
      meta: "보이저의 하루 147만 km · 지구의 하루 257만 km",
      caption: "내가 고요히 성간을 가르는 동안, 지구는 맹렬히 태양을 돈다.",
      hud: "지구 공전: 257만 km/일 · 보이저 항행: 147만 km/일"
    },
    {
      id: "S06",
      start: 135,
      end: 160,
      title: "엇갈리는 시계",
      meta: "상대론적 시공간 · 흐르는 시간의 차이",
      caption: "거리의 지연 너머, 나의 시계와 지구의 시계도 서로 어긋난다.",
      hud: "특수상대론 시계 차이: 매일 약 139마이크로초"
    },
    {
      id: "S07",
      start: 160,
      end: 180,
      title: "성간의 떨림",
      meta: "플라스마파(PWS) 관측 · 눈을 감은 뒤의 귀",
      caption: "눈은 감겼지만, 성간 플라스마의 떨림이 내 몸을 울린다.",
      hud: "플라스마 전자 진동 주파수: 2.2 ~ 3.0 kHz 계측"
    },
    {
      id: "S08",
      start: 180,
      end: 198,
      title: "원자의 심박수",
      meta: "RTG 플루토늄-238 붕괴열 · 미세한 생명선",
      caption: "심장에 품은 원자들의 온기로, 나는 마지막 신호를 띄운다.",
      hud: "RTG 원자력 전원: 20와트 미약한 전파로 송신"
    },
    {
      id: "S09",
      start: 198,
      end: 210,
      title: "내일로 보내는 응답",
      meta: "보이저 가상 시선 · 어제의 지구를 향하여",
      caption: "안녕, 나의 지구. 지금 여기 도착한 것은 어제의 당신들.",
      hud: "VOYAGER 1 — 1 LIGHT-DAY PASSING · 2026"
    }
  ];

  let width = 1;
  let height = 1;
  let isDomeMode = false;
  const requestedStartTime = Number(new URLSearchParams(window.location.search).get("t"));
  let filmTime = Number.isFinite(requestedStartTime) ? Math.max(0, Math.min(LAST_FRAME_S, requestedStartTime)) : 0;
  let playing = true;
  let lastTick = performance.now();
  let currentSceneIndex = -1;
  let audio = null;
  let soundOn = false;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smoothstep = (start, end, value) => { const x = clamp((value - start) / (end - start)); return x * x * (3 - 2 * x); };
  const easeInOut = (value) => value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  const hash = (value) => { const x = Math.sin(value * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  const sceneFor = (time) => {
    const idx = SCENES.findIndex((scene) => time >= scene.start && time < scene.end);
    return idx === -1 ? SCENES.length - 1 : idx;
  };
  const localTime = (scene, time) => clamp((time - scene.start) / (scene.end - scene.start));
  const formatClock = (seconds) => {
    const whole = Math.floor(Math.max(0, seconds));
    return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
  };

  function setSceneReadout(index) {
    if (index === currentSceneIndex) return;
    currentSceneIndex = index;
    const scene = SCENES[index];
    sceneId.textContent = scene.id;
    sceneTitle.textContent = scene.title;
    sceneMeta.textContent = scene.meta;
    captionText.textContent = scene.caption;
    if (simpleHudText) simpleHudText.textContent = scene.hud;
    document.querySelectorAll(".chapter-marker").forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === index);
      button.setAttribute("aria-current", buttonIndex === index ? "true" : "false");
    });
  }

  function buildChapterMarkers() {
    chapterMarkers.innerHTML = "";
    SCENES.forEach((scene) => {
      const button = document.createElement("button");
      button.className = "chapter-marker";
      button.type = "button";
      button.textContent = scene.id;
      button.title = `${scene.id} · ${scene.title}`;
      button.addEventListener("click", () => { filmTime = scene.start; playing = false; syncTransport(); });
      chapterMarkers.append(button);
    });
  }

  const font = (size, weight = 400) => `${weight} ${size}px "Noto Sans KR", sans-serif`;
  const mono = (size) => `500 ${size}px "DM Mono", monospace`;

  function drawText(text, x, y, options = {}) {
    const { align = "left", color = COLORS.white, size = 14, family = "sans", weight = 400, alpha = 1, baseline = "alphabetic" } = options;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.font = family === "mono" ? mono(size) : font(size, weight);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function line(x1, y1, x2, y2, color, alpha = 1, widthPx = 1, dash = []) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function circle(x, y, radius, color, alpha = 1, glow = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = color; }
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.2, radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(time) {
    const gradient = ctx.createRadialGradient(width * .5, height * .5, 0, width * .5, height * .5, Math.max(width, height) * .75);
    gradient.addColorStop(0, "#081320");
    gradient.addColorStop(.55, "#040913");
    gradient.addColorStop(1, COLORS.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const domeR = Math.min(width, height) * 0.46;
    for (let i = 0; i < 240; i += 1) {
      const x = hash(i + 2) * width;
      const y = hash(i + 5) * height;
      if (isDomeMode && Math.hypot(x - width * 0.5, y - height * 0.5) > domeR) continue;
      const strength = .12 + hash(i + 9) * .55;
      const blink = .7 + Math.sin(time * (.18 + hash(i + 13) * .6) + i) * .15;
      circle(x, y, .3 + hash(i + 17) * 1.1, "#d8e8ed", strength * blink);
    }
  }

  function drawVoyager(x, y, scale = 1, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.gold;
    ctx.fillStyle = "rgba(216, 183, 120, .2)";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, -9, 25, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, 34); ctx.lineTo(18, 34); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(2, 51); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, 28); ctx.lineTo(-46, 36); ctx.moveTo(18, 29); ctx.lineTo(45, 40); ctx.stroke();
    ctx.restore();
  }

  function drawSignal(x1, y1, x2, y2, progress, color, label) {
    line(x1, y1, x2, y2, color, .28, 1, [4, 7]);
    const x = mix(x1, x2, progress);
    const y = mix(y1, y2, progress);
    circle(x, y, 4, color, 1, 20);
    if (label) drawText(label, mix(x1, x2, .5), mix(y1, y2, .5) - 12, { align: "center", color, size: 10, family: "mono" });
  }

  // --- SCENE 1: 어둠 속의 신호 (0 - 15s) ---
  function sceneArrival(t) {
    const cx = width * .5; const cy = height * .48;
    const voyagerX = cx + 180; const voyagerY = cy + 15;
    const earthX = cx - 220; const earthY = cy - 20;
    const fade = smoothstep(0, .25, t);

    circle(earthX, earthY, 3, COLORS.cyan, fade, 20);
    drawText("어제의 지구", earthX, earthY + 20, { align: "center", color: COLORS.cyan, size: 11, family: "sans" });

    drawSignal(earthX, earthY, voyagerX - 16, voyagerY - 8, clamp(t / .85), COLORS.cyan, "지연 24시간");
    drawVoyager(voyagerX, voyagerY, 1.15, fade);
    drawText("보이저 1호 (나의 시선)", voyagerX, voyagerY + 70, { align: "center", color: COLORS.gold, size: 11, family: "mono", alpha: fade });
  }

  // --- SCENE 2: 떠나온 49년의 궤적 (15 - 45s) ---
  function sceneTrajectory(t) {
    const cx = width * .5; const cy = height * .5; const r = Math.min(width, height) * .26;
    circle(cx, cy, 7, "#fff2c2", .9, 35);
    drawText("SUN", cx, cy + 22, { align: "center", color: COLORS.muted, size: 10, family: "mono" });

    const earth = { x: cx + r * .22, y: cy + r * .08 };
    const jupiter = { x: cx - r * .48, y: cy + r * .18 };
    const saturn = { x: cx - r * .15, y: cy - r * .55 };
    const voyager = { x: cx + r * .92, y: cy - r * .82 };

    [earth, jupiter, saturn].forEach((body, index) => circle(body.x, body.y, 4 + index, [COLORS.cyan, "#c78751", "#d6c28e"][index], .9, 10));
    drawText("1977 지구", earth.x, earth.y + 18, { align: "center", color: COLORS.muted, size: 9, family: "mono" });
    drawText("1979 목성", jupiter.x, jupiter.y + 19, { align: "center", color: COLORS.muted, size: 9, family: "mono" });
    drawText("1980 토성", saturn.x, saturn.y - 12, { align: "center", color: COLORS.muted, size: 9, family: "mono" });

    const points = [earth, { x: cx - r * .1, y: cy + r * .15 }, jupiter, { x: cx - r * .32, y: cy - r * .25 }, saturn, { x: cx + r * .35, y: cy - r * .68 }, voyager];
    ctx.save(); ctx.strokeStyle = COLORS.white; ctx.globalAlpha = .75; ctx.lineWidth = 1.8; ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke(); ctx.restore();

    const progress = easeInOut(t);
    const pointIndex = Math.min(points.length - 2, Math.floor(progress * (points.length - 1)));
    const segmentProgress = progress * (points.length - 1) - pointIndex;
    const from = points[pointIndex]; const to = points[pointIndex + 1];
    drawVoyager(mix(from.x, to.x, segmentProgress), mix(from.y, to.y, segmentProgress), .45);

    drawText("49년간의 성간 비행 · 2026년 1광일 통과", cx, cy + r + 30, { align: "center", color: COLORS.gold, size: 12, family: "mono" });
  }

  // --- SCENE 3: 마지막으로 본 집 (45 - 70s) ---
  function scenePaleBlueDot(t) {
    const cx = width * .5; const cy = height * .48;
    const sunX = cx - 80; const sunY = cy; const earthX = cx + 150; const earthY = cy - 20;

    circle(sunX, sunY, 18, "#fff0be", .85, 75);
    circle(earthX, earthY, 1.4, COLORS.cyan, .95, 20);
    line(sunX + 8, sunY - 10, earthX - 7, earthY + 2, COLORS.cyan, .3, 1);

    drawText("지구 (0.1015 초각)", earthX, earthY - 20, { align: "center", color: COLORS.cyan, size: 11, family: "sans" });
    drawText("1990년 촬영 후 영구 정지된 나의 눈", cx, cy + 90, { align: "center", color: COLORS.gold, size: 12, family: "mono" });
  }

  // --- SCENE 4: 1광일의 심연 (70 - 105s) ---
  function sceneGap(t) {
    const cx = width * .5; const cy = height * .48;
    const earthX = cx - 260; const voyagerX = cx + 260; const y = cy;

    circle(earthX, y, 7, COLORS.cyan, 1, 28);
    drawVoyager(voyagerX, y - 8, .9);
    drawSignal(earthX + 10, y, voyagerX - 40, y, (t * 1.5) % 1, COLORS.cyan, "빛의 속도로 24시간");

    line(earthX, y + 36, voyagerX, y + 36, COLORS.white, .25, 1);
    drawText("1 LIGHT-DAY = 25,902,068,371 km", cx, y + 65, { align: "center", color: COLORS.white, size: 13, family: "mono" });
  }

  // --- SCENE 5: 두 장소의 하루 (105 - 135s) ---
  function sceneDay(t) {
    const cx = width * .5; const cy = height * .45;
    const panelW = Math.min(width * .36, 300); const panelH = 140;
    const leftX = cx - panelW - 15; const rightX = cx + 15; const y = cy - panelH * .5;
    const drift = easeInOut(t);

    // Left Panel (Earth)
    ctx.save(); ctx.fillStyle = "rgba(4, 12, 22, .75)"; ctx.strokeStyle = "rgba(104, 216, 232, .25)";
    ctx.beginPath(); ctx.roundRect(leftX, y, panelW, panelH, 6); ctx.fill(); ctx.stroke();
    drawText("지구의 24시간 (공전)", leftX + 14, y + 22, { color: COLORS.cyan, size: 11, family: "sans" });
    const a = { x: leftX + panelW * .35, y: y + panelH * .62 };
    circle(a.x, a.y, 6, COLORS.cyan, 1, 16);
    line(a.x, a.y, a.x + panelW * (.35 + drift * .1), a.y - panelH * (.2 + drift * .1), COLORS.cyan, 1, 2);
    drawText("하루 257만 km 이동 (초속 29.8 km)", leftX + 14, y + panelH - 14, { color: COLORS.white, size: 10, family: "mono" });
    ctx.restore();

    // Right Panel (Voyager)
    ctx.save(); ctx.fillStyle = "rgba(4, 12, 22, .75)"; ctx.strokeStyle = "rgba(216, 183, 120, .25)";
    ctx.beginPath(); ctx.roundRect(rightX, y, panelW, panelH, 6); ctx.fill(); ctx.stroke();
    drawText("보이저의 24시간 (성간 비행)", rightX + 14, y + 22, { color: COLORS.gold, size: 11, family: "sans" });
    const b = { x: rightX + panelW * .35, y: y + panelH * .62 };
    circle(b.x, b.y, 5, COLORS.gold, 1, 16);
    line(b.x, b.y, b.x + panelW * (.22 + drift * .1), b.y - panelH * (.1 + drift * .18), COLORS.gold, 1, 2);
    drawText("하루 147만 km 이동 (초속 16.9 km)", rightX + 14, y + panelH - 14, { color: COLORS.white, size: 10, family: "mono" });
    ctx.restore();

    drawText("같은 24시간, 서로 다른 시공간을 살아가는 우리", cx, y + panelH + 34, { align: "center", color: COLORS.gold, size: 12, family: "sans" });
  }

  // --- SCENE 6: 엇갈리는 시계 (135 - 160s) ---
  function sceneClocks(t) {
    const cx = width * .5; const cy = height * .46;
    const r = Math.min(width, height) * .1; const hand = t * Math.PI * 4;

    // Earth clock
    circle(cx - r * 1.6, cy, r, "rgba(232, 244, 247, .06)");
    ctx.save(); ctx.strokeStyle = "rgba(232, 244, 247, .35)"; ctx.beginPath(); ctx.arc(cx - r * 1.6, cy, r, 0, Math.PI * 2); ctx.stroke();
    line(cx - r * 1.6, cy, cx - r * 1.6 + Math.cos(hand) * r * .7, cy + Math.sin(hand) * r * .7, COLORS.cyan, 1, 2);
    drawText("지구의 시계", cx - r * 1.6, cy + r + 24, { align: "center", color: COLORS.cyan, size: 11, family: "sans" });
    ctx.restore();

    // Voyager clock
    circle(cx + r * 1.6, cy, r, "rgba(232, 244, 247, .06)");
    ctx.save(); ctx.strokeStyle = "rgba(232, 244, 247, .35)"; ctx.beginPath(); ctx.arc(cx + r * 1.6, cy, r, 0, Math.PI * 2); ctx.stroke();
    line(cx + r * 1.6, cy, cx + r * 1.6 + Math.cos(hand - .00005) * r * .7, cy + Math.sin(hand - .00005) * r * .7, COLORS.gold, 1, 2);
    drawText("보이저의 시계", cx + r * 1.6, cy + r + 24, { align: "center", color: COLORS.gold, size: 11, family: "sans" });
    ctx.restore();

    drawText("특수상대론적 시계 지연: 매일 약 139 마이크로초", cx, cy + r + 56, { align: "center", color: COLORS.gold, size: 11, family: "mono" });
  }

  // --- SCENE 7: 성간의 떨림 (160 - 180s) ---
  function sceneSensors(t) {
    const cx = width * .5; const cy = height * .46;
    const graphW = Math.min(width * .64, 520); const graphH = 150;
    const x = cx - graphW * .5; const y = cy - graphH * .5;

    ctx.save(); ctx.fillStyle = "rgba(4, 12, 22, .8)"; ctx.strokeStyle = "rgba(104, 216, 232, .3)";
    ctx.beginPath(); ctx.roundRect(x, y, graphW, graphH, 6); ctx.fill(); ctx.stroke();
    drawText("PWS 플라스마파 진동 (아이오와대 기록)", x + 14, y + 20, { color: COLORS.cyan, size: 10, family: "mono" });

    const cols = 55; const rows = 16; const cellW = graphW / cols; const cellH = (graphH - 35) / rows;
    for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) {
      const wave = Math.sin(c * .2 + r * .4 + t * 8);
      const ridge = Math.exp(-Math.pow(r - (8 + Math.sin(c * .14 + t * 5) * 4), 2) / 9);
      const val = clamp((wave + 1) * .12 + ridge * .75);
      ctx.fillStyle = `hsla(${mix(211, 44, val)}, 80%, ${mix(15, 68, val)}%, ${mix(.15, .88, val)})`;
      ctx.fillRect(x + c * cellW, y + 28 + r * cellH, cellW + .2, cellH + .2);
    }
    const scan = x + ((t * graphW * .6) % graphW);
    line(scan, y + 28, scan, y + graphH - 6, COLORS.white, .75, 1);
    ctx.restore();

    drawText("눈을 감은 뒤, 성간 플라스마의 떨림이 내 몸을 울린다", cx, y + graphH + 30, { align: "center", color: COLORS.gold, size: 12, family: "sans" });
  }

  // --- SCENE 8: 원자의 심박수 (180 - 198s) ---
  function sceneRtg(t) {
    const cx = width * .5; const cy = height * .46; const r = Math.min(width, height) * .16;

    circle(cx, cy, r * .42, "rgba(216, 140, 60, .85)", 1, 30);
    ctx.save(); ctx.strokeStyle = "rgba(216, 183, 120, .55)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

    for (let i = 0; i < 90; i += 1) {
      const angle = hash(i + 1) * Math.PI * 2;
      const dist = Math.sqrt(hash(i + 4)) * r * .82;
      const flicker = .35 + .65 * Math.max(0, Math.sin(t * 8 + hash(i + 7) * 9));
      circle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1 + hash(i + 11) * 1.5, COLORS.gold, flicker, flicker > .8 ? 6 : 0);
    }

    drawText("플루토늄-238 원자핵 붕괴열 (RTG)", cx, cy - r - 18, { align: "center", color: COLORS.gold, size: 12, family: "sans", weight: 600 });
    drawText("마지막 미열로 20와트 전파를 만들어 지구로 송신", cx, cy + r + 26, { align: "center", color: COLORS.muted, size: 11, family: "mono" });
  }

  // --- SCENE 9: 내일로 보내는 응답 (198 - 210s) ---
  function sceneFinal(t) {
    const cx = width * .5; const cy = height * .46;
    const fade = clamp((1 - t) * 2);
    circle(cx, cy, 2, COLORS.cyan, .95 * fade, 25);

    drawText("안녕, 나의 지구.", cx, cy + 40, { align: "center", color: COLORS.white, size: 24, weight: 600, alpha: fade });
    drawText("VOYAGER 1 — 1 LIGHT-DAY PASSING · 2026", cx, cy + 74, { align: "center", color: COLORS.gold, size: 11, family: "mono", alpha: fade });
  }

  function renderScene(index, time) {
    const t = localTime(SCENES[index], time);
    [sceneArrival, sceneTrajectory, scenePaleBlueDot, sceneGap, sceneDay, sceneClocks, sceneSensors, sceneRtg, sceneFinal][index](t);
  }

  function drawDomeOverlay() {
    if (!isDomeMode) return;
    const cx = width * .5; const cy = height * .5;
    const r = Math.min(width, height) * 0.46;

    // Draw full outer black mask
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Dome altitude grid lines
    ctx.strokeStyle = COLORS.domeGrid;
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach((ratio, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cross-hairs
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();

    // Cardinal labels
    drawText("N", cx, cy - r + 15, { align: "center", color: COLORS.cyan, size: 11, family: "mono" });
    drawText("S", cx, cy + r - 8, { align: "center", color: COLORS.cyan, size: 11, family: "mono" });
    drawText("E", cx + r - 15, cy + 4, { align: "center", color: COLORS.cyan, size: 11, family: "mono" });
    drawText("W", cx - r + 15, cy + 4, { align: "center", color: COLORS.cyan, size: 11, family: "mono" });
    ctx.restore();
  }

  function ensureAudio() {
    if (audio) return audio;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const audioContext = new AudioContext();
    const master = audioContext.createGain();
    const low = audioContext.createOscillator();
    const high = audioContext.createOscillator();
    const lowGain = audioContext.createGain();
    const highGain = audioContext.createGain();

    low.type = "sine"; high.type = "triangle";
    low.frequency.value = 52; high.frequency.value = 104;
    lowGain.gain.value = .0001; highGain.gain.value = .0001; master.gain.value = .16;

    low.connect(lowGain).connect(master);
    high.connect(highGain).connect(master);
    master.connect(audioContext.destination);
    low.start(); high.start();
    audio = { context: audioContext, low, high, lowGain, highGain };
    return audio;
  }

  function updateAudio(index) {
    if (!audio || !soundOn) return;
    const now = audio.context.currentTime;
    const root = [52, 58, 49, 55, 62, 47, 66, 43, 52][index];
    audio.low.frequency.setTargetAtTime(root, now, .35);
    audio.high.frequency.setTargetAtTime(root * 2.01, now, .45);
    audio.lowGain.gain.setTargetAtTime(.055, now, .35);
    audio.highGain.gain.setTargetAtTime(index === 6 ? .022 : .011, now, .35);
  }

  function toggleSound() {
    const sound = ensureAudio(); if (!sound) return;
    soundOn = !soundOn;
    if (sound.context.state === "suspended") sound.context.resume();
    sound.lowGain.gain.setTargetAtTime(soundOn ? .055 : .0001, sound.context.currentTime, .18);
    sound.highGain.gain.setTargetAtTime(soundOn ? .011 : .0001, sound.context.currentTime, .18);
    muteButton.textContent = soundOn ? "소리 끄기" : "소리 켜기";
    muteButton.setAttribute("aria-pressed", String(soundOn));
  }

  function toggleDomeMode() {
    isDomeMode = !isDomeMode;
    domeButton.classList.toggle("active", isDomeMode);
    domeButton.setAttribute("aria-pressed", String(isDomeMode));
    domeButton.textContent = isDomeMode ? "돔 스크린 180° ON" : "돔 스크린 180° OFF";
  }

  // --- Browser MediaRecorder Canvas Recording ---
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  function startRecording() {
    const mode = recordModeSelect ? recordModeSelect.value : "full";
    if (mode === "full") {
      filmTime = 0;
      playing = true;
    }
    recordedChunks = [];

    // Capture 30fps stream directly from canvas
    const stream = canvas.captureStream(30);

    // Audio stream mixing if Web Audio context is initialized
    if (audio && audio.context) {
      try {
        const dest = audio.context.createMediaStreamDestination();
        audio.lowGain.connect(dest);
        audio.highGain.connect(dest);
        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
        }
      } catch (e) {
        console.warn("Could not attach audio track to recording stream:", e);
      }
    }

    let mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
    }

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    } catch (err) {
      mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      const isDomeStr = isDomeMode ? "Fulldome" : "Wide";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `Voyager1_LightDayGap_${isDomeStr}_${timestamp}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 200);

      isRecording = false;
      recordButton.classList.remove("recording");
      recordButton.setAttribute("aria-pressed", "false");
      recordButton.textContent = "● 녹화 시작";
    };

    mediaRecorder.start(1000); // 1-second chunks
    isRecording = true;
    recordButton.classList.add("recording");
    recordButton.setAttribute("aria-pressed", "true");
    recordButton.textContent = "■ 녹화 중지 (저장)";
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function syncTransport() {
    const index = sceneFor(filmTime);
    setSceneReadout(index);
    timeline.value = String(filmTime);
    const recIndicator = isRecording ? " [REC]" : "";
    clock.textContent = `${formatClock(filmTime)} / 03:30${recIndicator}`;
    playButton.textContent = playing ? "일시정지" : "재생";
    playButton.setAttribute("aria-pressed", String(playing));
  }

  function render(now) {
    const elapsed = Math.min(.05, (now - lastTick) / 1000);
    lastTick = now;
    if (playing) {
      filmTime = Math.min(DURATION_S, filmTime + elapsed);
      if (filmTime >= DURATION_S) {
        playing = false;
        if (isRecording && recordModeSelect && recordModeSelect.value === "full") {
          stopRecording();
        }
      }
    }
    const index = sceneFor(Math.min(filmTime, LAST_FRAME_S));
    drawBackground(filmTime);
    renderScene(index, filmTime);
    drawDomeOverlay();
    updateAudio(index);
    syncTransport();
    requestAnimationFrame(render);
  }

  playButton.addEventListener("click", () => {
    if (filmTime >= DURATION_S) filmTime = 0;
    playing = !playing;
    syncTransport();
  });
  muteButton.addEventListener("click", toggleSound);
  if (domeButton) domeButton.addEventListener("click", toggleDomeMode);
  if (recordButton) recordButton.addEventListener("click", toggleRecording);
  timeline.addEventListener("input", () => { filmTime = Number(timeline.value); playing = false; syncTransport(); });

  // Explain Guide Modal
  if (explainButton && explainModal) {
    explainButton.addEventListener("click", () => {
      explainModal.classList.add("open");
      explainModal.setAttribute("aria-hidden", "false");
      explainButton.setAttribute("aria-expanded", "true");
    });
  }
  if (closeExplainButton && explainModal) {
    closeExplainButton.addEventListener("click", () => {
      explainModal.classList.remove("open");
      explainModal.setAttribute("aria-hidden", "true");
      if (explainButton) explainButton.setAttribute("aria-expanded", "false");
    });
  }

  // Essay / Review Modal
  essayButton.addEventListener("click", () => {
    essayModal.classList.add("open");
    essayModal.setAttribute("aria-hidden", "false");
    essayButton.setAttribute("aria-expanded", "true");
  });
  closeEssayButton.addEventListener("click", () => {
    essayModal.classList.remove("open");
    essayModal.setAttribute("aria-hidden", "true");
    essayButton.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === "Space") { event.preventDefault(); playButton.click(); }
    if (event.code === "Escape") {
      if (explainModal) { explainModal.classList.remove("open"); explainModal.setAttribute("aria-hidden", "true"); }
      if (essayModal) { essayModal.classList.remove("open"); essayModal.setAttribute("aria-hidden", "true"); }
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      filmTime = clamp(filmTime + (event.code === "ArrowLeft" ? -5 : 5), 0, DURATION_S);
      playing = false;
      syncTransport();
    }
  });

  window.addEventListener("resize", resize);

  buildChapterMarkers();
  resize();
  syncTransport();
  requestAnimationFrame(render);
});
