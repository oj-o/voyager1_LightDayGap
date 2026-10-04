"""Camera and projection models for VOYAGER 1 — LIGHT DAY GAP.

Compliant with specification sections 3, 10.5, 10.6, 10.7:
- Distinguishes physical size, render radius, and UI marker radius
- Logarithmic distance compression for wide-scale orbital maps:
    r_display = (r / |r|) * L0 * ln(1 + |r| / L0)
- Virtual observer at Voyager looking towards Earth with light-time retardation:
    Target direction = r_Earth(t_emit) - r_Voyager(t_receive)
- Planetarium Fulldome (Dome Screen) Fisheye Projector for 1:1 circular domemaster format.
- Separate floating origin to maintain float32 GPU / image precision.
"""

import math
from typing import Tuple, Optional
import numpy as np


def log_compress(pos_vec, scale_l0: float = 1.0):
    """Logarithmic radial compression for celestial distance visualization.

    pos_vec can be in AU or km.
    r_display = (r / |r|) * L0 * ln(1 + |r| / L0)
    """
    v = np.asarray(pos_vec, dtype=np.float64)
    norm = np.linalg.norm(v)
    if norm < 1e-12:
        return np.zeros_like(v)
    comp_norm = scale_l0 * np.log1p(norm / scale_l0)
    return (v / norm) * comp_norm


class OrbitCamera2D:
    """Camera for 2D/pseudo-3D orbital trajectory views (e.g. S02, S04, S05)."""

    def __init__(self, center_x: float, center_y: float, scale_px_per_unit: float):
        self.cx = float(center_x)
        self.cy = float(center_y)
        self.scale = float(scale_px_per_unit)

    def to_screen(self, x: float, y: float) -> Tuple[float, float]:
        sx = self.cx + x * self.scale
        sy = self.cy - y * self.scale  # Invert Y for screen coordinates
        return float(sx), float(sy)


class VirtualVoyagerCamera:
    """Virtual camera situated at Voyager 1 looking back at the Sun and Earth.

    Uses the actual retarded emission vector r_Earth(t_emit) - r_Voyager(t_receive).
    Projects apparent celestial angles onto the screen.
    """

    def __init__(self, width: int, height: int, fov_deg: float = 2.5):
        self.width = width
        self.height = height
        self.fov_deg = fov_deg
        self.fov_rad = np.radians(fov_deg)

    def project_angles(self, azimuth_deg: float, elevation_deg: float) -> Tuple[float, float]:
        """Project relative sky angles (degrees from optical axis) onto screen pixels."""
        cx = self.width * 0.5
        cy = self.height * 0.5
        scale = (self.width * 0.5) / np.tan(self.fov_rad * 0.5)
        x_px = cx + np.tan(np.radians(azimuth_deg)) * scale
        y_px = cy - np.tan(np.radians(elevation_deg)) * scale
        return float(x_px), float(y_px)

    def look_vector_to_screen(self, target_vec_km, ref_forward_vec, ref_up_vec) -> Optional[Tuple[float, float]]:
        """Project a 3D line-of-sight vector onto virtual observer screen."""
        t_vec = target_vec_km / np.linalg.norm(target_vec_km)
        f_vec = ref_forward_vec / np.linalg.norm(ref_forward_vec)
        u_vec = ref_up_vec / np.linalg.norm(ref_up_vec)
        r_vec = np.cross(f_vec, u_vec)
        r_vec = r_vec / np.linalg.norm(r_vec)
        u_vec = np.cross(r_vec, f_vec)

        # Coordinates in camera frame: forward z, right x, up y
        z = np.dot(t_vec, f_vec)
        if z <= 0.05:  # Behind camera or too close to edge
            return None

        x = np.dot(t_vec, r_vec)
        y = np.dot(t_vec, u_vec)

        # Perspective projection
        tan_half = np.tan(self.fov_rad * 0.5)
        norm_x = (x / z) / tan_half
        norm_y = (y / z) / tan_half

        px = (norm_x * 0.5 + 0.5) * self.width
        py = (-norm_y * 0.5 + 0.5) * self.height
        return float(px), float(py)


class DomeFisheyeProjector:
    """Fulldome / Planetarium hemispherical fisheye projector.

    Standard Domemaster equidistant projection:
    - Center (cx, cy) corresponds to the Zenith (top of dome, altitude = 90 deg)
    - Outer boundary r = R corresponds to the Horizon (rim of dome, altitude = 0 deg)
    - Azimuth phi maps to polar angle around center.
    - Preserves angular distance from zenith linearly: r = R * (90 - alt_deg) / 90.
    """

    def __init__(self, size: int = 2160, fov_deg: float = 180.0):
        self.size = size
        self.cx = size * 0.5
        self.cy = size * 0.5
        self.radius = size * 0.48  # Dome rim inside square buffer
        self.fov_deg = fov_deg
        self.fov_rad = np.radians(fov_deg)

    def celestial_to_dome(self, azimuth_deg: float, altitude_deg: float) -> Tuple[float, float]:
        """Convert horizontal coordinates (Azimuth, Altitude in degrees) to dome canvas (x, y).

        Azimuth: 0 = North (up), 90 = East (right), 180 = South (down), 270 = West (left)
        Altitude: 90 = Zenith (center), 0 = Horizon (rim).
        """
        alt = max(0.0, min(90.0, altitude_deg))
        zenith_ang = (90.0 - alt) / 90.0  # 0 at zenith, 1 at horizon
        r_px = zenith_ang * self.radius

        az_rad = np.radians(azimuth_deg)
        x = self.cx + r_px * np.sin(az_rad)
        y = self.cy - r_px * np.cos(az_rad)
        return float(x), float(y)

    def plane_to_dome(self, norm_x: float, norm_y: float) -> Tuple[float, float]:
        """Map normalized screen coordinates [-1, 1] into dome circular space with lens compression."""
        dist = math.sqrt(norm_x * norm_x + norm_y * norm_y)
        if dist < 1e-6:
            return self.cx, self.cy

        # Fisheye radial mapping
        theta = dist * (self.fov_rad * 0.5)
        dome_r = (theta / (self.fov_rad * 0.5)) * self.radius

        phi = math.atan2(norm_y, norm_x)
        x = self.cx + dome_r * math.cos(phi)
        y = self.cy + dome_r * math.sin(phi)
        return float(x), float(y)

    def is_in_safe_dome_area(self, x: float, y: float, safe_ratio: float = 0.88) -> bool:
        """Check if pixel coordinate lies within the optimal sweet spot of the planetarium dome."""
        dist = math.hypot(x - self.cx, y - self.cy)
        return dist <= self.radius * safe_ratio
