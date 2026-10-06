"""Scene drawing implementations for VOYAGER 1 — LIGHT DAY GAP.

Fulldome Planetarium & Cinematic 16:9 Renderer:
- Voyager 1 First-Person Perspective narrative & poetic minimalism
- Simplified, intuitive HUD without clutter
- Dual projection support:
    * Standard Widescreen (1920x1080 / 3840x2160)
    * Fulldome Domemaster (2160x2160 / 4096x4096 circular fisheye dome projection)
"""

import math
import json
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Color palette from specification
COLORS = {
    "bg": (3, 6, 11),
    "earth_cyan": (104, 216, 232),
    "voyager_gold": (216, 183, 120),
    "white": (232, 244, 247),
    "muted": (146, 169, 181),
    "dark_muted": (70, 95, 110),
    "panel_bg": (4, 12, 24, 190),
    "panel_border": (104, 216, 232, 50),
    "sun_glow": (255, 240, 190),
    "dome_mask": (1, 2, 4),
    "dome_grid": (45, 75, 95, 45)
}


class FontManager:
    """Manages system fonts for Korean and monospace numeric readouts."""
    def __init__(self):
        font_candidates_kr = [
            "C:/Windows/Fonts/NotoSansKR-VF.ttf",
            "C:/Windows/Fonts/malgun.ttf",
            "C:/Windows/Fonts/malgunbd.ttf"
        ]
        self.kr_font_path = None
        for p in font_candidates_kr:
            if Path(p).exists():
                self.kr_font_path = p
                break
        self.cache = {}

    def get_font(self, size: int, bold: bool = False):
        key = (size, bold)
        if key not in self.cache:
            if self.kr_font_path:
                try:
                    self.cache[key] = ImageFont.truetype(self.kr_font_path, size)
                except Exception:
                    self.cache[key] = ImageFont.load_default()
            else:
                self.cache[key] = ImageFont.load_default()
        return self.cache[key]


font_mgr = FontManager()


def draw_glow_circle(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, color: Tuple[int, int, int], alpha: float = 1.0, glow_radius: float = 0.0):
    """Draw a circle with soft glowing aura."""
    if glow_radius > 0 and alpha > 0.05:
        glow_steps = 4
        for i in range(glow_steps, 0, -1):
            r = radius + glow_radius * (i / glow_steps)
            a = int(alpha * 35 * (1.0 - (i / glow_steps) ** 0.8))
            draw.ellipse([x - r, y - r, x + r, y + r], fill=(color[0], color[1], color[2], a))

    fill_a = int(alpha * 255)
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=(color[0], color[1], color[2], fill_a))


def draw_voyager_silhouette(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0, alpha: float = 1.0):
    """Draw iconic Voyager spacecraft high-gain dish, boom, and magnetometer boom."""
    gold = COLORS["voyager_gold"]
    col = (gold[0], gold[1], gold[2], int(alpha * 255))
    s = scale

    # Parabolic dish (ellipse)
    dish_box = [x - 30 * s, y - 14 * s, x + 30 * s, y + 14 * s]
    draw.ellipse(dish_box, outline=col, width=max(1, int(2 * s)))

    # Central feed horn
    draw.line([x, y, x, y - 22 * s], fill=col, width=max(1, int(1.5 * s)))
    draw.ellipse([x - 3 * s, y - 24 * s, x + 3 * s, y - 20 * s], fill=col)

    # Bus truss body
    draw.polygon([
        (x - 12 * s, y + 10 * s),
        (x + 12 * s, y + 10 * s),
        (x + 16 * s, y + 36 * s),
        (x - 16 * s, y + 36 * s)
    ], outline=col, width=max(1, int(1.5 * s)))

    # RTG boom (left)
    draw.line([x - 14 * s, y + 25 * s, x - 55 * s, y + 40 * s], fill=col, width=max(1, int(1.5 * s)))
    draw.rectangle([x - 62 * s, y + 34 * s, x - 52 * s, y + 46 * s], outline=col, width=1)

    # MAG boom (right)
    draw.line([x + 14 * s, y + 25 * s, x + 65 * s, y + 48 * s], fill=col, width=max(1, int(1.5 * s)))


def draw_simple_badge(draw: ImageDraw.ImageDraw, x: float, y: float, text: str, font, color=COLORS["muted"]):
    """Draw minimal clean text badge for intuitive reading."""
    draw.text((x, y), text, font=font, fill=color)


class SceneRenderer:
    def __init__(self, width: int = 1920, height: int = 1080, dome_mode: bool = False):
        self.w = width
        self.h = height
        self.dome_mode = dome_mode or (width == height)
        self.aspect = width / height

        # Dome dimensions
        self.dome_radius = min(self.w, self.h) * 0.48
        self.dome_cx = self.w * 0.5
        self.dome_cy = self.h * 0.5

        # Load processed data
        self.traj_data = json.loads(Path("data/processed/trajectory_1977_2026.json").read_text(encoding="utf-8"))
        self.phys_summary = json.loads(Path("data/processed/physics_verification.json").read_text(encoding="utf-8"))

        # Precompute deterministic starfield (450 background stars)
        rng = np.random.default_rng(19770905)
        self.stars_x = rng.uniform(0, self.w, 450)
        self.stars_y = rng.uniform(0, self.h, 450)
        self.stars_mag = rng.uniform(0.3, 1.4, 450)
        self.stars_blink = rng.uniform(0.1, 0.9, 450)

    def draw_starfield(self, draw: ImageDraw.ImageDraw, t_video: float):
        """Draw deterministic cosmic background with gentle twinkling."""
        for x, y, mag, b in zip(self.stars_x, self.stars_y, self.stars_mag, self.stars_blink):
            if self.dome_mode:
                if math.hypot(x - self.dome_cx, y - self.dome_cy) > self.dome_radius:
                    continue
            twinkle = 0.65 + 0.35 * math.sin(t_video * 1.5 + b * 10)
            a = int(twinkle * 160)
            draw.ellipse([x - mag, y - mag, x + mag, y + mag], fill=(216, 232, 237, a))

    def draw_dome_overlay(self, draw: ImageDraw.ImageDraw):
        """Draw planetarium dome boundary and subtle altitude grid rings."""
        if not self.dome_mode:
            return

        cx, cy, r = self.dome_cx, self.dome_cy, self.dome_radius
        grid_col = COLORS["dome_grid"]

        # Altitude circles (Zenith 90°, Alt 60°, Alt 30°)
        for ratio, label in [(0.33, "60°"), (0.66, "30°")]:
            draw.ellipse([cx - r * ratio, cy - r * ratio, cx + r * ratio, cy + r * ratio], outline=grid_col, width=1)
            f_mono = font_mgr.get_font(10)
            draw.text((cx + 6, cy - r * ratio + 4), label, font=f_mono, fill=(100, 130, 150, 60))

        # Cardinal cross-hair / Horizon circle
        draw.line([(cx, cy - r), (cx, cy + r)], fill=grid_col, width=1)
        draw.line([(cx - r, cy), (cx + r, cy)], fill=grid_col, width=1)

        # Horizon Rim Glow
        for i in range(3):
            draw.ellipse([cx - (r + i), cy - (r + i), cx + (r + i), cy + (r + i)],
                         outline=(104, 216, 232, 70 - i * 20), width=1)

        # Cardinal direction labels at the rim
        f_dir = font_mgr.get_font(12, bold=True)
        draw.text((cx - 5, cy - r + 8), "N (북)", font=f_dir, fill=(104, 216, 232, 120))
        draw.text((cx - 5, cy + r - 22), "S (남)", font=f_dir, fill=(104, 216, 232, 120))
        draw.text((cx + r - 35, cy - 8), "E (동)", font=f_dir, fill=(104, 216, 232, 120))
        draw.text((cx - r + 10, cy - 8), "W (서)", font=f_dir, fill=(104, 216, 232, 120))

    def apply_dome_circular_mask(self, img: Image.Image) -> Image.Image:
        """Mask out pixels outside the dome circle with pure black."""
        if not self.dome_mode:
            return img

        # Use PIL image mask to keep outer region completely black for fulldome projection
        mask = Image.new("L", (self.w, self.h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse(
            [self.dome_cx - self.dome_radius, self.dome_cy - self.dome_radius,
             self.dome_cx + self.dome_radius, self.dome_cy + self.dome_radius],
            fill=255
        )

        black_bg = Image.new("RGB", (self.w, self.h), (0, 0, 0))
        return Image.composite(img, black_bg, mask)

    def _fit_font(self, draw: ImageDraw.ImageDraw, texts, max_width: int, start_size: int, min_size: int, bold: bool = False):
        """Return the largest Korean font that keeps every supplied line inside max_width."""
        for size in range(start_size, min_size - 1, -2):
            font = font_mgr.get_font(size, bold=bold)
            if all(draw.textbbox((0, 0), text, font=font)[2] <= max_width for text in texts if text):
                return font
        return font_mgr.get_font(min_size, bold=bold)

    def _draw_centered_text(self, draw: ImageDraw.ImageDraw, cx: int, y: int, text: str, font, fill):
        bbox = draw.textbbox((0, 0), text, font=font)
        draw.text((cx - (bbox[2] - bbox[0]) // 2, y), text, font=font, fill=fill)

    def draw_dome_safe_caption(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        """Draw short, horizontal captions close to the zenith of a Domemaster.

        Full-dome images stretch rapidly near the horizon.  Keeping the complete
        caption card inside the configured central dome radius makes the text readable from
        a seated audience without pretending that edge text is distortion-free.
        """
        cx, cy, r = int(self.dome_cx), int(self.dome_cy), self.dome_radius
        settings = state.get("dome_subtitle_settings", {})
        safe_ratio = float(settings.get("safe_radius_ratio", 0.36))
        safe_radius = r * safe_ratio
        max_card_width = int(safe_radius * 1.67)
        max_text_width = int(safe_radius * 1.45)

        title = state.get("scene_title", "")
        title_font = self._fit_font(draw, [title], max_text_width, int(self.h * 0.018), int(self.h * 0.012), bold=True)
        self._draw_centered_text(draw, cx, int(cy - safe_radius * 0.89), title, title_font, COLORS["white"])

        tag = state.get("scene_dome_science_tag", "")
        if tag:
            tag_font = self._fit_font(draw, [tag], max_text_width, int(self.h * 0.013), int(self.h * 0.010), bold=True)
            self._draw_centered_text(draw, cx, int(cy - safe_radius * 0.68), tag, tag_font, COLORS["earth_cyan"])

        lines = [line for line in state.get("scene_dome_caption", []) if line]
        if not lines:
            lines = [state.get("scene_caption", "")]
        lines = lines[:int(settings.get("max_lines", 2))]
        caption_font = self._fit_font(draw, lines, max_text_width, int(self.h * 0.018), int(self.h * 0.013), bold=True)
        fact = state.get("scene_simple_hud", "")
        fact_font = self._fit_font(draw, [fact], max_text_width, int(self.h * 0.011), int(self.h * 0.008))

        line_height = int(self.h * 0.024)
        caption_height = max(1, len(lines)) * line_height
        fact_height = int(self.h * 0.022) if fact else 0
        pad_y = int(self.h * 0.012)
        card_h = caption_height + fact_height + pad_y * 2
        content_widths = [draw.textbbox((0, 0), line, font=caption_font)[2] for line in lines]
        if fact:
            content_widths.append(draw.textbbox((0, 0), fact, font=fact_font)[2])
        card_w = max(
            int(r * 0.42),
            min(max_card_width, max(content_widths) + int(self.h * 0.04))
        )
        card_cy = int(cy + safe_radius * 0.42)
        card_x = int(cx - card_w * 0.5)
        card_y = int(card_cy - card_h * 0.5)
        draw.rounded_rectangle(
            [card_x, card_y, card_x + card_w, card_y + card_h],
            radius=max(8, int(self.h * 0.006)),
            fill=COLORS["panel_bg"],
            outline=COLORS["panel_border"],
            width=max(1, int(self.h * 0.0007))
        )

        text_y = card_y + pad_y
        for line in lines:
            self._draw_centered_text(draw, cx, text_y, line, caption_font, COLORS["white"])
            text_y += line_height
        if fact:
            self._draw_centered_text(draw, cx, text_y, fact, fact_font, COLORS["voyager_gold"])

    def draw_cinematic_hud(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        """Render concise, cinema-like first-person captions and intuitive minimal HUD."""
        if state.get("scene_id") == "S00":
            return  # S00 prologue renders its own complete intro title & artwork description card

        if self.dome_mode:
            self.draw_dome_safe_caption(draw, state)
            return

        f_title = font_mgr.get_font(int(self.h * 0.024), bold=True)
        f_hud = font_mgr.get_font(int(self.h * 0.015))
        f_caption = font_mgr.get_font(int(self.h * 0.025), bold=True)
        top_y = int(self.h * 0.05)
        bottom_y = int(self.h * 0.86)
        hud_y = int(self.h * 0.92)
        center_x = int(self.w * 0.5)

        # Upper Scene Header (Clean & Minimal)
        title_str = f"VOYAGER 1  ·  {state['scene_title']}"
        bbox_t = draw.textbbox((0, 0), title_str, font=f_title)
        draw.text((center_x - (bbox_t[2] - bbox_t[0]) // 2, top_y), title_str, font=f_title, fill=COLORS["white"])

        # Poetic First-Person Subtitle
        caption = state.get("scene_caption", "")
        if caption:
            bbox_c = draw.textbbox((0, 0), caption, font=f_caption)
            cx = center_x - (bbox_c[2] - bbox_c[0]) // 2
            # Soft dark halo for readability
            draw.text((cx + 1, bottom_y + 1), caption, font=f_caption, fill=(0, 0, 0, 240))
            draw.text((cx, bottom_y), caption, font=f_caption, fill=COLORS["white"])

        # Simple intuitive HUD fact (1 concise line)
        simple_hud = state.get("scene_simple_hud", "")
        if simple_hud:
            bbox_h = draw.textbbox((0, 0), simple_hud, font=f_hud)
            hx = center_x - (bbox_h[2] - bbox_h[0]) // 2
            draw.text((hx, hud_y), simple_hud, font=f_hud, fill=COLORS["voyager_gold"])

    # -------------------------------------------------------------
    # S00: 프롤로그 · 작품 설명 (00:00 - 00:15)
    # -------------------------------------------------------------
    def render_s00(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        cx = self.w * 0.5
        cy = self.h * 0.46

        # Dome titles must stay near the zenith just like the subtitles.  A wide
        # rectangular title card at the rim would look stretched after projection.
        if self.dome_mode:
            r = self.dome_radius
            fade = min(1.0, max(0.0, math.sin(u * math.pi))) if u < 0.9 else (1.0 - u) / 0.1
            f_kicker = font_mgr.get_font(int(self.h * 0.015), bold=True)
            f_title = font_mgr.get_font(int(self.h * 0.034), bold=True)
            f_subtitle = font_mgr.get_font(int(self.h * 0.018), bold=True)
            f_fact = font_mgr.get_font(int(self.h * 0.013))
            alpha = int(255 * fade)

            self._draw_centered_text(draw, int(cx), int(self.dome_cy - r * 0.29), "VOYAGER 1", f_kicker, (104, 216, 232, alpha))
            self._draw_centered_text(draw, int(cx), int(self.dome_cy - r * 0.21), "LIGHT DAY GAP", f_title, (232, 244, 247, alpha))
            self._draw_centered_text(draw, int(cx), int(self.dome_cy - r * 0.10), "하루 늦게 도착하는 우리", f_subtitle, (216, 183, 120, alpha))

            card_w = int(r * 0.58)
            card_h = int(r * 0.17)
            card_x = int(cx - card_w * 0.5)
            card_y = int(self.dome_cy + r * 0.06)
            draw.rounded_rectangle(
                [card_x, card_y, card_x + card_w, card_y + card_h],
                radius=max(8, int(self.h * 0.006)),
                fill=(4, 12, 24, int(210 * fade)),
                outline=(104, 216, 232, int(90 * fade)),
                width=max(1, int(self.h * 0.0007))
            )
            self._draw_centered_text(draw, int(cx), card_y + int(card_h * 0.22), "빛은 즉시 도착하지 않는다.", f_subtitle, (232, 244, 247, alpha))
            self._draw_centered_text(draw, int(cx), card_y + int(card_h * 0.57), "1광일 = 약 24시간 · MP4 · 3840×3840", f_fact, (216, 183, 120, alpha))
            return

        # Fading curve for smooth entrance and transition
        fade = min(1.0, max(0.0, math.sin(u * math.pi))) if u < 0.9 else (1.0 - u) / 0.1

        # Typography
        f_main_title = font_mgr.get_font(int(self.h * 0.038), bold=True)
        f_main_sub = font_mgr.get_font(int(self.h * 0.022), bold=False)
        f_quote = font_mgr.get_font(int(self.h * 0.019), bold=True)
        f_desc = font_mgr.get_font(int(self.h * 0.016), bold=False)
        f_badge = font_mgr.get_font(int(self.h * 0.013), bold=True)

        # Title
        t1 = "VOYAGER 1 — LIGHT DAY GAP"
        b1 = draw.textbbox((0, 0), t1, font=f_main_title)
        draw.text((cx - (b1[2] - b1[0]) // 2, cy - self.h * 0.22), t1, font=f_main_title, fill=COLORS["white"])

        # Subtitle
        t2 = "하루 늦게 도착하는 우리 (보이저 1호의 시선)"
        b2 = draw.textbbox((0, 0), t2, font=f_main_sub)
        draw.text((cx - (b2[2] - b2[0]) // 2, cy - self.h * 0.155), t2, font=f_main_sub, fill=COLORS["voyager_gold"])

        # Card Box with Artwork Description
        card_w = int(min(self.w, self.h) * 0.78) if self.dome_mode else int(self.w * 0.62)
        card_h = int(self.h * 0.26)
        card_x = int(cx - card_w * 0.5)
        card_y = int(cy - self.h * 0.08)

        draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=8, fill=COLORS["panel_bg"], outline=COLORS["panel_border"], width=1)

        # Curatorial text lines
        q_text = "“우리는 같은 우주에 있지만, 서로의 현재를 곧바로 받을 수는 없다.”"
        bq = draw.textbbox((0, 0), q_text, font=f_quote)
        draw.text((cx - (bq[2] - bq[0]) // 2, card_y + int(card_h * 0.18)), q_text, font=f_quote, fill=COLORS["earth_cyan"])

        d1 = "1977년 지구를 떠난 보이저 1호는 2026년 11월 18일, 지구로부터 1광일(259억 km)의 지점을 통과한다."
        bd1 = draw.textbbox((0, 0), d1, font=f_desc)
        draw.text((cx - (bd1[2] - bd1[0]) // 2, card_y + int(card_h * 0.44)), d1, font=f_desc, fill=COLORS["white"])

        d2 = "1990년 '창백한 푸른 점'을 끝으로 눈을 감은 탐사선의 시선으로 바라본 지연된 시공간의 서사."
        bd2 = draw.textbbox((0, 0), d2, font=f_desc)
        draw.text((cx - (bd2[2] - bd2[0]) // 2, card_y + int(card_h * 0.68)), d2, font=f_desc, fill=COLORS["muted"])

        # Technical Format Badge
        badge_txt = "화질 4K UHD (3840×2160)  ·  천체투영관 FULLDOME  ·  형식 MP4"
        bb = draw.textbbox((0, 0), badge_txt, font=f_badge)
        draw.text((cx - (bb[2] - bb[0]) // 2, card_y + card_h + int(self.h * 0.05)), badge_txt, font=f_badge, fill=COLORS["voyager_gold"])

    # -------------------------------------------------------------
    # S01: 어둠 속의 신호 (00:15 - 00:30)
    # -------------------------------------------------------------
    def render_s01(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        fade = min(1.0, max(0.0, u / 0.3))

        cx = self.w * 0.5
        cy = self.h * 0.48
        scale = 1.0 if not self.dome_mode else 0.85

        ex = cx - 280 * scale
        ey = cy - 20 * scale
        vx = cx + 220 * scale
        vy = cy + 20 * scale

        # Distant Earth (Yesterday's signal source)
        draw_glow_circle(draw, ex, ey, 3.5, COLORS["earth_cyan"], alpha=fade, glow_radius=22.0)
        draw.text((ex - 45, ey + 18), "어제의 지구 (출발점)", font=font_mgr.get_font(12), fill=COLORS["earth_cyan"])

        # Signal line
        draw.line([(ex, ey), (vx - 20, vy)], fill=(104, 216, 232, int(fade * 80)), width=1)
        pulse_u = min(1.0, max(0.0, (u - 0.1) / 0.8))
        px = ex + (vx - 20 - ex) * pulse_u
        py = ey + (vy - ey) * pulse_u
        draw_glow_circle(draw, px, py, 4.5, COLORS["earth_cyan"], alpha=fade, glow_radius=18.0)

        # Voyager silhouette receiving the message
        draw_voyager_silhouette(draw, vx, vy, scale=1.3 * scale, alpha=fade)
        if pulse_u > 0.85:
            rec_flash = math.sin((pulse_u - 0.85) / 0.15 * math.pi)
            draw_glow_circle(draw, vx, vy, 14.0, COLORS["voyager_gold"], alpha=rec_flash * 0.8, glow_radius=36.0)

    # -------------------------------------------------------------
    # S02: 떠나온 49년의 궤적 (00:15 - 00:45)
    # -------------------------------------------------------------
    def render_s02(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        samples = self.traj_data["samples"]

        cx = self.w * 0.5
        cy = self.h * 0.52
        scale = min(self.w, self.h) * 0.0028

        # Sun at center
        draw_glow_circle(draw, cx, cy, 7.0, COLORS["sun_glow"], alpha=1.0, glow_radius=35.0)
        draw.text((cx - 14, cy + 16), "SUN (태양)", font=font_mgr.get_font(11), fill=COLORS["muted"])

        # Planetary reference orbits
        for r_au, name, col in [(1.0, "지구 (1 AU)", (104, 216, 232, 45)),
                                (5.2, "목성 (5.2 AU)", (199, 135, 81, 45)),
                                (9.58, "토성 (9.5 AU)", (214, 194, 142, 45))]:
            r_px = math.log1p(r_au) * scale * 40
            draw.ellipse([cx - r_px, cy - r_px * 0.5, cx + r_px, cy + r_px * 0.5], outline=col, width=1)
            draw.text((cx + r_px - 20, cy - 8), name, font=font_mgr.get_font(10), fill=COLORS["muted"])

        # Plot 3D inclined trajectory
        cur_idx = int(u * (len(samples) - 1))
        coords = []
        for i in range(cur_idx + 1):
            s = samples[i]
            x_au, y_au, z_au = s["v1_ecliptic_au"]
            r_dist = math.sqrt(x_au**2 + y_au**2 + z_au**2)
            comp = math.log1p(r_dist) / max(1e-5, r_dist)
            px = cx + (x_au * comp) * scale * 40
            py = cy - (y_au * comp * 0.5 + z_au * comp * 0.8) * scale * 40
            coords.append((px, py))

        if len(coords) >= 2:
            draw.line(coords, fill=(232, 244, 247, 190), width=2)
            tip = coords[-1]
            draw_voyager_silhouette(draw, tip[0], tip[1], scale=0.7, alpha=1.0)
            cur_sample = samples[cur_idx]
            dist_str = f"항행 중: {cur_sample['dist_sun_au']:.1f} AU"
            draw.text((tip[0] + 16, tip[1] - 8), dist_str, font=font_mgr.get_font(11, bold=True), fill=COLORS["voyager_gold"])

    # -------------------------------------------------------------
    # S03: 마지막으로 본 집 (00:45 - 01:10)
    # -------------------------------------------------------------
    def render_s03(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        cx = self.w * 0.5
        cy = self.h * 0.48

        sun_x = cx - 90
        sun_y = cy
        earth_x = cx + 180
        earth_y = cy - 25

        # Distant Sun (11 arcsec)
        draw_glow_circle(draw, sun_x, sun_y, 13.0, COLORS["sun_glow"], alpha=0.9, glow_radius=80.0)
        draw.text((sun_x - 18, sun_y + 25), "태양 (11초각)", font=font_mgr.get_font(11), fill=COLORS["muted"])

        # Distant Earth (0.1015 arcsec) - tiny sub-pixel cyan dot
        draw_glow_circle(draw, earth_x, earth_y, 1.4, COLORS["earth_cyan"], alpha=1.0, glow_radius=14.0)
        draw.line([(sun_x + 18, sun_y), (earth_x - 10, earth_y)], fill=(104, 216, 232, 35), width=1)
        draw.text((earth_x - 30, earth_y - 25), "나의 집, 지구", font=font_mgr.get_font(12, bold=True), fill=COLORS["earth_cyan"])
        draw.text((earth_x - 30, earth_y - 10), "0.1015 초각의 미세한 점", font=font_mgr.get_font(10), fill=COLORS["muted"])

        # Magnified Zoom Inset Panel (showing 10,000x reference Earth)
        inset_w, inset_h = 220, 160
        ix = int(self.w * 0.72) if not self.dome_mode else int(cx + 90)
        iy = int(self.h * 0.28) if not self.dome_mode else int(cy - 140)
        draw.rounded_rectangle([ix, iy, ix + inset_w, iy + inset_h], radius=6, fill=COLORS["panel_bg"], outline=COLORS["panel_border"])

        f_mono = font_mgr.get_font(11, bold=True)
        draw.text((ix + 14, iy + 10), "기억 속의 지구 (10,000배)", font=f_mono, fill=COLORS["earth_cyan"])

        icx = ix + inset_w // 2
        icy = iy + inset_h // 2 + 10
        draw_glow_circle(draw, icx, icy, 30.0, (40, 110, 180), alpha=1.0, glow_radius=15.0)
        draw.arc([icx - 27, icy - 27, icx + 27, icy + 27], start=40, end=190, fill=COLORS["white"], width=2)
        draw.arc([icx - 22, icy - 15, icx + 22, icy + 15], start=220, end=330, fill=COLORS["white"], width=2)

    # -------------------------------------------------------------
    # S04: 1광일의 심연 (01:10 - 01:45)
    # -------------------------------------------------------------
    def render_s04(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        scale = 1.0 if not self.dome_mode else 0.85
        cx = self.w * 0.5
        cy = self.h * 0.48

        ex = cx - 320 * scale
        vx = cx + 320 * scale
        y = cy

        # Earth & Voyager
        draw_glow_circle(draw, ex, y, 8.0, COLORS["earth_cyan"], alpha=1.0, glow_radius=25.0)
        draw.text((ex - 30, y + 25), "지구 (Earth)", font=font_mgr.get_font(12, bold=True), fill=COLORS["earth_cyan"])

        draw_voyager_silhouette(draw, vx, y, scale=1.2 * scale, alpha=1.0)
        draw.text((vx - 30, y + 50), "보이저 1호", font=font_mgr.get_font(12, bold=True), fill=COLORS["voyager_gold"])

        # Coordinate line
        draw.line([(ex, y), (vx, y)], fill=(232, 244, 247, 75), width=1)
        draw.line([(ex, y - 8), (ex, y + 8)], fill=COLORS["earth_cyan"], width=2)
        draw.line([(vx, y - 8), (vx, y + 8)], fill=COLORS["voyager_gold"], width=2)

        # Traveling pulse
        pulse_pos = (u * 2.5) % 1.0
        px = ex + (vx - ex) * pulse_pos
        draw_glow_circle(draw, px, y, 5.0, COLORS["earth_cyan"], alpha=1.0, glow_radius=18.0)
        draw.text((px - 35, y - 22), "광속으로 24시간 이동", font=font_mgr.get_font(10), fill=COLORS["earth_cyan"])

        # Central Distance Callout
        f_mid = font_mgr.get_font(16, bold=True)
        txt = "1 LIGHT-DAY  =  25,902,068,371 km"
        bbox = draw.textbbox((0, 0), txt, font=f_mid)
        draw.text((cx - (bbox[2] - bbox[0]) // 2, y + 28), txt, font=f_mid, fill=COLORS["white"])

    # -------------------------------------------------------------
    # S05: 두 장소의 하루 (01:45 - 02:15)
    # -------------------------------------------------------------
    def render_s05(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]

        # A pair of wide information panels works on a flat screen but crosses
        # the high-distortion part of a dome.  In a dome, use short central bars
        # instead so the Earth/Voyager speed contrast stays legible.
        if self.dome_mode:
            cx, cy, r = self.dome_cx, self.dome_cy, self.dome_radius
            earth_speed = float(self.phys_summary.get("earth_speed_km_s", 30.1))
            voyager_speed = float(self.phys_summary.get("voyager_speed_km_s", 16.9))
            max_speed = max(earth_speed, voyager_speed)
            bar_left = int(cx - r * 0.27)
            bar_w = int(r * 0.50)
            bar_h = max(8, int(self.h * 0.012))
            f_label = font_mgr.get_font(int(self.h * 0.013), bold=True)
            progress = 0.25 + 0.75 * min(1.0, u * 1.8)

            for y_ratio, label, speed, color in [
                (-0.15, "지구  %.1f km/s" % earth_speed, earth_speed, COLORS["earth_cyan"]),
                (-0.04, "보이저  %.1f km/s" % voyager_speed, voyager_speed, COLORS["voyager_gold"]),
            ]:
                y = int(cy + r * y_ratio)
                draw.rounded_rectangle([bar_left, y, bar_left + bar_w, y + bar_h], radius=bar_h // 2, fill=(30, 48, 62, 190))
                filled_w = max(bar_h, int(bar_w * speed / max_speed * progress))
                draw.rounded_rectangle([bar_left, y, bar_left + filled_w, y + bar_h], radius=bar_h // 2, fill=color)
                draw.text((bar_left, y - int(self.h * 0.024)), label, font=f_label, fill=color)

            return

        cx = self.w * 0.5
        cy = self.h * 0.46
        pw = int(min(self.w, self.h) * 0.38)
        ph = int(pw * 0.65)

        p1_x = int(cx - pw - 20)
        p2_x = int(cx + 20)
        y = int(cy - ph * 0.5)

        # Panel 1: Earth 24h motion
        draw.rounded_rectangle([p1_x, y, p1_x + pw, y + ph], radius=6, fill=COLORS["panel_bg"], outline=COLORS["panel_border"])
        draw.text((p1_x + 14, y + 10), "지구의 24시간 (공전)", font=font_mgr.get_font(11, bold=True), fill=COLORS["earth_cyan"])
        e_cx = p1_x + pw * 0.35
        e_cy = y + ph * 0.65
        e_dx = pw * 0.40 * u
        e_dy = -ph * 0.25 * u
        draw_glow_circle(draw, e_cx, e_cy, 5.0, COLORS["earth_cyan"], alpha=0.3)
        draw.line([(e_cx, e_cy), (e_cx + e_dx, e_cy + e_dy)], fill=COLORS["earth_cyan"], width=2)
        draw_glow_circle(draw, e_cx + e_dx, e_cy + e_dy, 6.0, COLORS["earth_cyan"], alpha=1.0, glow_radius=14.0)
        draw.text((p1_x + 14, y + ph - 28), "하루 약 260만 km 이동 (초속 약 30.1 km)", font=font_mgr.get_font(11), fill=COLORS["white"])

        # Panel 2: Voyager 24h motion
        draw.rounded_rectangle([p2_x, y, p2_x + pw, y + ph], radius=6, fill=COLORS["panel_bg"], outline=COLORS["panel_border"])
        draw.text((p2_x + 14, y + 10), "보이저의 24시간 (성간 비행)", font=font_mgr.get_font(11, bold=True), fill=COLORS["voyager_gold"])
        v_cx = p2_x + pw * 0.35
        v_cy = y + ph * 0.65
        v_dx = pw * 0.22 * u
        v_dy = -ph * 0.32 * u
        draw_glow_circle(draw, v_cx, v_cy, 4.0, COLORS["voyager_gold"], alpha=0.3)
        draw.line([(v_cx, v_cy), (v_cx + v_dx, v_cy + v_dy)], fill=COLORS["voyager_gold"], width=2)
        draw_voyager_silhouette(draw, v_cx + v_dx, v_cy + v_dy, scale=0.75, alpha=1.0)
        draw.text((p2_x + 14, y + ph - 28), "하루 약 146만 km 이동 (초속 약 16.9 km)", font=font_mgr.get_font(11), fill=COLORS["white"])

    # -------------------------------------------------------------
    # S06: 엇갈리는 시계 (02:15 - 02:40)
    # -------------------------------------------------------------
    def render_s06(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        cx = self.w * 0.5
        cy = self.h * 0.46
        r = int(min(self.w, self.h) * 0.12)
        if self.dome_mode:
            cy = self.dome_cy - self.dome_radius * 0.04
            r = int(self.dome_radius * 0.09)

        c1_x = int(cx - r * 1.6)
        c2_x = int(cx + r * 1.6)
        y = cy

        # Clock 1: Earth Frame
        draw.ellipse([c1_x - r, y - r, c1_x + r, y + r], outline=(232, 244, 247, 90), width=2)
        hand1_ang = u * math.pi * 8 - math.pi / 2
        draw.line([(c1_x, y), (c1_x + math.cos(hand1_ang) * r * 0.8, y + math.sin(hand1_ang) * r * 0.8)], fill=COLORS["earth_cyan"], width=3)
        if not self.dome_mode:
            draw.text((c1_x - 45, y + r + 15), "지구의 시계", font=font_mgr.get_font(12, bold=True), fill=COLORS["earth_cyan"])

        # Clock 2: Voyager Frame
        draw.ellipse([c2_x - r, y - r, c2_x + r, y + r], outline=(232, 244, 247, 90), width=2)
        # Compare only the special-relativistic speed term in the same solar
        # reference frame.  The much larger 24-hour effect in this film is
        # light-travel time, not clock dilation.
        earth_speed = float(self.phys_summary.get("earth_speed_km_s", 30.1))
        voyager_speed = float(self.phys_summary.get("voyager_speed_km_s", 16.9))
        c_km_s = 299792.458
        daily_gap_s = 0.5 * ((earth_speed / c_km_s) ** 2 - (voyager_speed / c_km_s) ** 2) * 86400.0
        visual_scale = 1_000_000  # Exaggerate the otherwise invisible hand offset for the dome graphic.
        hand2_ang = hand1_ang - (daily_gap_s / 86400.0) * math.pi * 8 * visual_scale
        draw.line([(c2_x, y), (c2_x + math.cos(hand2_ang) * r * 0.8, y + math.sin(hand2_ang) * r * 0.8)], fill=COLORS["voyager_gold"], width=3)
        if not self.dome_mode:
            draw.text((c2_x - 50, y + r + 15), "보이저의 시계", font=font_mgr.get_font(12, bold=True), fill=COLORS["voyager_gold"])

        if self.dome_mode:
            f_dome_label = font_mgr.get_font(int(self.h * 0.011), bold=True)
            self._draw_centered_text(draw, c1_x, int(y - r - self.h * 0.026), "지구", f_dome_label, COLORS["earth_cyan"])
            self._draw_centered_text(draw, c2_x, int(y - r - self.h * 0.026), "보이저", f_dome_label, COLORS["voyager_gold"])
            return

        # Center subtle note
        f_m = font_mgr.get_font(12)
        self._draw_centered_text(draw, int(cx), int(y - 10), "속도에 따른 상대론 효과", f_m, COLORS["muted"])
        self._draw_centered_text(draw, int(cx), int(y + 10), f"실제 지구·보이저 차이: 하루 약 {daily_gap_s * 1e3:.2f} ms", f_m, COLORS["voyager_gold"])
        self._draw_centered_text(draw, int(cx), int(y + 28), "시계 바늘 차이는 보기 쉽게 확대", font_mgr.get_font(10), COLORS["muted"])

    # -------------------------------------------------------------
    # S07: 성간의 떨림 (02:40 - 03:00)
    # -------------------------------------------------------------
    def render_s07(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        cx = self.w * 0.5
        cy = self.h * 0.46
        gw = int(min(self.w, self.h) * 0.72)
        gh = int(gw * 0.38)
        gx = int(cx - gw * 0.5)
        gy = int(cy - gh * 0.5)

        draw.rounded_rectangle([gx, gy, gx + gw, gy + gh], radius=6, fill=COLORS["panel_bg"], outline=COLORS["panel_border"])
        draw.text((gx + 14, gy + 10), "PWS 플라스마파 진동 스펙트로그램 (아이오와대 기록)", font=font_mgr.get_font(11, bold=True), fill=COLORS["earth_cyan"])

        cols = 60
        rows = 18
        cell_w = gw / cols
        cell_h = (gh - 40) / rows

        for col in range(cols):
            for row in range(rows):
                val = 0.5 + 0.5 * math.sin(col * 0.22 + row * 0.45 + u * 12)
                ridge = math.exp(-((row - (10 + math.sin(col * 0.15 + u * 6) * 4)) ** 2) / 7.0)
                intensity = min(1.0, max(0.0, val * 0.2 + ridge * 0.8))
                r_c = int(intensity * 104)
                g_c = int(intensity * 216)
                b_c = int(intensity * 232)
                if intensity > 0.6:
                    r_c = int(216 * intensity)
                    g_c = int(183 * intensity)
                    b_c = int(120 * intensity)
                draw.rectangle([gx + col * cell_w, gy + 32 + row * cell_h,
                                gx + (col + 1) * cell_w, gy + 32 + (row + 1) * cell_h], fill=(r_c, g_c, b_c))

        scan_x = gx + (u * gw)
        draw.line([(scan_x, gy + 32), (scan_x, gy + gh - 8)], fill=COLORS["white"], width=2)

    # -------------------------------------------------------------
    # S08: 원자의 심박수 (03:00 - 03:18)
    # -------------------------------------------------------------
    def render_s08(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        u = state["local_progress"]
        cx = self.w * 0.5
        cy = self.h * 0.46
        r = int(min(self.w, self.h) * 0.16)

        # Core
        draw_glow_circle(draw, cx, cy, r * 0.45, (216, 140, 60), alpha=0.9, glow_radius=35.0)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=COLORS["voyager_gold"], width=2)

        # Alpha decay dots
        rng = np.random.default_rng(int(state["t_video"] * 12))
        for _ in range(30):
            ang = rng.uniform(0, 2 * math.pi)
            dist = rng.uniform(r * 0.2, r * 0.85)
            dot_x = cx + math.cos(ang) * dist
            dot_y = cy + math.sin(ang) * dist
            draw_glow_circle(draw, dot_x, dot_y, 2.5, COLORS["voyager_gold"], alpha=0.9, glow_radius=6.0)

        draw.text((cx - 60, cy - r - 25), "플루토늄-238 붕괴열 (RTG)", font=font_mgr.get_font(12, bold=True), fill=COLORS["voyager_gold"])
        draw.text((cx - 75, cy + r + 15), "20W 미약한 전파로 우주를 건너다", font=font_mgr.get_font(11), fill=COLORS["muted"])

    # -------------------------------------------------------------
    # S09: 내일로 보내는 응답 (03:18 - 03:30)
    # -------------------------------------------------------------
    def render_s09(self, draw: ImageDraw.ImageDraw, state: Dict[str, Any]):
        t = state["local_time_s"]
        fade = min(1.0, max(0.0, (12.0 - t) / 2.5))

        cx = self.w * 0.5
        cy = self.h * 0.46

        # Faint Earth dot
        draw_glow_circle(draw, cx, cy, 2.2, COLORS["earth_cyan"], alpha=fade * 0.95, glow_radius=18.0)

        # Concluding text
        f_final = font_mgr.get_font(int(self.h * 0.028), bold=True)
        txt1 = "안녕, 나의 지구."
        bbox1 = draw.textbbox((0, 0), txt1, font=f_final)
        draw.text((cx - (bbox1[2] - bbox1[0]) // 2, cy + 45), txt1, font=f_final, fill=COLORS["white"])

        f_meta = font_mgr.get_font(int(self.h * 0.015))
        txt2 = "VOYAGER 1 — LIGHT DAY GAP  |  1 LIGHT-DAY PASSING"
        bbox2 = draw.textbbox((0, 0), txt2, font=f_meta)
        draw.text((cx - (bbox2[2] - bbox2[0]) // 2, cy + 85), txt2, font=f_meta, fill=COLORS["voyager_gold"])

    def render_frame(self, state: Dict[str, Any]) -> Image.Image:
        """Render a single frame given timeline state dictionary."""
        presentation_alpha = float(state.get("presentation_alpha", 1.0))
        if presentation_alpha <= 0.0:
            return Image.new("RGB", (self.w, self.h), (0, 0, 0))

        # Create dark background
        img = Image.new("RGBA", (self.w, self.h), COLORS["bg"] + (255,))
        draw = ImageDraw.Draw(img, "RGBA")

        # Background stars
        self.draw_starfield(draw, state["t_video"])

        # Render specific scene
        idx = state["scene_index"]
        scene_funcs = [
            self.render_s00,
            self.render_s01,
            self.render_s02,
            self.render_s03,
            self.render_s04,
            self.render_s05,
            self.render_s06,
            self.render_s07,
            self.render_s08,
            self.render_s09
        ]
        scene_funcs[idx](draw, state)

        # Draw dome overlay lines if dome mode is active
        self.draw_dome_overlay(draw)

        # Overlay cinematic HUD and poetic subtitles
        self.draw_cinematic_hud(draw, state)

        # Apply circular dome mask if in dome mode
        rgb_img = img.convert("RGB")
        if self.dome_mode:
            rgb_img = self.apply_dome_circular_mask(rgb_img)

        if presentation_alpha < 1.0:
            black = Image.new("RGB", rgb_img.size, (0, 0, 0))
            rgb_img = Image.blend(black, rgb_img, presentation_alpha)

        return rgb_img
