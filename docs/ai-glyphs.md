# AI glyph proposals

Kanji can be drafted by an AI agent and reviewed by a person in the app. This
file is the brief for the agent: read it fully before designing anything.

## Rules that do not bend

- An agent only creates **proposals**. Never PATCH or PUT `/api/project`; glyph
  data changes only when a person adopts a proposal in the app.
- Generate proposals only when the owner asks for a batch, and only the
  characters or the amount they asked for.
- Only propose characters that have no edges yet. `status` lists them per grade.
  `check` warns when a target already has edges; drop those unless told otherwise.
- Batch files and pulled data live in `data/ai/` (ignored by Git). Do not commit
  production glyph data.

## Loop

```bash
python tools/glyph_proposals.py pull                 # project + proposals -> data/ai, prints status
python tools/glyph_proposals.py sheet --done -o data/ai/done.png --cols 12
python tools/glyph_proposals.py ascii 族 方 長 --parts # exact edges of related glyphs and parts
# write data/ai/<batch>.json
python tools/glyph_proposals.py check data/ai/<batch>.json --sheet data/ai/<batch>.png
# look at the PNG, fix, repeat until every variant reads as its character
python tools/glyph_proposals.py push data/ai/<batch>.json   # only after the owner's go-ahead
```

`sheet` needs Pillow; everything else is standard library. Pass
`--url http://127.0.0.1:8787` to `pull` and `push` to work against a local server.

After the review, the next `pull` prints the feedback: rejected proposals with
the reviewer's comment, and adopted proposals whose edges the reviewer changed
afterwards (`-removed +added`). Read it before the next batch and adjust.

## Grid and batch format

The kanji grid is 4x4 cells. A point is written as two digits `xy`, x from 0
(left) to 4 (right), y from 0 (top) to 4 (bottom). Strokes are polylines of
points joined by `-`, separated by `;`. Each segment must be horizontal,
vertical or exactly 45 degrees, so `00-40-44` is the top edge and the right edge
and `40-04` is the full diagonal. There are no dots and no curves.

```json
{
  "batch": "2026-11-grade4-a",
  "source": "fable-5.2",
  "items": [
    {
      "char": "旅",
      "note": "方 as in 族, right side ノ・レ・ノ・乀",
      "variants": [
        { "strokes": "10-13-04; 01-41; 30-21; 12-22-24-14; 31-22-44; 42-33" },
        { "parts": ["氵"], "glyphs": [], "strokes": "30-31; 21-41", "remove": "", "note": "why this differs" }
      ]
    }
  ]
}
```

- `parts`: names of registered parts, pasted exactly as registered.
- `glyphs`: copy every edge of an existing glyph as a starting point.
- `strokes`: added edges. `remove`: edges taken away again after everything else.
- `edges`: raw edge ids (`h-x-y`, `v-x-y`, `d1-x-y`, `d2-x-y`) if you need them.
- `source`: who drew it. The app hides it so the review stays blind.
- One to three variants per character. Offer more than one only when they are
  real alternatives a reviewer could prefer, not noise.

## House style

These come from the finished glyphs. Always confirm against the real data
(`sheet --done`, `ascii`) rather than trusting this list alone.

1. **Reuse before inventing.** Find finished glyphs that share a component and
   copy how they built it (旅 follows 族, 練 follows 東 and 線). The same
   component should look the same across the font.
2. **Left radicals are registered parts**, used as they are: 氵 礻 禾 糹 亻 彳
   訁 and others (`ascii --parts`). The right component then usually sits on
   x = 2..4 and may touch the radical or share a line with it (糹 shares the
   y = 2 line).
3. **Only five horizontal levels exist.** Merge neighbouring horizontals, drop
   dots and small ticks, and keep what makes the character recognisable and
   different from its look-alikes. Bold omission is normal here.
4. 亠 is a one-cell tick from the top plus a horizontal on y = 1.
5. 口 is a closed box, 日 a box with a middle line. Narrow columns give 1-wide
   boxes; that is accepted.
6. Left- and right-falling strokes are 45 degree diagonals. Legs of 木 大 人
   run from a centre point to the bottom corners.
7. A hook is one cell: `44-34` at the bottom of a right vertical (刂 月 円), or a
   one-cell upturn for 乚.
8. Lines may touch and cross freely; density is fine. Avoid two parallel
   diagonals one cell apart when one belongs to the radical and one to the right
   component: they read as a single doubled stroke.
9. A glyph must not be identical to any other glyph (`check` warns).
10. Judge the rendered PNG, not the stroke list. If it does not read as the
    character at a glance next to its neighbours, redesign it.

## Comparing models

To compare authors on equal terms, give each one a fresh agent that has only
this brief, never another author's drafts:

1. Pick the characters and a batch name.
2. Start one fresh agent per model with the same prompt: read this file, design
   the listed characters with two or three variants each, write
   `data/ai/<batch>-<model>.json` with `"source": "<model>"`, run `check` with
   `--sheet`, look at the sheet and fix, do not push.
3. Merge and inspect, then push after the go-ahead:

```bash
python tools/glyph_proposals.py merge data/ai/<batch>.json data/ai/<batch>-opus.json data/ai/<batch>-fable.json
python tools/glyph_proposals.py check data/ai/<batch>.json --sheet data/ai/<batch>.png
python tools/glyph_proposals.py sheet --batch data/ai/<batch>.json --sources -o data/ai/<batch>-sources.png
```

`merge` shuffles the variants in a stable order and `check` folds identical
shapes into one variant credited to both authors. Reviewers see 案1, 案2, …
without the author. `status` later reports how often each source was adopted.

## Review in the app

Pending proposals show as an `AI案 n` chip and list tab. The current
character's proposal is drawn on the canvas in amber over the reference glyph.
The reviewer picks a variant and chooses 採用して完成 (adopt and mark finished),
採用して直す (adopt, then edit) or 却下 (reject, optionally with a comment).
Decisions and comments are stored in `data/proposals.json` on the server, next
to the shared project but separate from it.
