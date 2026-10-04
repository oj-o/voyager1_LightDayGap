"""Core physical calculations for VOYAGER 1 — LIGHT DAY GAP.

Compliant with specification sections 4, 5, 8, 9, 14:
- Vacuum speed of light c = 299,792.458 km/s
- 1 Light-Day = c * 86,400 s = 25,902,068,371.2 km
- Geometric distance and range-rate (radial speed)
- Flat-space iterated light-time solver for reception and transmission
- 1 light-day crossing bisection root finder
- Special relativity coordinate time lag vs rest clock
- Weak-field General Relativity rate difference (Sun potential + velocity)
- Angular diameter and Doppler shift calculations
- RTG exponential decay model (Pu-238, 88 yr half-life)
"""

import numpy as np

C = 299792.458
DAY = 86400.0
LIGHT_DAY_KM = C * DAY
AU_KM = 149597870.7
GM_SUN = 1.32712440042e11
EARTH_RADIUS_KM = 6371.0
SUN_RADIUS_KM = 695700.0
PLANCK_H = 6.62607015e-34
ELECTRON_VOLT_J = 1.602176634e-19
RTG_HALF_LIFE_YEARS = 88.0
NOMINAL_RF_CARRIER_HZ = 8.4e9


def geometric(t: float, earth, voyager):
    """Compute geometric (same-epoch) distance, range-rate, and geometric light time."""
    pe, ve = earth.state(t)
    pv, vv = voyager.state(t)
    d = pv - pe
    distance = float(np.linalg.norm(d))
    if distance == 0:
        raise ValueError("Coincident endpoints in geometric calculation.")
    radial_speed = float(np.dot(d / distance, vv - ve))
    return {
        "distance_km": distance,
        "range_rate_km_s": radial_speed,
        "geometric_light_time_s": distance / C,
        "relative_position_km": d,
        "earth_pos": pe,
        "voyager_pos": pv,
    }


def reception(t_receive: float, emitter, observer, tolerance_s: float = 1e-7, max_iter: int = 50):
    """Solve for the past emission event whose light reaches observer at t_receive.

    t_receive - t_emit = |r_observer(t_receive) - r_emitter(t_emit)| / c
    Observer is at t_receive, emitter is evaluated in the past (t_receive - delay).
    """
    po, vo = observer.state(t_receive)
    # Initial estimate of delay using instantaneous position
    pe0, _ = emitter.state(t_receive)
    delay = float(np.linalg.norm(pe0 - po) / C)

    for _ in range(max_iter):
        t_emit = t_receive - delay
        pe, ve = emitter.state(t_emit)
        new_delay = float(np.linalg.norm(pe - po) / C)
        if abs(new_delay - delay) < tolerance_s:
            vec_to_emitter = pe - po
            return {
                "emission_tdb_s": t_emit,
                "delay_s": new_delay,
                "vector_to_emitter_km": vec_to_emitter,
                "emitter_pos_at_emit": pe,
                "observer_pos_at_receive": po,
                "residual_s": abs(new_delay - delay),
            }
        delay = new_delay

    raise RuntimeError(f"Reception light-time solver did not converge within {max_iter} iterations.")


def transmission(t_emit: float, emitter, receiver, tolerance_s: float = 1e-7, max_iter: int = 50):
    """Solve for future reception event for a pulse sent by emitter at t_emit.

    t_receive - t_emit = |r_receiver(t_receive) - r_emitter(t_emit)| / c
    Emitter is at t_emit, receiver is evaluated in the future (t_emit + delay).
    """
    pe, ve = emitter.state(t_emit)
    pr0, _ = receiver.state(t_emit)
    delay = float(np.linalg.norm(pr0 - pe) / C)

    for _ in range(max_iter):
        t_recv = t_emit + delay
        pr, vr = receiver.state(t_recv)
        new_delay = float(np.linalg.norm(pr - pe) / C)
        if abs(new_delay - delay) < tolerance_s:
            return {
                "receive_tdb_s": t_recv,
                "delay_s": new_delay,
                "vector_to_receiver_km": pr - pe,
                "receiver_pos_at_receive": pr,
                "emitter_pos_at_emit": pe,
                "residual_s": abs(new_delay - delay),
            }
        delay = new_delay

    raise RuntimeError(f"Transmission light-time solver did not converge within {max_iter} iterations.")


def first_light_day_crossing(earth, voyager, start_t: float, stop_t: float, step_s: float = 3600.0, tol_s: float = 0.01):
    """Find the exact epoch where geometric distance crosses 1 light-day (c * 86400 km).

    Uses coarse stepping to find below-to-above sign change, followed by bisection.
    """
    def residual(t):
        return geometric(t, earth, voyager)["distance_km"] - LIGHT_DAY_KM

    a = float(start_t)
    fa = residual(a)

    while a < stop_t:
        b = min(a + step_s, stop_t)
        fb = residual(b)
        if fa < 0.0 and fb >= 0.0:
            lo, hi = a, b
            while (hi - lo) > tol_s:
                mid = 0.5 * (lo + hi)
                if residual(mid) < 0.0:
                    lo = mid
                else:
                    hi = mid
            crossing_t = 0.5 * (lo + hi)
            return crossing_t, geometric(crossing_t, earth, voyager)
        a, fa = b, fb

    raise ValueError(f"No 1 light-day crossing found in interval [{start_t}, {stop_t}].")


def sr_coordinate_lag(dt_s: float, speed_km_s: float) -> float:
    """Special relativistic clock lag compared to an observer at rest in the inertial frame.

    dt - dtau = dt * (1 - sqrt(1 - beta^2)) = dt * beta^2 / (1 + sqrt(1 - beta^2))
    """
    beta2 = (speed_km_s / C) ** 2
    if not (0.0 <= beta2 < 1.0):
        raise ValueError(f"Speed must be subluminal, got {speed_km_s} km/s")
    return float(dt_s * beta2 / (1.0 + np.sqrt(1.0 - beta2)))


def weak_field_rate_difference(v_e: float, v_v: float, r_e: float, r_v: float, gm_sun: float = GM_SUN) -> float:
    """Approximate fractional rate difference (Voyager rate - Earth rate) in weak-field GR.

    dtau/dt ≈ 1 + Phi/c^2 - v^2/(2c^2), where Phi = -GM/r.
    (dtau_v - dtau_e) / dt ≈ [Phi_v - Phi_e - (v_v^2 - v_e^2)/2] / c^2.
    """
    phi_e = -gm_sun / r_e
    phi_v = -gm_sun / r_v
    delta_rate = (phi_v - phi_e - 0.5 * (v_v**2 - v_e**2)) / (C**2)
    return float(delta_rate)


def angular_diameter_arcsec(radius_km: float, distance_km: float) -> float:
    """Compute apparent angular diameter in arcseconds: 2 * arctan(R / D)."""
    rad = 2.0 * np.arctan(radius_km / distance_km)
    return float(rad * (180.0 * 3600.0 / np.pi))


def doppler_shift_ppm(range_rate_km_s: float) -> float:
    """Fractional Doppler frequency shift in ppm for recession speed v_r << c: -v_r / c."""
    return float(-range_rate_km_s / C * 1e6)


def rtg_power_fraction(elapsed_years: float, half_life_years: float = RTG_HALF_LIFE_YEARS) -> float:
    """Normalized thermal output fraction from Pu-238 decay: 2^(-t / T_half)."""
    return float(2.0 ** (-elapsed_years / half_life_years))


def rf_photon_energy_ev(freq_hz: float = NOMINAL_RF_CARRIER_HZ) -> float:
    """Photon energy E = h * f in electron-volts."""
    return float((PLANCK_H * freq_hz) / ELECTRON_VOLT_J)
