"""Prepare and downsample trajectory data for offline rendering and web preview.

Exports:
- data/processed/trajectory_1977_2026.json (downsampled trajectory with milestones)
- data/processed/event_2026_data.json (hourly state around 1-light-day event)
"""

import json
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ephemeris import Ephemeris, utc_to_tdb_s, tdb_s_to_utc_iso
from src.physics import (
    geometric, reception, transmission, AU_KM, C, DAY, LIGHT_DAY_KM,
    sr_coordinate_lag, weak_field_rate_difference, angular_diameter_arcsec
)

# ICRF to J2000 Ecliptic rotation matrix (obliquity eps = 23.43929111 deg)
EPS = np.radians(23.43929111)
R_ICRF_TO_ECLIPTIC = np.array([
    [1.0, 0.0, 0.0],
    [0.0, np.cos(EPS), np.sin(EPS)],
    [0.0, -np.sin(EPS), np.cos(EPS)]
])

def icrf_to_ecliptic(pos_km):
    pos = np.asarray(pos_km, dtype=np.float64)
    return np.dot(R_ICRF_TO_ECLIPTIC, pos)

def main():
    manifest = json.loads(Path("data/data_manifest.json").read_text(encoding="utf-8"))
    v1_full = Ephemeris.from_csv(manifest["datasets"]["traj_voyager1"])
    earth_full = Ephemeris.from_csv(manifest["datasets"]["traj_earth"])
    sun_full = Ephemeris.from_csv(manifest["datasets"]["traj_sun"])

    v1_event = Ephemeris.from_csv(manifest["datasets"]["event_voyager1"])
    earth_event = Ephemeris.from_csv(manifest["datasets"]["event_earth"])
    sun_event = Ephemeris.from_csv(manifest["datasets"]["event_sun"])

    print("Building processed trajectory data...")

    # Key historical milestones (UTC)
    milestones = [
        {"utc": "1977-09-06T00:00:00", "label": "1977 발사 (지구 이탈)", "key": "launch"},
        {"utc": "1979-03-05T12:00:00", "label": "1979 목성 최근접 통과", "key": "jupiter"},
        {"utc": "1980-11-12T23:46:00", "label": "1980 토성 통과 (황도면 이탈)", "key": "saturn"},
        {"utc": "1990-02-14T05:00:00", "label": "1990 창백한 푸른 점", "key": "pale_blue_dot"},
        {"utc": "2012-08-25T00:00:00", "label": "2012 태양권계면 통과 (성간 진입)", "key": "heliopause"},
        {"utc": "2026-11-18T10:16:07", "label": "2026 1광일 도달 (예상)", "key": "light_day"}
    ]

    for m in milestones:
        t_tdb = utc_to_tdb_s(m["utc"])
        pv, vv = v1_full.state(t_tdb)
        ps, _ = sun_full.state(t_tdb)
        pe, _ = earth_full.state(t_tdb)

        r_helio = pv - ps
        dist_sun_au = float(np.linalg.norm(r_helio) / AU_KM)
        dist_earth_km = float(np.linalg.norm(pv - pe))
        dist_earth_au = dist_earth_km / AU_KM
        ecl_pos = icrf_to_ecliptic(r_helio)

        m.update({
            "tdb_s": t_tdb,
            "r_helio_icrf_km": r_helio.tolist(),
            "r_helio_ecliptic_km": ecl_pos.tolist(),
            "dist_sun_au": dist_sun_au,
            "dist_earth_km": dist_earth_km,
            "dist_earth_au": dist_earth_au,
            "light_time_hours": dist_earth_km / C / 3600.0,
            "velocity_km_s": float(np.linalg.norm(vv))
        })

    # Subsample full trajectory (every 30 days) for smooth path drawing
    t_start = v1_full.start_time
    t_end = v1_full.end_time
    t_samples = np.linspace(t_start, t_end, 600)
    samples = []

    for t in t_samples:
        pv, vv = v1_full.state(t)
        ps, _ = sun_full.state(t)
        pe, _ = earth_full.state(t)
        r_helio = pv - ps
        r_earth_helio = pe - ps
        ecl_v1 = icrf_to_ecliptic(r_helio)
        ecl_earth = icrf_to_ecliptic(r_earth_helio)

        samples.append({
            "t_tdb_s": float(t),
            "utc": tdb_s_to_utc_iso(t),
            "v1_ecliptic_au": (ecl_v1 / AU_KM).tolist(),
            "earth_ecliptic_au": (ecl_earth / AU_KM).tolist(),
            "dist_sun_au": float(np.linalg.norm(r_helio) / AU_KM),
            "dist_earth_au": float(np.linalg.norm(pv - pe) / AU_KM),
            "speed_km_s": float(np.linalg.norm(vv))
        })

    traj_data = {
        "milestones": milestones,
        "samples": samples,
        "meta": {
            "origin": "Sun (Heliocentric for orbit view)",
            "frame": "J2000 Ecliptic",
            "ephemeris_origin": "SSB / ICRF / TDB (JPL Horizons)",
            "count": len(samples)
        }
    }
    out_traj = Path("data/processed/trajectory_1977_2026.json")
    out_traj.write_text(json.dumps(traj_data, indent=2), encoding="utf-8")
    print(f"Saved {len(samples)} trajectory samples and {len(milestones)} milestones to {out_traj}")

    # Process 2026 1-light-day window (hourly samples from Nov 10 to Nov 25, 2026)
    event_samples = []
    t_evt_start = v1_event.start_time
    t_evt_end = v1_event.end_time
    t_evt_steps = np.arange(t_evt_start, t_evt_end, 3600.0)

    for t in t_evt_steps:
        geom = geometric(t, earth_event, v1_event)
        rec = reception(t, earth_event, v1_event)
        sun_v1 = geometric(t, sun_event, v1_event)

        event_samples.append({
            "t_tdb_s": float(t),
            "utc": tdb_s_to_utc_iso(t),
            "dist_km": geom["distance_km"],
            "dist_au": geom["distance_km"] / AU_KM,
            "dist_residual_km": geom["distance_km"] - LIGHT_DAY_KM,
            "range_rate_km_s": geom["range_rate_km_s"],
            "geom_light_time_s": geom["geometric_light_time_s"],
            "reception_delay_s": rec["delay_s"],
            "emission_utc": tdb_s_to_utc_iso(rec["emission_tdb_s"]),
            "sun_dist_au": sun_v1["distance_km"] / AU_KM
        })

    event_data = {
        "event_samples": event_samples,
        "meta": {
            "window": "2026-11-10 to 2026-11-25 TDB hourly",
            "count": len(event_samples),
            "crossing_def": "D(t) = 25,902,068,371.2 km"
        }
    }
    out_evt = Path("data/processed/event_2026_data.json")
    out_evt.write_text(json.dumps(event_data, indent=2), encoding="utf-8")
    print(f"Saved {len(event_samples)} hourly event samples to {out_evt}")

if __name__ == "__main__":
    main()
