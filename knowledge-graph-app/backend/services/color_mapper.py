"""Pure color and size mapping functions for graph visual encoding.

No database access — all functions are stateless transformations from a
numeric/string signal to a hex color or pixel measurement.
"""


def heat_to_color(heat_score: float) -> str:
    """Interpolate a hex color from blue (#4A90D9) at 0.0 to red (#D94A4A) at 1.0.

    Linear interpolation is applied independently on the R, G, and B channels.
    ``heat_score`` is clamped to [0.0, 1.0] before interpolation.
    """
    t = max(0.0, min(1.0, heat_score))

    # Cold endpoint: #4A90D9 → (74, 144, 217)
    r0, g0, b0 = 0x4A, 0x90, 0xD9
    # Hot endpoint:  #D94A4A → (217, 74, 74)
    r1, g1, b1 = 0xD9, 0x4A, 0x4A

    r = round(r0 + t * (r1 - r0))
    g = round(g0 + t * (g1 - g0))
    b = round(b0 + t * (b1 - b0))

    return f"#{r:02X}{g:02X}{b:02X}"


def sentiment_to_color(sentiment_score: float) -> str:
    """Map a sentiment score to a hex fill color.

    - score < -0.2  → red   (#D94A4A)
    - score >  0.2  → green (#4AD94A)
    - otherwise     → grey  (#999999)
    """
    if sentiment_score < -0.2:
        return "#D94A4A"
    if sentiment_score > 0.2:
        return "#4AD94A"
    return "#999999"


def action_item_status_to_color(status: str) -> str:
    """Map an action-item status string to a hex fill color.

    - "open"        → amber (#F5A623)
    - "in_progress" → blue  (#4A90D9)
    - "closed"      → grey  (#999999)

    Unknown values fall back to grey.
    """
    mapping = {
        "open": "#F5A623",
        "in_progress": "#4A90D9",
        "closed": "#999999",
    }
    return mapping.get(status, "#999999")


def weight_to_size(display_weight: float, min_r: float = 8.0, max_r: float = 32.0) -> float:
    """Normalize a display_weight in [0.0, 1.0] to a node radius in [min_r, max_r]."""
    t = max(0.0, min(1.0, display_weight))
    return min_r + t * (max_r - min_r)


def weight_to_stroke(base_weight: float, min_px: float = 1.0, max_px: float = 8.0) -> float:
    """Normalize a base_weight in [0.0, 1.0] to a stroke-width in [min_px, max_px]."""
    t = max(0.0, min(1.0, base_weight))
    return min_px + t * (max_px - min_px)
