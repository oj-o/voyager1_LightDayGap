"""48kHz Stereo Audio Synthesizer for VOYAGER 1 — LIGHT DAY GAP.

Compliant with 4K UHD & 3~4 min cinematic dome format:
- 235 seconds (11,280,000 samples @ 48,000 Hz, stereo 16-bit PCM)
- The 225-second composition is silent for the 5-second black lead-in/out.
- Deterministic seed for reproducible sound generation
- Composed of:
    - Base ambient drone & low-frequency resonance
    - S00 (0-15s): Prologue ambient shimmer & deep sub-bass awakening
    - S01 (15-30s): Radio ping & reverberant tail
    - S02 (30-60s): Planetary flyby harmonics (Jupiter, Saturn, Heliopause, 1 Light Day)
    - S03 (60-85s): Distant high-frequency subtle shimmer & silence
    - S04 (85-120s): Carrier frequency transmission & pulse motifs
    - S05 (120-150s): Phase beat illustrating relative motion and orbital drift
    - S06 (150-175s): Dual clock ticks showing relativistic micro-phase difference
    - S07 (175-195s): PWS plasma wave sonification (Iowa EPO rising frequencies)
    - S08 (195-212s): Granular Poisson decay clicks integrating into continuous thermal warmth
    - S09 (212-225s): Return of opening motif with peaceful fade-out
"""

import math
import struct
import wave
import json
from pathlib import Path
import numpy as np


class AudioComposer:
    def __init__(
        self,
        sample_rate: int = 48000,
        content_duration_s: float = 225.0,
        lead_in_s: float = 5.0,
        lead_out_s: float = 5.0,
        fade_in_s: float = 1.0,
        fade_out_s: float = 1.0,
        seed: int = 19770905,
    ):
        self.sr = sample_rate
        self.content_duration_s = content_duration_s
        self.lead_in_s = lead_in_s
        self.lead_out_s = lead_out_s
        self.fade_in_s = fade_in_s
        self.fade_out_s = fade_out_s
        self.duration_s = self.lead_in_s + self.content_duration_s + self.lead_out_s
        self.n_samples = int(self.sr * self.duration_s)
        self.content_n_samples = int(self.sr * self.content_duration_s)
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def render(self) -> np.ndarray:
        """Render the complete output buffer with silent black lead-in/out."""
        t = np.linspace(0, self.content_duration_s, self.content_n_samples, endpoint=False, dtype=np.float32)
        left = np.zeros(self.content_n_samples, dtype=np.float32)
        right = np.zeros(self.content_n_samples, dtype=np.float32)

        print("[*] Generating base ambient drone...")
        # 1. Base cosmic drone (deep sub-bass 55Hz (A1) and 82.4Hz (E2) with slow phase drifts)
        lfo1 = 0.5 + 0.5 * np.sin(2 * np.pi * 0.04 * t)
        lfo2 = 0.5 + 0.5 * np.cos(2 * np.pi * 0.03 * t)
        drone_sub = 0.12 * np.sin(2 * np.pi * 55.0 * t) + 0.08 * np.sin(2 * np.pi * 82.4 * t + 0.5)
        drone_air = 0.04 * np.sin(2 * np.pi * 164.81 * t + lfo1) + 0.03 * np.sin(2 * np.pi * 220.0 * t)
        left += drone_sub * (0.8 + 0.2 * lfo1) + drone_air
        right += drone_sub * (0.8 + 0.2 * lfo2) + drone_air * 0.95

        # S00 (0 - 15s): Prologue ambient shimmer
        print("[*] Generating S00 prologue shimmer...")
        s0_mask = (t < 15.0)
        t_s0 = t[s0_mask]
        prologue_env = (1.0 - np.cos(np.pi * t_s0 / 15.0)) * 0.5
        prologue_chime = 0.06 * np.sin(2 * np.pi * 440.0 * t_s0) * prologue_env
        left[s0_mask] += prologue_chime
        right[s0_mask] += prologue_chime * 0.85

        # S01 (15 - 30s): Arrival electronic ping & resonance
        print("[*] Generating S01 arrival motif...")
        s1_mask = (t >= 16.5) & (t < 29.0)
        t_s1 = t[s1_mask] - 16.5
        ping_decay = np.exp(-t_s1 / 3.0).astype(np.float32)
        ping_sig = 0.22 * np.sin(2 * np.pi * 440.0 * t_s1) * ping_decay
        ping_res = 0.15 * np.sin(2 * np.pi * 880.0 * t_s1) * np.exp(-t_s1 / 1.0).astype(np.float32)
        left[s1_mask] += (ping_sig + ping_res) * 0.9
        right[s1_mask] += (ping_sig + ping_res) * 0.7

        # S02 (30 - 60s): Trajectory planetary passes
        print("[*] Generating S02 trajectory harmonics...")
        flybys = [
            (35.0, 43.0, 73.4, 0.18),    # Jupiter (D2)
            (43.0, 51.0, 98.0, 0.16),    # Saturn (G2)
            (51.0, 56.0, 130.8, 0.14),   # Heliopause (C3)
            (56.0, 60.0, 164.8, 0.15),   # 1 Light Day (E3)
        ]
        for start_sec, end_sec, freq, amp in flybys:
            mask = (t >= start_sec) & (t < end_sec)
            t_fb = t[mask] - start_sec
            dur = end_sec - start_sec
            env = np.sin(np.pi * (t_fb / dur)).astype(np.float32) ** 2
            harm = amp * env * np.sin(2 * np.pi * freq * t_fb)
            left[mask] += harm * 0.85
            right[mask] += harm * 1.15

        # S03 (60 - 85s): Pale Blue Dot & distant virtual silence
        print("[*] Generating S03 quietude & shimmer...")
        s3_mask = (t >= 60.0) & (t < 85.0)
        t_s3 = t[s3_mask] - 60.0
        shimmer = 0.025 * np.sin(2 * np.pi * 1760.0 * t_s3) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t_s3))
        left[s3_mask] += shimmer
        right[s3_mask] += shimmer * 0.8

        # S04 (85 - 120s): 1 Light-Day Gap transmission/reception pulse
        print("[*] Generating S04 1-light-day carrier & signal pulses...")
        s4_mask = (t >= 85.0) & (t < 120.0)
        t_s4 = t[s4_mask] - 85.0
        carrier = 0.035 * np.sin(2 * np.pi * 528.0 * t_s4)
        pulse_phase = (t_s4 % 6.0)
        pulse = 0.18 * np.exp(-pulse_phase / 0.8).astype(np.float32) * np.sin(2 * np.pi * 1056.0 * t_s4)
        left[s4_mask] += carrier + pulse * 0.95
        right[s4_mask] += carrier + pulse * 0.65

        # S05 (120 - 150s): Two places 24h phase beats
        print("[*] Generating S05 relative motion phase beats...")
        s5_mask = (t >= 120.0) & (t < 150.0)
        t_s5 = t[s5_mask] - 120.0
        f_earth = 110.0
        f_voyager = 110.0 + 1.2 * np.sin(2 * np.pi * 0.1 * t_s5)
        beat_earth = 0.08 * np.sin(2 * np.pi * f_earth * t_s5)
        beat_voyager = 0.08 * np.sin(2 * np.pi * f_voyager * t_s5)
        left[s5_mask] += beat_earth + 0.5 * beat_voyager
        right[s5_mask] += beat_voyager + 0.5 * beat_earth

        # S06 (150 - 175s): Dual clocks micro-ticks
        print("[*] Generating S06 dual clock ticking...")
        s6_mask = (t >= 150.0) & (t < 175.0)
        t_s6 = t[s6_mask] - 150.0
        tick1_phase = (t_s6 % 1.0)
        tick1 = 0.15 * np.exp(-tick1_phase / 0.03).astype(np.float32) * np.sin(2 * np.pi * 2000.0 * t_s6)
        tick2_phase = ((t_s6 + 0.000139 * 500) % 1.0)
        tick2 = 0.15 * np.exp(-tick2_phase / 0.03).astype(np.float32) * np.sin(2 * np.pi * 2500.0 * t_s6)
        left[s6_mask] += tick1 * 0.9
        right[s6_mask] += tick2 * 0.9

        # S07 (175 - 195s): Iowa PWS plasma waves sonification
        print("[*] Generating S07 PWS plasma wave frequencies...")
        s7_mask = (t >= 175.0) & (t < 195.0)
        t_s7 = t[s7_mask] - 175.0
        pws_f1 = 2200.0 + 800.0 * (t_s7 / 20.0) + 120.0 * np.sin(2 * np.pi * 1.5 * t_s7)
        pws_f2 = 2800.0 + 400.0 * (t_s7 / 20.0) + 80.0 * np.cos(2 * np.pi * 2.1 * t_s7)
        pws_wave = 0.045 * np.sin(2 * np.pi * pws_f1 * t_s7) + 0.035 * np.sin(2 * np.pi * pws_f2 * t_s7)
        noise = self.rng.normal(0, 0.015, size=np.count_nonzero(s7_mask)).astype(np.float32)
        left[s7_mask] += pws_wave + noise
        right[s7_mask] += pws_wave * 0.85 + noise

        # S08 (195 - 212s): Granular Poisson alpha-decay clicks
        print("[*] Generating S08 granular RTG decay soundscape...")
        s8_mask = (t >= 195.0) & (t < 212.0)
        n_s8 = np.count_nonzero(s8_mask)
        decay_events = self.rng.poisson(lam=0.08, size=n_s8)
        clicks = np.where(decay_events > 0, 0.25 * self.rng.uniform(-1, 1, size=n_s8), 0.0).astype(np.float32)
        t_s8 = t[s8_mask] - 195.0
        warmth = 0.07 * np.sin(2 * np.pi * 130.81 * t_s8) * (1.0 - np.exp(-t_s8 / 4.0))
        left[s8_mask] += clicks + warmth
        right[s8_mask] += clicks * 0.9 + warmth

        # S09 (212 - 225s): Resolution & peaceful fade
        print("[*] Generating S09 resolution & concluding motif...")
        s9_mask = (t >= 212.0)
        t_s9 = t[s9_mask] - 212.0
        fade_env = np.clip((13.0 - t_s9) / 4.0, 0.0, 1.0).astype(np.float32)
        final_chime = 0.12 * np.sin(2 * np.pi * 440.0 * t_s9) * np.exp(-t_s9 / 4.5).astype(np.float32)
        left[s9_mask] = (left[s9_mask] + final_chime) * fade_env
        right[s9_mask] = (right[s9_mask] + final_chime) * fade_env

        # Match the audio envelope to the video fade at both story boundaries.
        fade_in_env = np.clip(t / self.fade_in_s, 0.0, 1.0) if self.fade_in_s else 1.0
        fade_out_env = np.clip((self.content_duration_s - t) / self.fade_out_s, 0.0, 1.0) if self.fade_out_s else 1.0
        presentation_env = np.minimum(fade_in_env, fade_out_env)
        left *= presentation_env
        right *= presentation_env

        # Master limiter & normalization to avoid clipping (-0.95 to +0.95 peak)
        peak = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-4)
        if peak > 0.95:
            norm_factor = 0.95 / peak
            left *= norm_factor
            right *= norm_factor

        story_audio = np.stack([left, right], axis=0)
        lead_in_samples = int(self.sr * self.lead_in_s)
        lead_out_samples = int(self.sr * self.lead_out_s)
        return np.pad(story_audio, ((0, 0), (lead_in_samples, lead_out_samples)))

    def export_wav(self, out_path: str = "output/audio/mix.wav"):
        """Synthesize and write 16-bit PCM stereo WAV file."""
        p = Path(out_path)
        p.parent.mkdir(parents=True, exist_ok=True)

        audio_data = self.render()
        left = (np.clip(audio_data[0], -1.0, 1.0) * 32767).astype(np.int16)
        right = (np.clip(audio_data[1], -1.0, 1.0) * 32767).astype(np.int16)

        interleaved = np.empty((self.n_samples * 2,), dtype=np.int16)
        interleaved[0::2] = left
        interleaved[1::2] = right

        print(f"[*] Writing {self.duration_s}s audio file to {p}...")
        with wave.open(str(p), "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(self.sr)
            wf.writeframes(interleaved.tobytes())
        print(f"[+] Audio mix saved successfully! Size: {p.stat().st_size / (1024*1024):.2f} MB")


if __name__ == "__main__":
    config_path = Path(__file__).resolve().parent.parent / "config" / "film.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    presentation = config.get("presentation", {})
    composer = AudioComposer(
        sample_rate=int(config.get("audio_hz", 48000)),
        content_duration_s=float(config.get("content_duration_s", 225.0)),
        lead_in_s=float(presentation.get("lead_in_black_s", 5.0)),
        lead_out_s=float(presentation.get("lead_out_black_s", 5.0)),
        fade_in_s=float(presentation.get("fade_in_s", 1.0)),
        fade_out_s=float(presentation.get("fade_out_s", 1.0)),
        seed=int(config.get("seed", 19770905)),
    )
    composer.export_wav()
