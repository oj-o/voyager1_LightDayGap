"""Timeline management for VOYAGER 1 — LIGHT DAY GAP.

Compliant with 4K UHD & 3~4 min cinematic dome format:
225 seconds (3m 45s), 30 fps, 6,750 frames (index 0 to 6749).
Maps video frame index to scene metadata, local time, and physical epoch.
"""

import json
from pathlib import Path
from typing import Dict, Any, Tuple


class Timeline:
    def __init__(self, config_path: str = "config/film.json"):
        cfg_file = Path(config_path)
        self.config = json.loads(cfg_file.read_text(encoding="utf-8"))
        self.duration_s = float(self.config.get("duration_s", 225))
        self.fps = int(self.config.get("fps", 30))
        self.total_frames = int(self.config.get("total_frames", 6750))
        self.scenes = self.config["scenes"]

    def scene_at_time(self, t_video: float) -> Tuple[int, Dict[str, Any], float]:
        """Return (scene_index, scene_dict, local_t [0.0, 1.0]).

        Intervals are [start, end) except the last frame which belongs to S09.
        """
        t = max(0.0, min(self.duration_s - 1e-6, t_video))
        for idx, scene in enumerate(self.scenes):
            if scene["start"] <= t < scene["end"]:
                dur = scene["end"] - scene["start"]
                local_u = (t - scene["start"]) / dur
                return idx, scene, float(local_u)

        # Fallback to last scene
        last_idx = len(self.scenes) - 1
        return last_idx, self.scenes[last_idx], 1.0

    def frame_info(self, frame_index: int) -> Dict[str, Any]:
        """Compute state dictionary for a specific frame index (0..6749)."""
        idx = max(0, min(self.total_frames - 1, frame_index))
        t_video = idx / float(self.fps)
        scene_idx, scene, local_u = self.scene_at_time(t_video)

        return {
            "frame_index": idx,
            "total_frames": self.total_frames,
            "fps": self.fps,
            "t_video": t_video,
            "duration_s": self.duration_s,
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
            "local_time_s": t_video - scene["start"],
            "scene_duration_s": scene["end"] - scene["start"]
        }
