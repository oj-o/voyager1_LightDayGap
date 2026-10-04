import json
import sys
from pathlib import Path
import numpy as np

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ephemeris import Ephemeris, utc_to_tdb_s, tdb_s_to_utc_iso
from src.physics import (
    geometric, reception, transmission, first_light_day_crossing,
    sr_coordinate_lag, weak_field_rate_difference, angular_diameter_arcsec,
    doppler_shift_ppm, LIGHT_DAY_KM, C, DAY, EARTH_RADIUS_KM, SUN_RADIUS_KM, AU_KM
)

def main():
    # Load ephemerides
    manifest = json.loads(Path("data/data_manifest.json").read_text(encoding="utf-8"))
    v1 = Ephemeris.from_csv(manifest["datasets"]["event_voyager1"])
    earth = Ephemeris.from_csv(manifest["datasets"]["event_earth"])
    sun = Ephemeris.from_csv(manifest["datasets"]["event_sun"])

    anchor_utc = "2026-11-18T10:16:07"
    anchor_tdb = utc_to_tdb_s(anchor_utc)
    print(f"=== VOYAGER 1 LIGHT DAY GAP: VERIFICATION ===")
    print(f"NASA Anchor UTC: {anchor_utc} -> TDB seconds: {anchor_tdb:.3f}")

    # 1. Geometric state at anchor
    geom = geometric(anchor_tdb, earth, v1)
    dist = geom["distance_km"]
    rr = geom["range_rate_km_s"]
    lt_geom = geom["geometric_light_time_s"]
    print(f"1. Geometric State at Anchor:")
    print(f"   - Distance: {dist:,.3f} km ({dist/AU_KM:.4f} AU)")
    print(f"   - 1 Light-Day definition: {LIGHT_DAY_KM:,.3f} km")
    print(f"   - Residual vs 1 Light-Day: {dist - LIGHT_DAY_KM:+,.3f} km")
    print(f"   - Line-of-sight range rate: {rr:+.4f} km/s")
    print(f"   - Geometric light-time: {lt_geom:,.3f} s ({lt_geom/3600:.4f} h)")

    # Sun distances
    sun_v1 = geometric(anchor_tdb, sun, v1)
    sun_earth = geometric(anchor_tdb, sun, earth)
    print(f"   - Sun-Voyager 1 Distance: {sun_v1['distance_km']:,.3f} km ({sun_v1['distance_km']/AU_KM:.4f} AU)")
    print(f"   - Sun-Earth Distance: {sun_earth['distance_km']:,.3f} km ({sun_earth['distance_km']/AU_KM:.4f} AU)")

    # 2. Exact 1 Light-Day Crossing
    cross_t, cross_geom = first_light_day_crossing(earth, v1, v1.start_time, v1.end_time)
    cross_utc = tdb_s_to_utc_iso(cross_t)
    print(f"\n2. Geometric 1 Light-Day Crossing (D(t) = c * 86400s):")
    print(f"   - Crossing UTC: {cross_utc}")
    print(f"   - Crossing TDB s: {cross_t:.3f}")
    print(f"   - Distance at crossing: {cross_geom['distance_km']:,.3f} km")
    print(f"   - Range rate at crossing: {cross_geom['range_rate_km_s']:+.4f} km/s")
    time_diff_hours = (cross_t - anchor_tdb) / 3600.0
    print(f"   - Offset from NASA anchor: {time_diff_hours:+.3f} hours ({(cross_t - anchor_tdb)/60:+.2f} minutes)")

    # 3. Reception light-time: Earth -> Voyager
    rec = reception(anchor_tdb, earth, v1)
    emit_utc = tdb_s_to_utc_iso(rec["emission_tdb_s"])
    print(f"\n3. Reception Event at Voyager (Observer at anchor {anchor_utc}):")
    print(f"   - Light emitted at Earth: {emit_utc} UTC")
    print(f"   - Light travel time: {rec['delay_s']:,.3f} s ({rec['delay_s']/3600:.4f} h)")
    print(f"   - Vector norm: {float(np.linalg.norm(rec['vector_to_emitter_km'])):,.3f} km")

    # 4. Transmission light-time: Earth -> Voyager (Pulse emitted at anchor)
    trans = transmission(anchor_tdb, earth, v1)
    rec_utc = tdb_s_to_utc_iso(trans["receive_tdb_s"])
    print(f"\n4. Outbound Pulse from Earth (Emitted at anchor {anchor_utc}):")
    print(f"   - Pulse arrives at Voyager: {rec_utc} UTC")
    print(f"   - Light travel time: {trans['delay_s']:,.3f} s ({trans['delay_s']/3600:.4f} h)")

    # 5. Round trip
    inbound = transmission(trans["receive_tdb_s"], v1, earth)
    inbound_utc = tdb_s_to_utc_iso(inbound["receive_tdb_s"])
    round_trip_s = inbound["receive_tdb_s"] - anchor_tdb
    print(f"\n5. Instant Round-Trip (Earth -> Voyager -> Earth):")
    print(f"   - Echo received at Earth: {inbound_utc} UTC")
    print(f"   - Total round-trip light time: {round_trip_s:,.3f} s ({round_trip_s/3600:.4f} h, {round_trip_s/DAY:.4f} days)")

    # 6. Relativistic Effects
    _, vv = v1.state(anchor_tdb)
    _, ve = earth.state(anchor_tdb)
    v_v_speed = float(np.linalg.norm(vv))
    v_e_speed = float(np.linalg.norm(ve))
    sr_lag_17 = sr_coordinate_lag(DAY, 17.0)
    sr_lag_v1 = sr_coordinate_lag(DAY, v_v_speed)
    gr_diff = weak_field_rate_difference(
        v_e_speed, v_v_speed,
        sun_earth["distance_km"], sun_v1["distance_km"]
    )
    print(f"\n6. Relativity Calculations:")
    print(f"   - Voyager 1 SSB Speed: {v_v_speed:.4f} km/s (spec nominal 17 km/s)")
    print(f"   - Earth SSB Speed: {v_e_speed:.4f} km/s (spec nominal 29.78 km/s)")
    print(f"   - Special Relativity Coordinate Lag (17 km/s nominal): {sr_lag_17 * 1e6:.2f} μs / day (spec: ~139 μs/day)")
    print(f"   - Special Relativity Coordinate Lag (actual {v_v_speed:.2f} km/s): {sr_lag_v1 * 1e6:.2f} μs / day")
    print(f"   - General Relativity Rate Difference: {gr_diff * DAY * 1e3:+.3f} ms / day (spec model: ~ +1.14 ms/day)")

    # 7. Angular diameter
    ang_e = angular_diameter_arcsec(EARTH_RADIUS_KM, dist)
    ang_s = angular_diameter_arcsec(SUN_RADIUS_KM, sun_v1["distance_km"])
    print(f"\n7. Apparent Sizes:")
    print(f"   - Earth Angular Diameter from Voyager: {ang_e:.6f} arcsec (spec: ~0.1015 arcsec)")
    print(f"   - Sun Angular Diameter from Voyager: {ang_s:.4f} arcsec (spec: ~11 arcsec)")

    # 8. Save computed values to summary json
    summary = {
        "anchor_utc": anchor_utc,
        "anchor_tdb_s": anchor_tdb,
        "geometric_distance_at_anchor_km": dist,
        "range_rate_at_anchor_km_s": rr,
        "geometric_crossing_utc": cross_utc,
        "geometric_crossing_tdb_s": cross_t,
        "reception_emission_utc": emit_utc,
        "reception_delay_s": rec["delay_s"],
        "transmission_receive_utc": rec_utc,
        "transmission_delay_s": trans["delay_s"],
        "round_trip_s": round_trip_s,
        "voyager_speed_km_s": v_v_speed,
        "earth_speed_km_s": v_e_speed,
        "sr_lag_17_us_day": sr_lag_17 * 1e6,
        "sr_lag_actual_us_day": sr_lag_v1 * 1e6,
        "gr_diff_ms_day": gr_diff * DAY * 1e3,
        "earth_angular_diameter_arcsec": ang_e,
        "sun_angular_diameter_arcsec": ang_s
    }
    out_path = Path("data/processed/physics_verification.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nSummary successfully saved to {out_path}")

if __name__ == "__main__":
    main()
