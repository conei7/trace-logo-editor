"""Automatic legibility checks for 4x4 glyph variants.

Two independent signals, both judged against the real character:

- shape rank: the variant is compared with every elementary kanji rendered in a
  system font, using where strokes of each direction lie; rank 1 means it looks
  most like its own character. On the 334 hand-made finished glyphs the target
  came first for 60% and in the top ten for 90%, so a rank beyond ten is a
  warning and the listed look-alikes say what it is confused with.
- OCR: Windows' Japanese OCR reads a row of the variant. It recognised only 15%
  of the hand-made glyphs, so a miss means little and a hit is a bonus.

Needs numpy, OpenCV and Pillow. OCR needs Windows with the Japanese language.
"""
import os
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SIZE = 64
INNER = 56
FONTS = ["C:/Windows/Fonts/YuGothB.ttc", "C:/Windows/Fonts/meiryob.ttc", "C:/Windows/Fonts/msgothic.ttc"]
_templates = {}


def _normalise(mask, bins=4, sigma=3.5):
    """Crops to the ink, fits it into a square and describes where strokes of each direction lie."""
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return np.zeros(bins * 256, dtype=np.float32)
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    height, width = crop.shape
    scale = INNER / max(height, width)
    resized = cv2.resize(crop, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((SIZE, SIZE), dtype=np.float32)
    top, left = (SIZE - resized.shape[0]) // 2, (SIZE - resized.shape[1]) // 2
    canvas[top:top + resized.shape[0], left:left + resized.shape[1]] = resized
    grad_x = cv2.Sobel(canvas, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(canvas, cv2.CV_32F, 0, 1, ksize=3)
    strength = np.hypot(grad_x, grad_y)
    angle = (np.arctan2(grad_y, grad_x) % np.pi) / np.pi * bins
    planes = []
    for index in range(bins):
        distance = np.abs(angle - index)
        distance = np.minimum(distance, bins - distance)
        plane = cv2.GaussianBlur(np.clip(1 - distance, 0, 1) * strength, (0, 0), sigma)
        planes.append(cv2.resize(plane, (16, 16), interpolation=cv2.INTER_AREA).flatten())
    vector = np.concatenate(planes)
    norm = np.linalg.norm(vector)
    return vector / norm if norm else vector


def render_variant(edges, cell=40, stroke=None, pad=30):
    """Black-on-white PIL image of a variant, drawn like the app draws it."""
    stroke = stroke or cell * 0.24
    size = 4 * cell + pad * 2
    image = Image.new("L", (size, size), 255)
    draw = ImageDraw.Draw(image)
    half = stroke / 2
    for edge in edges:
        kind, x, y = edge.split("-")
        x, y = int(x), int(y)
        x1, y1, x2, y2 = {"h": (x, y, x + 1, y), "v": (x, y, x, y + 1), "d1": (x, y, x + 1, y + 1), "d2": (x + 1, y, x, y + 1)}[kind]
        ax, ay, bx, by = pad + x1 * cell, pad + y1 * cell, pad + x2 * cell, pad + y2 * cell
        length = float(np.hypot(bx - ax, by - ay))
        ux, uy = (bx - ax) / length, (by - ay) / length
        ax, ay, bx, by = ax - ux * half, ay - uy * half, bx + ux * half, by + uy * half
        nx, ny = -uy * half, ux * half
        draw.polygon([(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)], fill=0)
    return image


def variant_vector(edges):
    return _normalise(np.array(render_variant(edges)) < 128)


def template_matrix(chars):
    """Rows of normalised font renderings, one block per available font."""
    key = "".join(chars)
    if key in _templates:
        return _templates[key]
    blocks = []
    for path in FONTS:
        if not os.path.exists(path):
            continue
        font = ImageFont.truetype(path, 96)
        rows = []
        for char in chars:
            image = Image.new("L", (128, 128), 255)
            ImageDraw.Draw(image).text((16, 8), char, fill=0, font=font)
            rows.append(_normalise(np.array(image) < 128))
        blocks.append(np.stack(rows))
    if not blocks:
        raise RuntimeError("no reference font found for the shape rank")
    _templates[key] = blocks
    return blocks


def shape_rank(edges, target, chars):
    """(rank of the target, similarity, the three closest characters)."""
    vector = variant_vector(edges)
    scores = np.max(np.stack([block @ vector for block in template_matrix(chars)]), axis=0)
    order = np.argsort(-scores)
    index = chars.index(target)
    rank = int(np.nonzero(order == index)[0][0]) + 1
    return rank, float(scores[index]), "".join(chars[i] for i in order[:3])


def ocr_rows(variants, repeat=4):
    """Runs Windows OCR on a row of each variant; returns the recognised strings."""
    script = Path(__file__).with_name("ocr_windows.ps1")
    if os.name != "nt" or not script.exists():
        return None
    with tempfile.TemporaryDirectory() as folder:
        paths = []
        for index, edges in enumerate(variants):
            tile = render_variant(edges, cell=24, pad=10)
            row = Image.new("L", (tile.width * repeat + 40, tile.height + 40), 255)
            for k in range(repeat):
                row.paste(tile, (20 + k * tile.width, 20))
            path = os.path.join(folder, f"{index}.png")
            row.save(path)
            paths.append(path)
        listing = os.path.join(folder, "list.txt")
        Path(listing).write_text("\n".join(paths), encoding="utf-8")
        done = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script), "-ListFile", listing],
                              capture_output=True)
        if done.returncode != 0:
            return None
        found = {}
        for line in done.stdout.decode("utf-8", "replace").splitlines():
            path, _, text = line.partition("\t")
            found[path.strip()] = text.strip()
        return [found.get(path, "") for path in paths]
