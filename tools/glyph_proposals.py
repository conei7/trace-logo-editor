#!/usr/bin/env python3
"""Author, check and send AI glyph proposals for the 4x4 kanji grid.

Proposals are reviewed by a person in the app; `push` only talks to
/api/proposals. The one command that writes glyph data is `adopt`, for a
choice the owner made in conversation. See docs/ai-glyphs.md.
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
IDS_FILE = WORK / "ids" / "ids.txt"
IDS_URL = "https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt"
IDS_ARITY = {**{op: 2 for op in "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻"}, "⿲": 3, "⿳": 3}
IDS_ROLES = {"⿰": "左右", "⿱": "上下", "⿲": "左中右", "⿳": "上中下", "⿻": "重重"}
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


# --- components -------------------------------------------------------------

def load_ids():
    """char -> ideographic description sequence, preferring the Japanese form."""
    if not IDS_FILE.exists():
        fail(f"{IDS_FILE} is missing; run `fetch-ids` first")
    table = {}
    for line in IDS_FILE.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if line.startswith("#") or len(fields) < 3:
            continue
        options = fields[2:]
        chosen = next((option for option in options if re.search(r"\[[A-Z]*J[A-Z]*\]", option)), options[0])
        table[fields[1]] = re.sub(r"\[[A-Z]+\]", "", chosen)
    return table


def ids_tokens(text):
    tokens, index = [], 0
    while index < len(text):
        if text[index] == "&" and ";" in text[index:]:
            end = text.index(";", index) + 1
            tokens.append(text[index:end])
            index = end
        else:
            tokens.append(text[index])
            index += 1
    return tokens


def decompose(char, table, seen=()):
    """Tree of {'char', 'op', 'children'}; nested operators become unnamed nodes."""
    sequence = table.get(char)
    if not sequence or sequence == char or char in seen:
        return {"char": char, "op": None, "children": []}
    tokens = ids_tokens(sequence)

    def read():
        token = tokens.pop(0) if tokens else "？"
        if token in IDS_ARITY:
            return {"char": None, "op": token, "children": [read() for _ in range(IDS_ARITY[token])]}
        return decompose(token, table, seen + (char,))

    tree = read()
    tree["char"] = char
    return tree


def is_stroke(char):
    return (len(char) != 1 or 0x31C0 <= ord(char) <= 0x31EF or 0x2460 <= ord(char) <= 0x2473
            or char in "一丨丶丿乙亅乚𠃌𠄌")


def components(tree, path=""):
    """Yields (char, path) for every named node; path is a chain like 下上."""
    if tree["char"] and path:
        yield tree["char"], path
    roles = IDS_ROLES.get(tree["op"], "外内")
    for index, child in enumerate(tree["children"]):
        yield from components(child, path + roles[min(index, len(roles) - 1)])


def tree_text(tree):
    if not tree["op"]:
        return tree["char"]
    return tree["op"] + "".join(child["char"] if child["char"] else tree_text(child) for child in tree["children"])


def component_index(project, table):
    """component -> [(char, path, status)] over the kanji of the project."""
    index = {}
    for glyph in project["glyphs"]:
        if glyph.get("folder") != "kanji":
            continue
        status = "完成" if glyph.get("status") == "完成" else ("下書き" if glyph["activeEdges"] else "未着手")
        seen = set()
        for component, path in components(decompose(glyph["char"], table)):
            if (component, path) not in seen:
                seen.add((component, path))
                index.setdefault(component, []).append((glyph["char"], path, status))
    return index


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


def edges_to_strokes(edges):
    """Edge ids -> the stroke shorthand, one polyline per maximal straight run."""
    steps = {"h": (1, 0), "v": (0, 1), "d1": (1, 1), "d2": (-1, 1)}
    remaining = {}
    for edge in edges:
        x1, y1, x2, y2 = edge_points(edge)
        remaining[(edge.split("-")[0], x1, y1)] = (x2, y2)
    runs = []
    for kind, x, y in sorted(remaining, key=lambda key: (list(steps).index(key[0]), key[2], key[1])):
        dx, dy = steps[kind]
        if (kind, x, y) not in remaining or (kind, x - dx, y - dy) in remaining:
            continue
        end = (x, y)
        while (kind, end[0], end[1]) in remaining:
            end = remaining.pop((kind, end[0], end[1]))
        runs.append(f"{x}{y}-{end[0]}{end[1]}")
    return "; ".join(runs)


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
        authors = {}
        for variant in variants:
            for name in variant["source"].split("+"):
                authors[name] = authors.get(name, 0) + 1
        if len(variants) > 8:
            warnings.append(f"{char}: the review queue holds at most eight variants")
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


def render_sheet(items, out, cols=10, cell=26, stroke=None, grid=False):
    """Contact sheet. By default glyphs are drawn as the app previews them: at the
    font's real weight (about 0.46 of a cell) and without the grid, because that is
    what a reader sees. grid=True gives thin strokes on the grid for reading edges."""
    stroke = stroke or (cell * 0.23 if grid else cell * 0.46)
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
    real = ImageFont.truetype(font.path, int(GRID * cell * 0.92)) if font else None
    for index, (label, edges) in enumerate(items):
        left, top = (index % cols) * tile_w + pad, (index // cols) * tile_h
        if font:
            draw.text((left, top + 2 * scale), label, fill=(200, 60, 40), font=font)
        top += label_height + pad
        if edges is None and real:
            # Reference tile: the real character, to check which strokes touch and cross.
            box = draw.textbbox((0, 0), label[0], font=real)
            draw.text((left + (GRID * cell - (box[2] - box[0])) / 2 - box[0],
                       top + (GRID * cell - (box[3] - box[1])) / 2 - box[1]), label[0], fill=(120, 120, 120), font=real)
        for i in range(GRID + 1 if grid else 0):
            draw.line([left, top + i * cell, left + GRID * cell, top + i * cell], fill=(225, 225, 225), width=1)
            draw.line([left + i * cell, top, left + i * cell, top + GRID * cell], fill=(225, 225, 225), width=1)
        for edge in edges or []:
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


def batch_view_items(payload, show_source=False, with_reference=False):
    items = []
    for item in payload["items"]:
        if with_reference:
            items.append((f"{item['char']} 実物", None))
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


def cmd_strokes(args):
    for label, edges in selected_items(args, load("project.json")):
        print(f"{label}: {edges_to_strokes(edges)}")


def cmd_sheet(args):
    render_sheet(selected_items(args, load("project.json")), args.out, cols=args.cols, grid=args.grid)


def cmd_fetch_ids(args):
    IDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(IDS_URL, headers={"user-agent": "trace-logo-editor-tools"})
    with urllib.request.urlopen(req, timeout=120) as response:
        IDS_FILE.write_bytes(response.read())
    print(f"wrote {IDS_FILE} ({IDS_FILE.stat().st_size} bytes). CJKVI-IDS, based on the CHISE IDS database (GPL); "
          "kept in data/ai for local lookups only, do not commit it.")


def glyph_progress(glyph):
    return "完成" if glyph.get("status") == "完成" else ("下書き" if glyph["activeEdges"] else "未着手")


def cmd_find(args):
    project, table = load("project.json"), load_ids()
    index = component_index(project, table)
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    shown = []
    for component in "".join(args.components):
        hits = index.get(component, [])
        own = glyphs.get(component)
        whole = f" (as a glyph: {glyph_progress(own)})" if own else ""
        print(f"{component}: in {len({char for char, _, _ in hits})} kanji{whole}")
        for status in ("完成", "下書き", "未着手"):
            by_path = {}
            for char, path, hit_status in hits:
                if hit_status == status:
                    by_path.setdefault(path, []).append(char)
            if by_path:
                print(f"  {status}: " + "  ".join(f"{path}:{''.join(chars)}" for path, chars in sorted(by_path.items())))
            if status == "完成":
                shown += [char for chars in by_path.values() for char in chars]
        if own and own["activeEdges"]:
            shown.append(component)
    if args.sheet:
        render_sheet([(char, glyphs[char]["activeEdges"]) for char in dict.fromkeys(shown)], args.sheet, cols=args.cols)


def cmd_study(args):
    project, table = load("project.json"), load_ids()
    index = component_index(project, table)
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    parts = {part["name"] for part in project.get("parts", [])}
    shown = []
    for target in "".join(args.chars):
        tree = decompose(target, table)
        print(f"{target} = {tree_text(tree)}")
        for component, path in dict.fromkeys(components(tree)):
            if is_stroke(component):
                continue
            hits = [(char, hit_path) for char, hit_path, status in index.get(component, [])
                    if status == "完成" and char != target]
            # Same position first, then the same last step, then everything else.
            hits.sort(key=lambda hit: (hit[1] != path, hit[1][-1:] != path[-1:], len(hit[1])))
            notes = []
            own = glyphs.get(component)
            if own and own["activeEdges"]:
                notes.append(f"glyph {glyph_progress(own)}")
                shown.append(component)
            if component in parts:
                notes.append("registered part")
            listing = " ".join(f"{char}({hit_path})" for char, hit_path in hits[:args.limit]) or "none finished"
            more = f" +{len(hits) - args.limit}" if len(hits) > args.limit else ""
            print(f"  {component} [{path}]{' ' + ', '.join(notes) if notes else ''}: {listing}{more}")
            shown += [char for char, _ in hits[:args.limit]]
        print()
    if args.sheet:
        render_sheet([(char, glyphs[char]["activeEdges"]) for char in dict.fromkeys(shown)], args.sheet, cols=args.cols)


def cmd_check(args):
    payload, warnings = expand_batch(json.loads(Path(args.batch).read_text(encoding="utf-8")), load("project.json"))
    for warning in warnings:
        print("warning:", warning)
    print_ascii(batch_view_items(payload))
    if args.sheet:
        render_sheet(batch_view_items(payload, with_reference=True), args.sheet, cols=args.cols,
                     cell=args.cell, grid=args.grid)
    print(f"ok: {len(payload['items'])} characters, {sum(len(i['variants']) for i in payload['items'])} variants")


def cmd_score(args):
    """Legibility signals per variant; see glyph_score.py for what they are worth."""
    import glyph_score
    project = load("project.json")
    payload, _ = expand_batch(json.loads(Path(args.batch).read_text(encoding="utf-8")), project)
    chars = [glyph["char"] for glyph in project["glyphs"] if glyph.get("folder") == "kanji"]
    rows = [(item["char"], index + 1, variant["activeEdges"])
            for item in payload["items"] for index, variant in enumerate(item["variants"])]
    texts = glyph_score.ocr_rows([edges for _, _, edges in rows]) if args.ocr else None
    for position, (char, number, edges) in enumerate(rows):
        rank, similarity, closest = glyph_score.shape_rank(edges, char, chars)
        line = f"{char}{number}: shape rank {rank} ({similarity:.2f}), closest {closest}"
        if texts is not None:
            line += f", OCR {'hit' if char in texts[position] else 'miss'} [{texts[position][:8]}]"
        more_h, more_v = glyph_score.extra_strokes(edges, char)
        if more_h > 0 or more_v > 0:
            line += f", MORE lines than the real one (横 {more_h:+d}, 縦 {more_v:+d})"
        print(line + ("  <- check" if rank > 10 or more_h > 0 or more_v > 0 else ""))


def cmd_blind(args):
    """Numbered sheet without labels, plus the key, for a reader who must not know the answers."""
    import random
    payload, _ = expand_batch(json.loads(Path(args.batch).read_text(encoding="utf-8")), load("project.json"))
    rows = [(f"{item['char']}{index + 1}", variant["activeEdges"])
            for item in payload["items"] for index, variant in enumerate(item["variants"])]
    random.Random(args.seed).shuffle(rows)
    render_sheet([(f"{number:02d}", edges) for number, (_, edges) in enumerate(rows, 1)], args.out, cols=args.cols)
    key = Path(args.out).with_suffix(".key.json")
    key.write_text(json.dumps({f"{number:02d}": label for number, (label, _) in enumerate(rows, 1)}, ensure_ascii=False), encoding="utf-8")
    print(f"key in {key}; give the reader only the PNG")


def cmd_harvest(args):
    """Copies decisions made in the app into the verdict file, once per proposal."""
    path = ROOT / "docs" / "ai-glyph-verdicts.json"
    log = json.loads(path.read_text(encoding="utf-8"))
    seen = {(entry["char"], entry.get("proposal")) for entry in log["verdicts"]}
    project, proposals = load("project.json"), load("proposals.json")
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    added = 0
    for item in proposals.get("items", {}).values():
        if item["status"] == "pending" or (item["char"], item.get("createdAt")) in seen:
            continue
        # Choices made in conversation are written to the file by hand, with the owner's words.
        if (item.get("comment") or "").startswith("会話で選択"):
            continue
        for index, variant in enumerate(item["variants"]):
            entry = {"char": item["char"], "proposal": item.get("createdAt"),
                     "strokes": edges_to_strokes(variant["activeEdges"]), "reason": ""}
            if item["status"] == "rejected" and item.get("triedVariant") == index:
                # Adopted for a hand fix, then given up on with やめて却下.
                entry["verdict"] = "rejected"
                entry["reason"] = "採用して直そうとしたが直せず却下" + (f"：{item['comment']}" if item.get("comment") else "")
            elif item["status"] == "rejected":
                entry["verdict"], entry["reason"] = "rejected", item.get("comment") or "全部だめ"
            elif item.get("chosen") == index:
                entry["verdict"], entry["reason"] = "adopted", item.get("comment") or ""
                now = glyphs.get(item["char"], {}).get("activeEdges", [])
                if set(now) != set(variant["activeEdges"]):
                    entry["edited_to"] = edges_to_strokes(now)
            else:
                entry["verdict"], entry["reason"] = "rejected", "選ばれず"
            log["verdicts"].append(entry)
            added += 1
    path.write_text(json.dumps(log, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"added {added} verdicts to {path}")


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
    # A proposal for a glyph someone already drew asks the owner to replace their work;
    # only send it when the owner asked for a redraw.
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    drawn = [item["char"] for item in payload["items"] if glyphs[item["char"]]["activeEdges"]]
    if drawn and not args.replace:
        fail(f"{''.join(drawn)} already have edges on the server; drop them or pass --replace if the owner asked for a redraw")
    result = request(f"{args.url}/api/proposals", payload)
    print(f"sent {len(result.get('chars', []))} proposals to {args.url}: {''.join(result.get('chars', []))}")


def review_left(url, doc=None):
    """Characters still waiting in the app's AI queue: pending, or adopted and not yet finished."""
    proposals = (doc or request(f"{url}/api/proposals")).get("items", {})
    pending = [char for char, item in proposals.items() if item.get("status") == "pending"]
    if pending:
        return pending
    adopted = [char for char, item in proposals.items() if item.get("status") == "adopted"]
    glyphs = {glyph["char"]: glyph for glyph in request(f"{url}/api/project")["glyphs"]}
    return [char for char in adopted if glyphs.get(char, {}).get("status") != "完成"]


def cmd_wait(args):
    """Polls the shared server and exits once the owner has worked through the whole AI queue,
    or has pressed 次の組を頼む in the app (an unhandled request, printed with its note)."""
    import time
    last = None
    while True:
        try:
            doc = request(f"{args.url}/api/proposals")
            asked = doc.get("request") or {}
            if asked.get("requestedAt") and not asked.get("handledAt"):
                print(f"requested in the app at {asked['requestedAt']}: {asked.get('note') or '(no note)'}", flush=True)
                return
            left = review_left(args.url, doc)
        except SystemExit as error:  # request() exits on network errors; keep waiting instead
            print(f"server not reached ({error}); retrying", flush=True)
            time.sleep(args.every)
            continue
        if not left:
            print("review finished: nothing pending and every adopted glyph is finished", flush=True)
            return
        if len(left) != last:
            print(f"{len(left)} left: {''.join(left)}", flush=True)
            last = len(left)
        time.sleep(args.every)


def cmd_adopt(args):
    """Applies a variant the owner picked in conversation, as the app's adopt button would."""
    project = request(f"{args.url}/api/project")
    proposals = request(f"{args.url}/api/proposals")
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    picks = []
    for pick in args.picks:
        match = re.fullmatch(r"(.)([1-9])", pick)
        if not match:
            fail(f"'{pick}' should be a character and a variant number, like 衣1")
        char, number = match.group(1), int(match.group(2))
        item = proposals.get("items", {}).get(char)
        if not item or item["status"] != "pending":
            fail(f"{char} has no pending proposal")
        if number > len(item["variants"]):
            fail(f"{char} has only {len(item['variants'])} variants")
        if glyphs[char]["activeEdges"] and not args.replace:
            fail(f"{char} already has edges; pass --replace if the owner asked to replace them")
        picks.append((char, number - 1, item))
    patch = {"glyphs": []}
    for char, index, item in picks:
        edges = list(item["variants"][index]["activeEdges"])
        patch["glyphs"].append({**glyphs[char], "activeEdges": edges, "lockedEdges": edges, "activePoints": [],
                                "status": "完成" if args.done else "未完成"})
    request(f"{args.url}/api/project/patch", patch)
    for char, index, item in picks:
        request(f"{args.url}/api/proposals/decide", {"char": char, "status": "adopted", "variant": index,
                                                      "final": args.done, "comment": args.comment,
                                                      "createdAt": item.get("createdAt")})
    print(f"adopted {' '.join(args.picks)} as {'完成' if args.done else '未完成'} on {args.url}")


def cmd_finish(args):
    """Marks glyphs 完成 on the owner's word, leaving their edges as they are."""
    project = request(f"{args.url}/api/project")
    glyphs = {glyph["char"]: glyph for glyph in project["glyphs"]}
    patch = {"glyphs": []}
    for char in "".join(args.chars):
        if char not in glyphs or not glyphs[char]["activeEdges"]:
            fail(f"{char} has no edges to finish")
        patch["glyphs"].append({**glyphs[char], "status": "完成"})
    request(f"{args.url}/api/project/patch", patch)
    print(f"marked 完成 on {args.url}: {''.join(args.chars)}")


def main():
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
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
    add_selection(add("strokes", cmd_strokes, "print glyphs in the stroke shorthand, ready to copy into a batch"))
    sheet = add("sheet", cmd_sheet, "render glyphs to a PNG contact sheet")
    add_selection(sheet)
    sheet.add_argument("-o", "--out", required=True)
    sheet.add_argument("--cols", type=int, default=10)
    sheet.add_argument("--grid", action="store_true", help="thin strokes on the grid instead of the preview look")
    add("fetch-ids", cmd_fetch_ids, "download the kanji decomposition table used by find and study")
    find = add("find", cmd_find, "list kanji that contain a component, by position and progress")
    find.add_argument("components", nargs="+")
    find.add_argument("--sheet", help="render the finished ones to this PNG")
    find.add_argument("--cols", type=int, default=10)
    study = add("study", cmd_study, "break characters into components and list finished glyphs that share them")
    study.add_argument("chars", nargs="+")
    study.add_argument("--limit", type=int, default=12, help="finished glyphs to list per component")
    study.add_argument("--sheet", help="render the listed glyphs to this PNG")
    study.add_argument("--cols", type=int, default=10)
    check = add("check", cmd_check, "expand and validate a batch file")
    check.add_argument("batch")
    check.add_argument("--sheet", help="also render the variants to this PNG")
    check.add_argument("--cols", type=int, default=8)
    check.add_argument("--cell", type=int, default=26, help="cell size in pixels; use 44 or more for a critic")
    check.add_argument("--grid", action="store_true", help="thin strokes on the grid instead of the preview look")
    score = add("score", cmd_score, "shape rank (and optionally Windows OCR) for every variant of a batch")
    score.add_argument("batch")
    score.add_argument("--ocr", action="store_true", help="also run the Windows Japanese OCR")
    blind = add("blind", cmd_blind, "render a shuffled, unlabelled sheet of a batch for a blind reading test")
    blind.add_argument("batch")
    blind.add_argument("-o", "--out", required=True)
    blind.add_argument("--cols", type=int, default=8)
    blind.add_argument("--seed", type=int, default=1)
    add("harvest", cmd_harvest, "copy the app's decisions and hand edits into docs/ai-glyph-verdicts.json")
    merge = add("merge", cmd_merge, "combine batch files from several authors into one blind batch")
    merge.add_argument("out")
    merge.add_argument("inputs", nargs="+")
    merge.add_argument("--name", help="batch name (defaults to the output file name)")
    push = add("push", cmd_push, "send a batch to the review queue (proposals only)")
    push.add_argument("batch")
    push.add_argument("--replace", action="store_true", help="also send characters that already have edges")
    push.add_argument("--url", default=DEFAULT_URL)

    wait = add("wait", cmd_wait, "wait until the owner has reviewed every proposal or asked for more, then exit")
    wait.add_argument("--every", type=int, default=60, help="seconds between checks")
    wait.add_argument("--url", default=DEFAULT_URL)

    adopt = add("adopt", cmd_adopt, "apply variants the owner chose in conversation (writes glyph data)")
    adopt.add_argument("picks", nargs="+", help="character and variant number, e.g. 衣1 位2")
    adopt.add_argument("--done", action="store_true", help="mark the glyphs 完成 instead of 未完成")
    adopt.add_argument("--replace", action="store_true", help="allow replacing a glyph that already has edges")
    adopt.add_argument("--comment", default="", help="the owner's remark, stored with the decision")
    adopt.add_argument("--url", default=DEFAULT_URL)

    finish = add("finish", cmd_finish, "mark glyphs 完成 when the owner says so (writes glyph data)")
    finish.add_argument("chars", nargs="+")
    finish.add_argument("--url", default=DEFAULT_URL)

    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
