"""Ephemeris interpolation and time conversions.

Compliant with specification:
- Origin: SSB
- Frame: ICRF
- Time Scale: TDB seconds from J2000.0 (JD 2451545.0)
- Cubic Hermite interpolation using position and velocity
- Strict bounds checking (no extrapolation beyond data)
- Astropy Time for UTC <-> TDB conversion
"""

import csv
from pathlib import Path
from astropy.time import Time
import numpy as np

DAY = 86400.0
JD0 = 2451545.0


def utc_to_tdb_s(utc_iso: str) -> float:
    """Convert ISO UTC string to TDB seconds relative to J2000.0 (JD 2451545.0)."""
    t = Time(utc_iso, format="isot", scale="utc")
    return float((t.tdb.jd - JD0) * DAY)


def tdb_s_to_utc_iso(tdb_s: float) -> str:
    """Convert TDB seconds relative to J2000.0 to ISO UTC string."""
    jd_tdb = JD0 + tdb_s / DAY
    t = Time(jd_tdb, format="jd", scale="tdb")
    return str(t.utc.isot)


class Ephemeris:
    """Cubic Hermite state evaluator.

    Interpolates positions and velocities using cubic Hermite splines.
    No extrapolation is permitted beyond the supplied epochs.
    """

    def __init__(self, t, positions, velocities):
        self.t = np.asarray(t, dtype=np.float64)
        self.p = np.asarray(positions, dtype=np.float64)
        self.v = np.asarray(velocities, dtype=np.float64)

        if self.t.ndim != 1 or len(self.t) < 2:
            raise ValueError("At least two epochs are required for ephemeris interpolation.")
        if self.p.shape != (len(self.t), 3) or self.v.shape != self.p.shape:
            raise ValueError(f"Expected N by 3 state arrays, got p={self.p.shape}, v={self.v.shape}")
        if not (np.all(np.isfinite(self.t)) and np.all(np.isfinite(self.p)) and np.all(np.isfinite(self.v))):
            raise ValueError("Non-finite state or time values found in ephemeris data.")
        if np.any(np.diff(self.t) <= 0):
            raise ValueError("Epochs must increase strictly monotonically.")

    @classmethod
    def from_csv(cls, path):
        """Load state vectors from Horizons CSV (jd_tdb, x_km, y_km, z_km, vx_km_s, vy_km_s, vz_km_s)."""
        csv_path = Path(path)
        if not csv_path.exists():
            raise FileNotFoundError(f"Ephemeris file not found: {csv_path}")

        with csv_path.open(encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))

        if not rows:
            raise ValueError(f"Empty ephemeris CSV: {csv_path}")

        t = [(float(r["jd_tdb"]) - JD0) * DAY for r in rows]
        p = [[float(r["x_km"]), float(r["y_km"]), float(r["z_km"])] for r in rows]
        v = [[float(r["vx_km_s"]), float(r["vy_km_s"]), float(r["vz_km_s"])] for r in rows]
        return cls(t, p, v)

    @property
    def start_time(self) -> float:
        return float(self.t[0])

    @property
    def end_time(self) -> float:
        return float(self.t[-1])

    def state(self, t: float):
        """Evaluate position [km] and velocity [km/s] at time t [TDB seconds from J2000.0]."""
        t = float(t)
        if not (self.t[0] <= t <= self.t[-1]):
            raise ValueError(
                f"Epoch t={t:.3f} s is outside coverage [{self.t[0]:.3f}, {self.t[-1]:.3f}]. "
                "Fetch a wider interval; no extrapolation allowed."
            )

        # Binary search for interval
        i = min(int(np.searchsorted(self.t, t, side="right") - 1), len(self.t) - 2)
        i = max(0, i)

        h = self.t[i + 1] - self.t[i]
        u = (t - self.t[i]) / h

        p0, p1 = self.p[i], self.p[i + 1]
        v0, v1 = self.v[i], self.v[i + 1]

        # Cubic Hermite basis functions
        # p(u) = (2u^3 - 3u^2 + 1)p0 + (u^3 - 2u^2 + u)h v0 + (-2u^3 + 3u^2)p1 + (u^3 - u^2)h v1
        h00 = 2 * u**3 - 3 * u**2 + 1
        h10 = u**3 - 2 * u**2 + u
        h01 = -2 * u**3 + 3 * u**2
        h11 = u**3 - u**2

        p = h00 * p0 + h10 * h * v0 + h01 * p1 + h11 * h * v1

        # Derivative: v(u) = dp/dt = (1/h) dp/du
        dh00 = (6 * u**2 - 6 * u) / h
        dh10 = 3 * u**2 - 4 * u + 1
        dh01 = (-6 * u**2 + 6 * u) / h
        dh11 = 3 * u**2 - 2 * u

        v = dh00 * p0 + dh10 * v0 + dh01 * p1 + dh11 * v1
        return p, v
