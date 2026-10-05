"""Offline frame-by-frame renderer and video exporter for VOYAGER 1 — LIGHT DAY GAP.

Compliant with 4K UHD & 3~4 min cinematic dome format:
- 225 seconds (3m 45s), 30 fps, exactly 6,750 frames (index 0 to 6749)
- 4K UHD (3840x2160) & 4K Fulldome Domemaster (3840x3840 / 2160x2160)
- Format: MP4 (H.264 video + 48kHz AAC stereo audio)
- Deterministic offline frame generation with fixed random seed
- Direct FFmpeg streaming pipeline via imageio-ffmpeg
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path
import imageio_ffmpeg
from PIL import Image

# Ensure project root in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.timeline import Timeline
from src.scenes.scenes import SceneRenderer


def get_ffmpeg_path() -> str:
    """Retrieve bundled or system FFmpeg binary path."""
    return imageio_ffmpeg.get_ffmpeg_exe()


def render_single_frame(
    frame_index: int,
    width: int = 3840,
    height: int = 2160,
    dome_mode: bool = False,
    out_path: str = None
) -> Image.Image:
    """Render a single frame deterministically by index (0..6749) in 4K."""
    timeline = Timeline()
    state = timeline.frame_info(frame_index)
    renderer = SceneRenderer(width=width, height=height, dome_mode=dome_mode)
    img = renderer.render_frame(state)

    if out_path:
        p = Path(out_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p)
        print(f"Saved frame {frame_index:04d} (t={state['t_video']:.2f}s, scene={state['scene_id']}) to {p}")
    return img


def export_scene_snapshots(
    width: int = 3840,
    height: int = 2160,
    dome_mode: bool = False,
    out_dir: str = "output/snapshots"
):
    """Export representative preview snapshots in 4K for all 10 scenes (S00 to S09)."""
    timeline = Timeline()
    renderer = SceneRenderer(width=width, height=height, dome_mode=dome_mode)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Frame indices representing midpoints of each scene in 225s timeline
    mid_frames = [
        (210, "S00_Prologue_Title_Card"),
        (660, "S01_Arrival_Signal"),
        (1350, "S02_Trajectory_49Y"),
        (2160, "S03_PaleBlueDot_Home"),
        (3060, "S04_LightDay_Gap"),
        (4050, "S05_TwoPlaces_OneDay"),
        (4860, "S06_Drifting_Clocks"),
        (5550, "S07_Interstellar_Whispers"),
        (6090, "S08_Atomic_Heartbeat"),
        (6540, "S09_Farewell_Earth")
    ]

    mode_label = f"Fulldome ({width}x{height})" if dome_mode else f"Widescreen 4K ({width}x{height})"
    print(f"[*] Exporting 10 scene snapshot images [{mode_label}] to {out}...")
    for frame_idx, label in mid_frames:
        state = timeline.frame_info(frame_idx)
        img = renderer.render_frame(state)
        prefix = "dome_" if dome_mode else ""
        file_path = out / f"{prefix}{frame_idx:04d}_{label}.png"
        img.save(file_path)
        print(f"    -> Exported {file_path.name}")
    print("[+] Snapshots export complete!")


def render_video(
    out_video_path: str = "output/Voyager1_LightDayGap_4K_3m45s.mp4",
    width: int = 3840,
    height: int = 2160,
    dome_mode: bool = False,
    fps: int = 30,
    duration_s: float = 225.0,
    audio_path: str = "output/audio/mix.wav",
    crf: int = 18,
    preset: str = "fast",
    max_frames: int = None
):
    """Render full video sequence directly into FFmpeg video encoder pipe in 4K MP4 format."""
    ffmpeg_exe = get_ffmpeg_path()
    total_frames = int(duration_s * fps) if max_frames is None else min(int(duration_s * fps), max_frames)
    timeline = Timeline()
    renderer = SceneRenderer(width=width, height=height, dome_mode=dome_mode)

    out_file = Path(out_video_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    # Build FFmpeg command for 4K MP4 output
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{width}x{height}",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "-",  # Stdin raw frames
    ]

    # Add audio input if exists
    has_audio = Path(audio_path).exists()
    if has_audio:
        cmd.extend([
            "-i", str(audio_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:a", "aac",
            "-b:a", "320k",
            "-ar", "48000"
        ])
    else:
        print("[!] Audio file not found, rendering video without audio track.")

    dur_s = total_frames / float(fps)
    cmd.extend([
        "-c:v", "libx264",
        "-crf", str(crf),
        "-preset", preset,
        "-pix_fmt", "yuv420p",
        "-r", str(fps),
        "-t", f"{dur_s:.3f}",
        "-movflags", "+faststart",
        str(out_file)
    ])

    mode_str = "Fulldome 1:1" if dome_mode else "Widescreen 16:9"
    print(f"[*] Starting FFmpeg MP4 encoder: {mode_str} 4K {width}x{height} @ {fps}fps ({total_frames} frames, {dur_s:.1f}s)...")
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    start_time = time.time()
    try:
        for idx in range(total_frames):
            state = timeline.frame_info(idx)
            frame_img = renderer.render_frame(state)
            proc.stdin.write(frame_img.tobytes())

            if idx % 150 == 0 or idx == total_frames - 1:
                elapsed = time.time() - start_time
                fps_render = (idx + 1) / max(0.01, elapsed)
                pct = (idx + 1) / total_frames * 100
                eta = (total_frames - (idx + 1)) / max(0.01, fps_render)
                print(f"    Frame {idx:04d}/{total_frames} ({pct:5.1f}%) | {fps_render:5.1f} fps | ETA: {eta:4.1f}s | Scene: {state['scene_id']}")

        proc.stdin.close()
        proc.wait()
    except Exception as e:
        proc.kill()
        raise e

    total_time = time.time() - start_time
    print(f"[+] 4K MP4 video render finished successfully in {total_time:.1f}s!")
    print(f"    Output: {out_file} ({out_file.stat().st_size / (1024*1024):.2f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render Voyager 1 Light Day Gap 4K MP4 Media Art")
    parser.add_argument("--snapshots", action="store_true", help="Export 4K scene snapshots")
    parser.add_argument("--frame", type=int, default=None, help="Render single frame index in 4K")
    parser.add_argument("--video", action="store_true", help="Render video in 4K MP4")
    parser.add_argument("--dome", action="store_true", help="Fulldome 1:1 circular domemaster mode (3840x3840 / 2160x2160)")
    parser.add_argument("--fhd", action="store_true", help="Render in 1080p FHD instead of default 4K UHD")
    parser.add_argument("--max-frames", type=int, default=None, help="Limit max frames for quick test")
    args = parser.parse_args()

    if args.dome:
        w = 2160 if args.fhd else 3840
        h = 2160 if args.fhd else 3840
        is_dome = True
        default_out = "output/Voyager1_LightDayGap_Fulldome_4K_3m45s.mp4"
    elif args.fhd:
        w = 1920
        h = 1080
        is_dome = False
        default_out = "output/Voyager1_LightDayGap_1080p_3m45s.mp4"
    else:
        # Default: 4K UHD (3840x2160)
        w = 3840
        h = 2160
        is_dome = False
        default_out = "output/Voyager1_LightDayGap_4K_3m45s.mp4"

    if args.snapshots:
        export_scene_snapshots(width=w, height=h, dome_mode=is_dome)
    elif args.frame is not None:
        out_name = f"dome_frame_{args.frame:04d}.png" if is_dome else f"frame_{args.frame:04d}.png"
        render_single_frame(args.frame, width=w, height=h, dome_mode=is_dome, out_path=f"output/frames/{out_name}")
    elif args.video:
        render_video(out_video_path=default_out, width=w, height=h, dome_mode=is_dome, max_frames=args.max_frames)
    else:
        # Default action: render scene snapshots
        export_scene_snapshots(width=w, height=h, dome_mode=is_dome)
