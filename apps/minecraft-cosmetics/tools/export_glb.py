#!/usr/bin/env python3
"""Exports a generated block model to a binary glTF (.glb) with the texture embedded.

Opens in Blender via File > Import > glTF 2.0. 1 block (16 model units) = 1 metre,
+Y up, +Z is the back of the player (the side everyone sees the wings from).

Usage: python3 tools/export_glb.py angel_wings   -> blender/angel_wings.glb
"""

import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "resourcepack" / "assets" / "okrip"


def rot_y(p, origin, angle):
    a = math.radians(angle)
    x, y, z = p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]
    return (x * math.cos(a) + z * math.sin(a) + origin[0], y + origin[1], -x * math.sin(a) + z * math.cos(a) + origin[2])


def face_corners(face, f, t):
    """Corners in UV order (u0v0, u1v0, u1v1, u0v1), matching vanilla face orientation."""
    (x0, y0, z0), (x1, y1, z1) = f, t
    return {
        "south": [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        "north": [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        "east": [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
        "west": [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
        "up": [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
        "down": [(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)],
    }[face]


NORMALS = {"south": (0, 0, 1), "north": (0, 0, -1), "east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0)}


def main() -> None:
    name = sys.argv[1]
    model = json.loads((ASSETS / "models" / "item" / "cosmetics" / f"{name}.json").read_text())
    png = (ASSETS / "textures" / "item" / "cosmetics" / f"{name}.png").read_bytes()

    pos, nor, uv, idx = [], [], [], []
    for el in model["elements"]:
        rot = el.get("rotation")
        for face, fd in el["faces"].items():
            u0, v0, u1, v1 = fd["uv"]
            corners = face_corners(face, el["from"], el["to"])
            normal = NORMALS[face]
            if rot:
                corners = [rot_y(c, rot["origin"], rot["angle"]) for c in corners]
                normal = rot_y(normal, (0, 0, 0), rot["angle"])
            base = len(pos)
            for c in corners:
                pos.append(((c[0] - 8) / 16, c[1] / 16, (c[2] - 8) / 16))
                nor.append(normal)
            uv += [(u0 / 16, v0 / 16), (u1 / 16, v0 / 16), (u1 / 16, v1 / 16), (u0 / 16, v1 / 16)]
            # Corners run clockwise seen from outside; glTF wants counter-clockwise.
            idx += [base, base + 3, base + 2, base, base + 2, base + 1]

    def pack(fmt, rows):
        return b"".join(struct.pack(fmt, *r) for r in rows)

    blobs = [
        pack("<3f", pos),
        pack("<3f", nor),
        pack("<2f", uv),
        pack("<I", [(i,) for i in idx]),
        png,
    ]
    views, offset = [], 0
    binary = b""
    for blob in blobs:
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(blob)})
        blob += b"\0" * (-len(blob) % 4)
        binary += blob
        offset += len(blob)

    for i in range(3):
        views[i]["target"] = 34962
    views[3]["target"] = 34963
    mins = [min(p[i] for p in pos) for i in range(3)]
    maxs = [max(p[i] for p in pos) for i in range(3)]
    gltf = {
        "asset": {"version": "2.0", "generator": "okrip tools/export_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
            "indices": 3,
            "material": 0,
        }]}],
        "materials": [{
            "name": name,
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1},
            "alphaMode": "MASK",
            "alphaCutoff": 0.5,
        }],
        "textures": [{"sampler": 0, "source": 0}],
        # Nearest filtering keeps the pixel-art crisp.
        "samplers": [{"magFilter": 9728, "minFilter": 9728, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": 4, "mimeType": "image/png", "name": name}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mins, "max": maxs},
            {"bufferView": 1, "componentType": 5126, "count": len(nor), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 3, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
    }

    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    out = ROOT / "blender" / f"{name}.glb"
    out.parent.mkdir(exist_ok=True)
    total = 12 + 8 + len(js) + 8 + len(binary)
    out.write_bytes(
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(js), b"JSON") + js
        + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    )
    print(f"{out.relative_to(ROOT)}: {len(pos)} vertices, {len(idx) // 3} triangles")


if __name__ == "__main__":
    main()
