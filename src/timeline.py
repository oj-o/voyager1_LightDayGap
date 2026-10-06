"""Timeline management for VOYAGER 1 — LIGHT DAY GAP.

Compliant with 4K UHD & 3~4 min cinematic dome format:
235 seconds (3m 55s), 30 fps, 7,050 frames (index 0 to 7049).
Includes 5 seconds of black at both the beginning and end; the 225-second
story remains unchanged and fades in/out over one second at each boundary.
Maps output-video frame index to scene metadata, local time, and physical epoch.
"""

import json
from pathlib import Path
from typing import Dict, Any, Tuple


class Timeline:
    def __init__(self, config_path: str = "config/film.json"):
        cfg_file = Path(config_path)
        self.config = json.loads(cfg_file.read_text(encoding="utf-8"))
        self.content_duration_s = float(self.config.get("content_duration_s", 225))
        presentation = self.config.get("presentation", {})
        self.lead_in_black_s = float(presentation.get("lead_in_black_s", 5))
        self.lead_out_black_s = float(presentation.get("lead_out_black_s", 5))
        self.fade_in_s = float(presentation.get("fade_in_s", 1))
        self.fade_out_s = float(presentation.get("fade_out_s", 1))
        self.duration_s = float(
            self.config.get(
                "duration_s",
                self.lead_in_black_s + self.content_duration_s + self.lead_out_black_s,
            )
        )
        self.fps = int(self.config.get("fps", 30))
        self.total_frames = int(self.config.get("total_frames", round(self.duration_s * self.fps)))
        self.scenes = self.config["scenes"]

    def presentation_at_time(self, t_video: float) -> Tuple[float, float]:
        """Return story time and its opacity for an output-video timestamp."""
        story_time = t_video - self.lead_in_black_s
        if story_time < 0.0 or story_time >= self.content_duration_s:
            return max(0.0, min(self.content_duration_s - 1e-6, story_time)), 0.0

        fade_in = min(1.0, story_time / self.fade_in_s) if self.fade_in_s else 1.0
        remaining = self.content_duration_s - story_time
        fade_out = min(1.0, remaining / self.fade_out_s) if self.fade_out_s else 1.0
        return story_time, min(fade_in, fade_out)

    def scene_at_time(self, t_video: float) -> Tuple[int, Dict[str, Any], float]:
        """Return (scene_index, scene_dict, local_t [0.0, 1.0]).

        Intervals are [start, end) except the last frame which belongs to S09.
        """
        t = max(0.0, min(self.content_duration_s - 1e-6, t_video))
        for idx, scene in enumerate(self.scenes):
            if scene["start"] <= t < scene["end"]:
                dur = scene["end"] - scene["start"]
                local_u = (t - scene["start"]) / dur
                return idx, scene, float(local_u)

        # Fallback to last scene
        last_idx = len(self.scenes) - 1
        return last_idx, self.scenes[last_idx], 1.0

    def frame_info(self, frame_index: int) -> Dict[str, Any]:
        """Compute state dictionary for a specific output frame index (0..7049)."""
        idx = max(0, min(self.total_frames - 1, frame_index))
        t_video = idx / float(self.fps)
        t_story, presentation_alpha = self.presentation_at_time(t_video)
        scene_idx, scene, local_u = self.scene_at_time(t_story)

        return {
            "frame_index": idx,
            "total_frames": self.total_frames,
            "fps": self.fps,
            "t_video": t_video,
            "t_story": t_story,
            "duration_s": self.duration_s,
            "content_duration_s": self.content_duration_s,
            "presentation_alpha": presentation_alpha,
            "scene_index": scene_idx,
            "scene_id": scene["id"],
            "scene_title": scene["title"],
            "scene_meta": scene["meta"],
            "scene_caption": scene["caption"],
            "scene_description": scene.get("description", ""),
            "scene_narration": scene.get("narration", ""),
            "scene_simple_hud": scene.get("simple_hud", ""),
            "scene_dome_science_tag": scene.get("dome_science_tag", ""),
            "scene_dome_caption": scene.get("dome_caption", []),
            "dome_subtitle_settings": self.config.get("dome_subtitles", {}),
            "local_progress": local_u,
            "local_time_s": t_story - scene["start"],
            "scene_duration_s": scene["end"] - scene["start"]
        }
