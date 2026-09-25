#!/usr/bin/env python3
"""Generates the angel wings cosmetics (texture + 3D block model) from the pixel-art references.

Pipeline per variant:
  1. cut the left wing out of the reference and resample it onto a pixel-art grid;
  2. quantize to a small grey palette and redraw a 1-texel outline;
  3. mirror it into a texture that holds both wings;
  4. extrude the opaque texels into boxes (greedy rectangles, like vanilla item models),
     split the wing into segments along its span and bend each segment backwards
     around a hinge so the wings curve around the player's back.

Usage: python3 tools/generate_wings.py   (requires Pillow + numpy)
"""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "tools" / "refs"
PACK = ROOT / "resourcepack"
NAMESPACE = "okrip"

# Palette of the finished texture, darkest (outline) first.
OUTLINE = (122, 122, 130)
SHADES = [(176, 176, 186), (206, 206, 214), (228, 228, 234), (246, 246, 250)]

VARIANTS = {
    "angel_wings": {
        "ref": "angel_wings_spread.webp",
        "background": "dark",
        "grid_w": 60,  # texels along the wing span
        # Segments from root to tip: (share of the span, cumulative Y bend in degrees).
        "segments": [(0.36, 0.0), (0.34, 22.5), (0.30, 45.0)],
        "gap": 1.0,  # model units between the wings at the root
        "top": 15.0,  # model Y of the wing's top edge
        "display_scale": 1.6,
    },
    "angel_wings_folded": {
        "ref": "angel_wings_folded.webp",
        "background": "light",
        "grid_w": 28,
        "segments": [(0.5, 0.0), (0.5, 22.5)],
        "gap": 0.5,
        "top": 17.0,
        "display_scale": 1.25,
    },
}

DEPTH = 0.5  # extrusion thickness in model units
Z_ROOT = 8.25  # model Z of the wing root plate (back of the model is +Z / south)
MODEL_MIN, MODEL_MAX = -16.0, 32.0


# ---------------------------------------------------------------- texture extraction


def foreground_mask(img: np.ndarray, background: str) -> np.ndarray:
    lum = img.mean(axis=2)
    if background == "dark":
        return lum > 60
    # Light background: flood-fill near-white pixels from the image border, since the
    # wing itself is white inside its grey outline.
    h, w = lum.shape
    bright = lum > 232
    bg = np.zeros_like(bright)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        queue.extend([(0, x), (h - 1, x)])
    for y in range(h):
        queue.extend([(y, 0), (y, w - 1)])
    while queue:
        y, x = queue.popleft()
        if bg[y, x] or not bright[y, x]:
            continue
        bg[y, x] = True
        if y > 0:
            queue.append((y - 1, x))
        if y < h - 1:
            queue.append((y + 1, x))
        if x > 0:
            queue.append((y, x - 1))
        if x < w - 1:
            queue.append((y, x + 1))
    return ~bg


def left_wing_texels(cfg: dict) -> tuple[np.ndarray, np.ndarray]:
    """Returns (alpha HxW bool, shade index HxW int) for the left wing; the root is the right edge."""
    rgba = np.asarray(Image.open(REFS / cfg["ref"]).convert("RGBA")).astype(float)
    img = rgba[..., :3]
    if (rgba[..., 3] < 128).any():
        mask = rgba[..., 3] >= 128
    else:
        mask = foreground_mask(img, cfg["background"])
    half = mask.shape[1] // 2
    mask, img = mask[:, :half], img[:, :half]
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    mask, img = mask[y0:y1, x0:x1], img[y0:y1, x0:x1]

    gw = cfg["grid_w"]
    cell = (x1 - x0) / gw
    gh = max(1, round((y1 - y0) / cell))
    alpha = np.zeros((gh, gw), bool)
    lum = np.zeros((gh, gw))
    for gy in range(gh):
        for gx in range(gw):
            sy = slice(int(gy * cell), max(int((gy + 1) * cell), int(gy * cell) + 1))
            sx = slice(int(gx * cell), max(int((gx + 1) * cell), int(gx * cell) + 1))
            m = mask[sy, sx]
            if m.mean() >= 0.5:
                alpha[gy, gx] = True
                lum[gy, gx] = img[sy, sx][m].mean()

    alpha = drop_orphans(alpha)

    # Interior shading: rank the reference luminance into the shade palette.
    shade = np.zeros((gh, gw), int)
    inner = alpha & ~edge_texels(alpha)
    if inner.any():
        qs = np.quantile(lum[inner], [0.2, 0.45, 0.75])
        shade[inner] = 1 + np.searchsorted(qs, lum[inner])
    shade[alpha & edge_texels(alpha)] = 0
    return alpha, shade


def edge_texels(alpha: np.ndarray) -> np.ndarray:
    padded = np.pad(alpha, 1)
    neighbours_all = (
        padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:]
    )
    return alpha & ~neighbours_all


def drop_orphans(alpha: np.ndarray) -> np.ndarray:
    """Removes texels with fewer than two opaque 4-neighbours (single-pixel noise)."""
    for _ in range(2):
        p = np.pad(alpha, 1).astype(int)
        n = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        alpha = alpha & (n >= 2)
    return alpha


def palette_rgba(alpha: np.ndarray, shade: np.ndarray) -> np.ndarray:
    colors = np.array([OUTLINE, *SHADES], dtype=np.uint8)
    out = np.zeros((*alpha.shape, 4), np.uint8)
    out[..., :3] = colors[shade]
    out[..., 3] = np.where(alpha, 255, 0)
    return out


# ---------------------------------------------------------------- geometry


def greedy_rects(alpha: np.ndarray, x_from: int, x_to: int) -> list[tuple[int, int, int, int]]:
    """Covers opaque texels in columns [x_from, x_to) with rectangles (x0, y0, x1, y1)."""
    todo = alpha.copy()
    todo[:, :x_from] = False
    todo[:, x_to:] = False
    rects = []
    h = alpha.shape[0]
    for y in range(h):
        x = x_from
        while x < x_to:
            if not todo[y, x]:
                x += 1
                continue
            x_end = x
            while x_end < x_to and todo[y, x_end]:
                x_end += 1
            y_end = y + 1
            while y_end < h and todo[y_end, x:x_end].all():
                y_end += 1
            todo[y:y_end, x:x_end] = False
            rects.append((x, y, x_end, y_end))
            x = x_end
    return rects


def r(v: float) -> float:
    return round(v, 4)


def build_model(cfg: dict, alpha: np.ndarray, tex_w: int, tex_h: int, name: str) -> dict:
    gh, gw = alpha.shape
    segments = cfg["segments"]

    # Pick the texel size so every element's unrotated coordinates stay inside the
    # vanilla model bounds (-16..32).
    def layout(scale: float):
        joints = []  # per segment: (joint x, joint z, angle, texel range)
        jx, jz = 8 - cfg["gap"] / 2, Z_ROOT
        col_hi = gw
        for i, (share, angle) in enumerate(segments):
            cols = round(gw * share) if i < len(segments) - 1 else col_hi
            col_lo = max(0, col_hi - cols) if i < len(segments) - 1 else 0
            joints.append((jx, jz, angle, col_lo, col_hi))
            length = (col_hi - col_lo) * scale
            a = math.radians(angle)
            jx, jz = jx - length * math.cos(a), jz + length * math.sin(a)
            col_hi = col_lo
        min_x = min(j[0] - (j[4] - j[3]) * scale for j in joints)
        return joints, min_x

    scale = 0.5
    while True:
        joints, min_x = layout(scale)
        if min_x >= MODEL_MIN + 0.25 and cfg["top"] - gh * scale >= MODEL_MIN:
            break
        scale -= 0.01

    su, sv = 16 / tex_w, 16 / tex_h
    elements = []

    def add(x0, x1, y0, y1, tx0, ty0, tx1, ty1, origin, angle, mirrored):
        # Texture of the mirrored wing lives in the right half of the atlas.
        def u(tx):
            return r((tex_w - tx if mirrored else tx) * su)

        def uv(ax, ay, bx, by):
            return [u(ax), r(ay * sv), u(bx), r(by * sv)]

        z0, z1 = origin[2], origin[2] + DEPTH
        if mirrored:
            x0, x1 = 16 - x1, 16 - x0
            origin = [16 - origin[0], origin[1], origin[2]]
            angle = -angle
            # South face spans x0..x1 left to right; mirrored texture runs the other way.
            south = uv(tx1, ty0, tx0, ty1)
            north = uv(tx0, ty0, tx1, ty1)
            east, west = uv(tx0, ty0, tx0 + 1, ty1), uv(tx1 - 1, ty0, tx1, ty1)
        else:
            south = uv(tx0, ty0, tx1, ty1)
            north = uv(tx1, ty0, tx0, ty1)
            west, east = uv(tx0, ty0, tx0 + 1, ty1), uv(tx1 - 1, ty0, tx1, ty1)
        up = uv(tx0, ty0, tx1, ty0 + 1)
        down = uv(tx0, ty1 - 1, tx1, ty1)
        if mirrored:
            up = [up[2], up[1], up[0], up[3]]
            down = [down[2], down[1], down[0], down[3]]
        el = {
            "from": [r(x0), r(y0), r(z0)],
            "to": [r(x1), r(y1), r(z1)],
            "faces": {
                "north": {"uv": north, "texture": "#wings"},
                "east": {"uv": east, "texture": "#wings"},
                "south": {"uv": south, "texture": "#wings"},
                "west": {"uv": west, "texture": "#wings"},
                "up": {"uv": up, "texture": "#wings"},
                "down": {"uv": down, "texture": "#wings"},
            },
        }
        if angle:
            el["rotation"] = {"angle": angle, "axis": "y", "origin": [r(v) for v in origin]}
        elements.append(el)

    for mirrored in (False, True):
        for jx, jz, angle, col_lo, col_hi in joints:
            for tx0, ty0, tx1, ty1 in greedy_rects(alpha, col_lo, col_hi):
                x0 = jx - (col_hi - tx0) * scale
                x1 = jx - (col_hi - tx1) * scale
                y1 = cfg["top"] - ty0 * scale
                y0 = cfg["top"] - ty1 * scale
                add(x0, x1, y0, y1, tx0, ty0, tx1, ty1, [jx, cfg["top"], jz], angle, mirrored)

    s = cfg["display_scale"]
    return {
        "credit": "Okrip World - generated by tools/generate_wings.py",
        "texture_size": [tex_w, tex_h],
        "textures": {"wings": f"{NAMESPACE}:item/cosmetics/{name}", "particle": f"{NAMESPACE}:item/cosmetics/{name}"},
        "elements": elements,
        "display": {
            "head": {"rotation": [0, 0, 0], "translation": [0, -8, 4], "scale": [s, s, s]},
            "thirdperson_righthand": {"rotation": [0, 180, 0], "translation": [0, 2, 0], "scale": [0.4, 0.4, 0.4]},
            "firstperson_righthand": {"rotation": [0, 180, 0], "translation": [0, 3, 0], "scale": [0.35, 0.35, 0.35]},
            "ground": {"translation": [0, 2, 0], "scale": [0.3, 0.3, 0.3]},
            "gui": {"rotation": [20, 25, 0], "translation": [0, 1, 0], "scale": [0.5, 0.5, 0.5]},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.6, 0.6, 0.6]},
        },
    }


# ---------------------------------------------------------------- output


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1) + "\n")


def main() -> None:
    for name, cfg in VARIANTS.items():
        alpha, shade = left_wing_texels(cfg)
        gh, gw = alpha.shape
        tex_w = 1 << math.ceil(math.log2(gw * 2))
        tex_h = 1 << math.ceil(math.log2(gh))
        atlas = np.zeros((tex_h, tex_w, 4), np.uint8)
        rgba = palette_rgba(alpha, shade)
        atlas[:gh, :gw] = rgba
        atlas[:gh, tex_w - gw :] = rgba[:, ::-1]

        tex_path = PACK / "assets" / NAMESPACE / "textures" / "item" / "cosmetics" / f"{name}.png"
        tex_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(atlas, "RGBA").save(tex_path)

        model = build_model(cfg, alpha, tex_w, tex_h, name)
        write_json(PACK / "assets" / NAMESPACE / "models" / "item" / "cosmetics" / f"{name}.json", model)
        write_json(
            PACK / "assets" / NAMESPACE / "items" / f"{name}.json",
            {"model": {"type": "minecraft:model", "model": f"{NAMESPACE}:item/cosmetics/{name}"}},
        )
        print(f"{name}: texture {tex_w}x{tex_h}, wing grid {gw}x{gh}, {len(model['elements'])} elements")


if __name__ == "__main__":
    main()
