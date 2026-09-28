"""Turn the CWA composite radar PNG (O-A0058-003) into a transparent Web Mercator overlay.

The source image is an opaque 3600x3600 equirectangular plot that also draws a
basemap, gridlines, title box, colour legend and CWA logo. Radar echoes are the
only strongly saturated pixels, so everything else becomes transparent; the
legend/title/logo boxes are masked by position. Rows are then resampled from
linear latitude to Web Mercator so Leaflet's imageOverlay lines up exactly.
"""
import io
import math

import numpy as np
from PIL import Image

OUT_SIZE = 1800

# Decorations in source-pixel coordinates (x0, y0, x1, y1) for the 3600px image.
MASKS = [
    (0, 0, 520, 780),        # title / radar station list (top-left)
    (0, 3120, 560, 3600),    # CWA logo (bottom-left)
    (3360, 2460, 3600, 3600),  # dBZ colour legend (bottom-right)
]


def _merc_y(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def to_overlay(png: bytes, lat_min: float, lat_max: float) -> bytes:
    src = np.asarray(Image.open(io.BytesIO(png)).convert("RGB")).astype(np.int16)
    h, w, _ = src.shape
    sx, sy = w / 3600, h / 3600

    sat = src.max(axis=2) - src.min(axis=2)
    alpha = np.where(sat > 60, 215, 0).astype(np.uint8)
    for x0, y0, x1, y1 in MASKS:
        alpha[int(y0 * sy):int(y1 * sy), int(x0 * sx):int(x1 * sx)] = 0
    rgba = np.dstack([src.astype(np.uint8), alpha])

    # Resample: each output row i spans equal Mercator steps; find its source latitude row.
    m_top, m_bot = _merc_y(lat_max), _merc_y(lat_min)
    out_rows = np.arange(OUT_SIZE) + 0.5
    merc = m_top - (m_top - m_bot) * out_rows / OUT_SIZE
    lat = np.degrees(2 * np.arctan(np.exp(merc)) - math.pi / 2)
    src_rows = np.clip(((lat_max - lat) / (lat_max - lat_min) * h).astype(int), 0, h - 1)
    src_cols = np.clip(((np.arange(OUT_SIZE) + 0.5) / OUT_SIZE * w).astype(int), 0, w - 1)
    out = rgba[src_rows][:, src_cols]

    buf = io.BytesIO()
    Image.fromarray(out, "RGBA").save(buf, "PNG", compress_level=6)
    return buf.getvalue()
