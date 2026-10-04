"""JPL Horizons Ephemeris Fetcher for VOYAGER 1 — LIGHT DAY GAP.

Adheres strictly to the specification:
- Origin: Solar System Barycenter (SSB, '500@0')
- Frame: ICRF ('REF_PLANE'='FRAME', 'REF_SYSTEM'='ICRF')
- Time Scale: TDB
- Units: km, km/s ('OUT_UNITS'='KM-S')
- Aberration correction: NONE ('VEC_CORR'='NONE')
- Target IDs:
    Voyager 1: '-31'
    Earth Center: '399'
    Sun: '10'
    Jupiter Center: '599'
    Saturn Center: '699'
"""

import csv
import hashlib
import io
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"


def fetch_vectors(target, start_tdb, stop_tdb, step="1 h", out_dir="data/raw", label=None):
    """Fetch state vectors from Horizons API, saving raw json, csv, and meta."""
    params = {
        "format": "json",
        "COMMAND": f"'{target}'",
        "OBJ_DATA": "'YES'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'VECTORS'",
        "CENTER": "'500@0'",
        "REF_SYSTEM": "'ICRF'",
        "REF_PLANE": "'FRAME'",
        "OUT_UNITS": "'KM-S'",
        "VEC_CORR": "'NONE'",
        "VEC_TABLE": "'2'",
        "CSV_FORMAT": "'YES'",
        "TIME_TYPE": "'TDB'",
        "TIME_DIGITS": "'FRACSEC'",
        "START_TIME": f"'{start_tdb}'",
        "STOP_TIME": f"'{stop_tdb}'",
        "STEP_SIZE": f"'{step}'",
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    print(f"[*] Fetching target={target} ({label or ''}) from {start_tdb} to {stop_tdb} (step={step})...")

    req = urllib.request.Request(url, headers={"User-Agent": "Voyager1-LightDayGap/1.0"})
    with urllib.request.urlopen(req, timeout=120) as response:
        raw = response.read()

    root = Path(out_dir)
    root.mkdir(parents=True, exist_ok=True)

    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode("utf-8")).hexdigest()[:12]
    tag = f"{label}_{target}_{key}" if label else f"{target}_{key}"
    stem = root / tag

    stem.with_suffix(".response.json").write_bytes(raw)
    data = json.loads(raw.decode("utf-8", errors="replace"))
    result = data.get("result", "")

    if data.get("error") or "$$SOE" not in result or "$$EOE" not in result:
        err_msg = data.get("error") or result[:1200] or "Missing vector data block in response"
        raise RuntimeError(f"Horizons API error for target {target}: {err_msg}")

    block = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    parsed = []
    for row in csv.reader(io.StringIO(block)):
        if not row or not row[0].strip():
            continue
        # Expected row format in VEC_TABLE=2:
        # row[0]: JDTDB, row[1]: Calendar Date, row[2]: X, row[3]: Y, row[4]: Z, row[5]: VX, row[6]: VY, row[7]: VZ
        if len(row) < 8:
            continue
        try:
            jd = float(row[0])
            coords = [float(x.replace("D", "E")) for x in row[2:8]]
            parsed.append([jd] + coords)
        except ValueError:
            continue

    if len(parsed) < 2:
        raise ValueError(f"Too few valid rows parsed ({len(parsed)}) for target {target}")

    csv_path = stem.with_suffix(".csv")
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["jd_tdb", "x_km", "y_km", "z_km", "vx_km_s", "vy_km_s", "vz_km_s"])
        writer.writerows(parsed)

    meta = {
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "target": target,
        "label": label,
        "parameters": params,
        "source_url": url,
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "response_header": result.split("$$SOE", 1)[0].strip(),
        "rows": len(parsed),
        "jd_start": parsed[0][0],
        "jd_end": parsed[-1][0],
        "note": "Ephemeris in SSB / ICRF / TDB with VEC_CORR=NONE"
    }
    stem.with_suffix(".meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"    -> Saved {len(parsed)} rows to {csv_path}")
    return csv_path


def main():
    """Fetch the essential datasets needed for 1-light-day calculations and 1977-2026 trajectory."""
    raw_dir = Path("data/raw")
    processed_dir = Path("data/processed")
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    print("=== JPL Horizons Data Acquisition ===")

    # 1. 2026 1-Light-Day Event Window (High Density: 1 hour steps, Nov 10 to Nov 25, 2026)
    # Voyager 1 (-31), Earth (399), Sun (10)
    v1_2026 = fetch_vectors("-31", "2026-11-10", "2026-11-26", step="1 h", label="event_voyager1")
    earth_2026 = fetch_vectors("399", "2026-11-09", "2026-11-26", step="1 h", label="event_earth")
    sun_2026 = fetch_vectors("10", "2026-11-09", "2026-11-26", step="1 h", label="event_sun")

    # 2. Complete Mission Trajectory (1977-09-06 to 2026-12-01, step = 10 days)
    # Voyager 1 ephemeris starts 1977-Sep-05 14:00 TDB.
    v1_full = fetch_vectors("-31", "1977-09-06", "2026-12-01", step="10 d", label="traj_voyager1")
    earth_full = fetch_vectors("399", "1977-09-06", "2026-12-01", step="10 d", label="traj_earth")
    sun_full = fetch_vectors("10", "1977-09-06", "2026-12-01", step="10 d", label="traj_sun")

    # 3. Planetary Flyby Contexts (Jupiter March 1979, Saturn Nov 1980)
    jupiter_1979 = fetch_vectors("599", "1979-02-25", "1979-03-15", step="6 h", label="flyby_jupiter")
    saturn_1980 = fetch_vectors("699", "1980-11-05", "1980-11-20", step="6 h", label="flyby_saturn")

    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "datasets": {
            "event_voyager1": str(v1_2026),
            "event_earth": str(earth_2026),
            "event_sun": str(sun_2026),
            "traj_voyager1": str(v1_full),
            "traj_earth": str(earth_full),
            "traj_sun": str(sun_full),
            "flyby_jupiter": str(jupiter_1979),
            "flyby_saturn": str(saturn_1980),
        }
    }
    manifest_path = Path("data/data_manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Manifest written to {manifest_path}")
    print("All acquisitions completed successfully!")


if __name__ == "__main__":
    main()
