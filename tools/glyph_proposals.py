#!/usr/bin/env python3
"""Author, check and send AI glyph proposals for the 4x4 kanji grid.

Proposals are reviewed by a person in the app. This tool never writes glyph
data: `push` only talks to /api/proposals. See docs/ai-glyphs.md.
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_URL = os.environ.get("TRACE_LOGO_URL", "https://trace-logo-editor.pages.dev")
ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "ai"
GRID = 4
EDGE = re.compile(r"^(h|v|d1|d2)-(\d+)-(\d+)$")


def fail(message):
    sys.exit(f"error: {message}")


def request(url, payload=None):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="GET" if data is None else "POST")
    req.add_header("user-agent", "trace-logo-editor-tools")
    if data is not None:
        req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            if response.headers.get("x-trace-logo-api") != "1":
                fail(f"{url} did not answer from the editor API (is the server up to date?)")
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        fail(f"{url} -> HTTP {error.code}: {error.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.URLError as error:
        fail(f"{url} -> {error.reason}")


def load(name):
    path = WORK / name
    if not path.exists():
        fail(f"{path} is missing; run `pull` first")
    return json.loads(path.read_text(encoding="utf-8"))


def is_kanji(char):
    return len(char) == 1 and (0x3400 <= ord(char) <= 0x9FFF or 0xF900 <= ord(char) <= 0xFAFF)


def grade_sets():
    source = (ROOT / "app.js").read_text(encoding="utf-8")
    return {grade: chars for grade, chars in re.findall(r'^\s+(\d): splitGraphemes\("([^"]+)"\)', source, re.M)}


# --- geometry ---------------------------------------------------------------

def valid_edge(edge_id):
    match = EDGE.match(edge_id) if isinstance(edge_id, str) else None
    if not match:
        return False
    kind, x, y = match.group(1), int(match.group(2)), int(match.group(3))
    if kind == "h":
        return x < GRID and y <= GRID
    if kind == "v":
        return x <= GRID and y < GRID
    return x < GRID and y < GRID


def edge_points(edge_id):
    kind, x, y = edge_id.split("-")
    x, y = int(x), int(y)
    return {"h": (x, y, x + 1, y), "v": (x, y, x, y + 1), "d1": (x, y, x + 1, y + 1), "d2": (x + 1, y, x, y + 1)}[kind]


def segment_edges(a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    steps = max(abs(dx), abs(dy))
    if steps == 0 or not (dx == 0 or dy == 0 or abs(dx) == abs(dy)):
        raise ValueError(f"{a}->{b} is not horizontal, vertical or 45 degrees")
    sx, sy = dx // steps, dy // steps
    edges = []
    for i in range(steps):
        ax, ay = x1 + sx * i, y1 + sy * i
        bx, by = ax + sx, ay + sy
        if ay == by:
            edges.append(f"h-{min(ax, bx)}-{ay}")
        elif ax == bx:
            edges.append(f"v-{ax}-{min(ay, by)}")
        elif (bx - ax) == (by - ay):
            edges.append(f"d1-{min(ax, bx)}-{min(ay, by)}")
        else:
            edges.append(f"d2-{min(ax, bx)}-{min(ay, by)}")
    return edges


def stroke_edges(spec):
    """'10-13-04; 01-41' -> edge ids. A token is the x and y digit of a grid point."""
    edges = []
    for polyline in re.split(r"[;\n]", spec or ""):
        polyline = polyline.strip()
        if not polyline:
            continue
        tokens = polyline.split("-")
        if len(tokens) < 2 or any(not re.fullmatch(r"[0-4][0-4]", token) for token in tokens):
            raise ValueError(f"bad polyline '{polyline}' (use points like 00-40-44)")
        points = [(int(token[0]), int(token[1])) for token in tokens]
        for a, b in zip(points, points[1:]):
            edges += segment_edges(a, b)
    return edges


def expand_variant(variant, project):
    parts = {}
    for part in project.get("parts", []):
        parts.setdefault(part["name"], part)
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    edges = []
    for name in variant.get("parts", []):
        if name not in parts:
            raise ValueError(f"part '{name}' is not registered (registered: {' '.join(parts)})")
        part = parts[name]
        if part.get("gridCols") != GRID or part.get("gridRows") != GRID:
            raise ValueError(f"part '{name}' was not made on the 4x4 grid")
        edges += part["activeEdges"]
    for char in variant.get("glyphs", []):
        if char not in glyphs or not glyphs[char]["activeEdges"]:
            raise ValueError(f"glyph '{char}' has no edges to copy")
        edges += glyphs[char]["activeEdges"]
    edges += stroke_edges(variant.get("strokes", ""))
    edges += variant.get("edges", [])
    removed = set(stroke_edges(variant.get("remove", "")))
    result = []
    for edge in edges:
        if not valid_edge(edge):
            raise ValueError(f"edge '{edge}' is outside the 4x4 grid")
        if edge not in removed and edge not in result:
            result.append(edge)
    if not result:
        raise ValueError("variant has no edges")
    return result


def expand_batch(batch, project):
    """Returns (payload for /api/proposals, warnings)."""
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    by_shape = {}
    for glyph in project["glyphs"]:
        if glyph.get("folder") == "kanji" and glyph["activeEdges"]:
            by_shape.setdefault(frozenset(glyph["activeEdges"]), []).append(glyph["char"])
    warnings, items = [], []
    for item in batch.get("items", []):
        char = item.get("char", "")
        if not is_kanji(char):
            fail(f"'{char}' is not a single kanji")
        if char not in glyphs:
            fail(f"{char} is not in the shared project")
        if glyphs[char]["activeEdges"]:
            state = glyphs[char].get("status")
            warnings.append(f"{char}: already has edges ({state}); adopting would replace a person's work")
        variants, seen = [], {}
        for index, variant in enumerate(item.get("variants", [])):
            try:
                edges = expand_variant(variant, project)
            except ValueError as error:
                fail(f"{char} variant {index + 1}: {error}")
            shape = frozenset(edges)
            source = variant.get("source") or batch.get("source") or ""
            if shape in seen:
                merged = variants[seen[shape]]
                names = [name for name in merged["source"].split("+") if name]
                if source and source not in names:
                    merged["source"] = "+".join(names + [source])
                continue
            others = [other for other in by_shape.get(shape, []) if other != char]
            if others:
                warnings.append(f"{char} variant {index + 1}: identical to {''.join(others)}")
            seen[shape] = len(variants)
            variants.append({"activeEdges": edges, "note": variant.get("note", ""), "source": source})
        if not variants:
            fail(f"{char}: no variants")
        items.append({"char": char, "note": item.get("note", ""), "grid": {"cols": GRID, "rows": GRID}, "variants": variants})
    if not items:
        fail("batch has no items")
    return {"batch": batch.get("batch", ""), "items": items}, warnings


# --- views ------------------------------------------------------------------

def ascii_rows(edges):
    width = 2 * GRID + 1
    cells = [[" "] * width for _ in range(width)]
    for y in range(GRID + 1):
        for x in range(GRID + 1):
            cells[2 * y][2 * x] = "·"
    for edge in edges:
        kind, x, y = edge.split("-")
        x, y = int(x), int(y)
        if kind == "h":
            cells[2 * y][2 * x + 1] = "━"
        elif kind == "v":
            cells[2 * y + 1][2 * x] = "┃"
        else:
            mark = "╲" if kind == "d1" else "╱"
            other = cells[2 * y + 1][2 * x + 1]
            cells[2 * y + 1][2 * x + 1] = "╳" if other not in (" ", mark) else mark
    wide = {"━": "━━━", " ": "   ", "╲": " ╲ ", "╱": " ╱ ", "╳": " ╳ "}
    return ["".join(wide[c] if i % 2 else c for i, c in enumerate(row)) for row in cells]


def print_ascii(items, per_row=5):
    for start in range(0, len(items), per_row):
        chunk = items[start:start + per_row]
        print("   ".join((label + " " * 18)[:17 - sum(ord(c) > 0x2E7F for c in label[:17])] for label, _ in chunk))
        grids = [ascii_rows(edges) for _, edges in chunk]
        for row in range(2 * GRID + 1):
            print("    ".join(grid[row] for grid in grids))
        print()


def render_sheet(items, out, cols=10, cell=26, stroke=6):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        fail("sheets need Pillow (pip install pillow); `ascii` works without it")
    scale = 2
    cell, stroke = cell * scale, stroke * scale
    pad, label_height = 14 * scale, 26 * scale
    tile_w, tile_h = GRID * cell + pad * 2, GRID * cell + pad * 2 + label_height
    rows = math.ceil(len(items) / cols)
    image = Image.new("RGB", (cols * tile_w, rows * tile_h), (255, 255, 255))
    draw = ImageDraw.Draw(image)
    font = None
    for candidate in ("C:/Windows/Fonts/meiryo.ttc", "C:/Windows/Fonts/YuGothM.ttc",
                      "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc",
                      "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"):
        if os.path.exists(candidate):
            font = ImageFont.truetype(candidate, 18 * scale)
            break
    half = stroke / 2
    for index, (label, edges) in enumerate(items):
        left, top = (index % cols) * tile_w + pad, (index // cols) * tile_h
        if font:
            draw.text((left, top + 2 * scale), label, fill=(200, 60, 40), font=font)
        top += label_height + pad
        for i in range(GRID + 1):
            draw.line([left, top + i * cell, left + GRID * cell, top + i * cell], fill=(225, 225, 225), width=1)
            draw.line([left + i * cell, top, left + i * cell, top + GRID * cell], fill=(225, 225, 225), width=1)
        for edge in edges:
            x1, y1, x2, y2 = edge_points(edge)
            ax, ay, bx, by = left + x1 * cell, top + y1 * cell, left + x2 * cell, top + y2 * cell
            length = math.hypot(bx - ax, by - ay)
            ux, uy = (bx - ax) / length, (by - ay) / length
            ax, ay, bx, by = ax - ux * half, ay - uy * half, bx + ux * half, by + uy * half
            nx, ny = -uy * half, ux * half
            draw.polygon([(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)], fill=(20, 24, 22))
    image = image.resize((image.width // scale, image.height // scale), Image.LANCZOS)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    image.save(out)
    print(f"wrote {out} ({len(items)} glyphs)")


def batch_view_items(payload, show_source=False):
    items = []
    for item in payload["items"]:
        for index, variant in enumerate(item["variants"]):
            label = f"{item['char']}{index + 1}"
            if show_source and variant.get("source"):
                label += f" {variant['source']}"
            items.append((label, variant["activeEdges"]))
    return items


def selected_items(args, project):
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    if getattr(args, "parts", False):
        return [(part["name"], part["activeEdges"]) for part in project.get("parts", [])]
    if getattr(args, "done", False):
        return [(g["char"], g["activeEdges"]) for g in project["glyphs"] if g.get("folder") == "kanji" and g.get("status") == "完成"]
    if getattr(args, "drafts", False):
        return [(g["char"], g["activeEdges"]) for g in project["glyphs"]
                if g.get("folder") == "kanji" and g.get("status") != "完成" and g["activeEdges"]]
    if getattr(args, "batch", None):
        payload, _ = expand_batch(json.loads(Path(args.batch).read_text(encoding="utf-8")), project)
        return batch_view_items(payload, getattr(args, "sources", False))
    chars = "".join(args.chars or [])
    if not chars:
        fail("name characters, or use --done / --drafts / --parts / --batch FILE")
    missing = [char for char in chars if char not in glyphs or not glyphs[char]["activeEdges"]]
    if missing:
        print("no edges yet:", "".join(missing))
    return [(char, glyphs[char]["activeEdges"]) for char in chars if char not in missing]


# --- commands ---------------------------------------------------------------

def cmd_pull(args):
    WORK.mkdir(parents=True, exist_ok=True)
    project = request(f"{args.url}/api/project")
    (WORK / "project.json").write_text(json.dumps(project, ensure_ascii=False), encoding="utf-8")
    proposals = {"items": {}}
    try:
        proposals = request(f"{args.url}/api/proposals")
    except SystemExit as error:
        print(f"proposals not available yet ({error})")
    (WORK / "proposals.json").write_text(json.dumps(proposals, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"pulled revision {project.get('revision')} saved {project.get('savedAt')} into {WORK}")
    cmd_status(args)


def cmd_status(args):
    project, proposals = load("project.json"), load("proposals.json")
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    kanji = [g for g in project["glyphs"] if g.get("folder") == "kanji"]
    done = [g for g in kanji if g.get("status") == "完成"]
    drafts = [g for g in kanji if g.get("status") != "完成" and g["activeEdges"]]
    print(f"kanji {len(kanji)}: 完成 {len(done)}, 下書き {len(drafts)}, parts {len(project.get('parts', []))}")
    items = proposals.get("items", {})
    pending = [i for i in items.values() if i["status"] == "pending"]
    for grade, chars in sorted(grade_sets().items()):
        untouched = [c for c in chars if c in glyphs and not glyphs[c]["activeEdges"]
                     and not (c in items and items[c]["status"] == "pending")]
        print(f"  grade {grade} untouched {len(untouched)}: {''.join(untouched[:60])}{'…' if len(untouched) > 60 else ''}")
    print(f"proposals: pending {len(pending)} {''.join(i['char'] for i in pending)}")
    wins, shown = {}, {}
    for item in items.values():
        if item["status"] == "pending":
            continue
        for index, variant in enumerate(item["variants"]):
            for source in filter(None, (variant.get("source") or "").split("+")):
                shown[source] = shown.get(source, 0) + 1
                if item["status"] == "adopted" and item.get("chosen") == index:
                    wins[source] = wins.get(source, 0) + 1
    if shown:
        print("adopted by source:", ", ".join(f"{s} {wins.get(s, 0)}/{n}" for s, n in sorted(shown.items())))
    print("feedback to learn from:")
    any_feedback = False
    for item in items.values():
        char, comment = item["char"], item.get("comment") or ""
        if item["status"] == "rejected":
            any_feedback = True
            print(f"  {char} rejected: {comment or '(no comment)'}")
        elif item["status"] == "adopted":
            chosen = set(item["variants"][item["chosen"]]["activeEdges"])
            now = set(glyphs.get(char, {}).get("activeEdges", []))
            if chosen != now or comment:
                any_feedback = True
                print(f"  {char} adopted variant {item['chosen'] + 1}, then edited: "
                      f"-{sorted(chosen - now)} +{sorted(now - chosen)} {comment}")
    if not any_feedback:
        print("  (none yet)")


def cmd_ascii(args):
    print_ascii(selected_items(args, load("project.json")))


def cmd_sheet(args):
    render_sheet(selected_items(args, load("project.json")), args.out, cols=args.cols)


def cmd_check(args):
    payload, warnings = expand_batch(json.loads(Path(args.batch).read_text(encoding="utf-8")), load("project.json"))
    for warning in warnings:
        print("warning:", warning)
    print_ascii(batch_view_items(payload))
    if args.sheet:
        render_sheet(batch_view_items(payload), args.sheet, cols=args.cols)
    print(f"ok: {len(payload['items'])} characters, {sum(len(i['variants']) for i in payload['items'])} variants")


def cmd_merge(args):
    merged, order = {}, []
    for path in args.inputs:
        batch = json.loads(Path(path).read_text(encoding="utf-8"))
        source = batch.get("source") or Path(path).stem
        for item in batch.get("items", []):
            char = item["char"]
            if char not in merged:
                merged[char] = {"char": char, "note": "", "variants": []}
                order.append(char)
            for variant in item.get("variants", []):
                merged[char]["variants"].append({**variant, "source": variant.get("source") or source})
    for char in order:
        # A stable shuffle keeps the review blind: position does not reveal the source.
        merged[char]["variants"].sort(key=lambda v: hashlib.sha256(
            (char + json.dumps(v, ensure_ascii=False, sort_keys=True)).encode("utf-8")).hexdigest())
    out = {"batch": args.name or Path(args.out).stem, "items": [merged[char] for char in order]}
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {args.out}: {len(order)} characters from {len(args.inputs)} files")


def cmd_push(args):
    project = request(f"{args.url}/api/project")
    payload, warnings = expand_batch(json.loads(Path(args.batch).read_text(encoding="utf-8")), project)
    for warning in warnings:
        print("warning:", warning)
    result = request(f"{args.url}/api/proposals", payload)
    print(f"sent {len(result.get('chars', []))} proposals to {args.url}: {''.join(result.get('chars', []))}")


def main():
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    def add(name, handler, help_text):
        command = sub.add_parser(name, help=help_text)
        command.set_defaults(handler=handler)
        return command

    def add_selection(command):
        command.add_argument("chars", nargs="*", help="characters to show")
        command.add_argument("--done", action="store_true", help="all finished kanji")
        command.add_argument("--drafts", action="store_true", help="kanji with edges that are not finished")
        command.add_argument("--parts", action="store_true", help="registered parts")
        command.add_argument("--batch", help="variants of a batch file")
        command.add_argument("--sources", action="store_true", help="label batch variants with their source")

    add("pull", cmd_pull, "download the shared project and proposals into data/ai").add_argument("--url", default=DEFAULT_URL)
    add("status", cmd_status, "summarise untouched kanji, pending proposals and review feedback")
    add_selection(add("ascii", cmd_ascii, "print glyphs as text grids"))
    sheet = add("sheet", cmd_sheet, "render glyphs to a PNG contact sheet")
    add_selection(sheet)
    sheet.add_argument("-o", "--out", required=True)
    sheet.add_argument("--cols", type=int, default=10)
    check = add("check", cmd_check, "expand and validate a batch file")
    check.add_argument("batch")
    check.add_argument("--sheet", help="also render the variants to this PNG")
    check.add_argument("--cols", type=int, default=8)
    merge = add("merge", cmd_merge, "combine batch files from several authors into one blind batch")
    merge.add_argument("out")
    merge.add_argument("inputs", nargs="+")
    merge.add_argument("--name", help="batch name (defaults to the output file name)")
    push = add("push", cmd_push, "send a batch to the review queue (proposals only)")
    push.add_argument("batch")
    push.add_argument("--url", default=DEFAULT_URL)

    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
