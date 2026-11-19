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

## Working mode for now

The owner wants glyphs made in conversation first, not in bulk. Take a few
characters at a time, show the candidates as images in the chat, let the owner
choose, and settle how recurring components are drawn as they come up. Record
each decision under "Decisions so far" so the next session starts from it.
Batch generation, including the two-model comparison below, waits for an
explicit request. In the first trial, characters with four stacked layers
(愛) were judged not good enough to delegate.

## Decisions so far

- 流: the left stroke of 川 bends out to the lower left even beside 氵 (chosen
  over three straight verticals).
- 和: 口 is two cells wide on x = 2..4 and touches 禾, as in 知 (chosen over a
  detached one-cell box).
- 路: undecided; two variants wait in the review queue.

## Loop

```bash
python tools/glyph_proposals.py pull                 # project + proposals -> data/ai, prints status
python tools/glyph_proposals.py fetch-ids            # once: kanji decomposition table for study/find
python tools/glyph_proposals.py study 愛 路 --sheet data/ai/study.png  # components, and finished glyphs that share them
python tools/glyph_proposals.py find 心 夂             # every kanji with a component, by position and progress
python tools/glyph_proposals.py sheet --done -o data/ai/done.png --cols 12
python tools/glyph_proposals.py ascii 族 方 長          # related glyphs as text grids
python tools/glyph_proposals.py strokes 族 方 長        # the same glyphs in the stroke shorthand, ready to copy
python tools/glyph_proposals.py strokes --parts       # registered parts in the shorthand
# write data/ai/<batch>.json
python tools/glyph_proposals.py check data/ai/<batch>.json --sheet data/ai/<batch>.png
# look at the PNG, fix, repeat until every variant reads as its character
python tools/glyph_proposals.py push data/ai/<batch>.json   # only after the owner's go-ahead
```

The full `--done` sheet is too large to study closely; use it for the overall
feel, then render named subsets (`sheet 立 倍 暗 新 -o …`) of glyphs that share a
component with your target. `check --sheet` accepts `--cols` too.
`study` and `find` print a position after each character: a chain read from the
outside in, using 左右 上下 中 外内 重 (so 下上 is the upper half of the lower
half). The decomposition table is CJKVI-IDS (based on CHISE, GPL); it stays in
`data/ai/ids/` for local lookups and is not committed.
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

- `parts`: names of registered parts, pasted exactly as registered. Parts are
  locked to their position; to use one elsewhere, retype it with `strokes`.
- `glyphs`: copy every edge of an existing glyph as a starting point.
- `strokes`: added edges. `remove`: edges taken away again after everything else.
- `edges`: raw edge ids (`h-x-y`, `v-x-y`, `d1-x-y`, `d2-x-y`) if you need them.
- `source`: who drew it. The app hides it so the review stays blind.
- `note`: one short line in Japanese; the reviewer reads it in the app next to
  the variant. Say what the variant gave up or how it differs from the others.
- One to three variants per character. Explore as many as you like, then keep
  the best; offer more than one only when they are real alternatives a reviewer
  could prefer, not noise.

## House style

These come from the finished glyphs. Always confirm against the real data
(`sheet --done`, `ascii`) rather than trusting this list alone.

1. **Reuse before inventing.** Run `study` on the target, look at the finished
   glyphs that share its components and start from how they built them (旅
   follows 族, 練 follows 東 and 線). The finished glyphs are not uniform: the
   same component is drawn differently from one kanji to the next, sometimes on
   purpose (two strokes of 氵 were slanted in one glyph because the right side
   got in the way) and sometimes not. So treat an existing form as a starting
   point, bend it when it collides with its neighbour, and do not chase exact
   consistency. Rough and readable beats uniform at this stage.
2. **Left radicals are registered parts**, used as they are: 氵 礻 禾 糹 亻 彳
   訁 and others (`ascii --parts`). The right component then usually sits on
   x = 2..4 and may touch the radical or share a line with it (糹 shares the
   y = 2 line). A left component that is not a registered part (力 in 加) is
   squeezed into x = 0..2 the way finished glyphs squeeze theirs. Where a
   registered part and a finished glyph draw the same component differently,
   follow the finished glyph in the same position (心 under 急 思 is the model
   for a bottom 心).
3. **Only five horizontal levels exist.** Merge neighbouring horizontals, drop
   dots and small ticks, and keep what makes the character recognisable and
   different from its look-alikes. Bold omission is normal here. When a
   component cannot fit its usual form (立 in two columns, four stacked layers
   in 愛), there is no fixed priority: offer the competing trade-offs as
   variants and say in `note` what each one gave up.
4. 亠 is a one-cell tick from the top plus a horizontal on y = 1.
5. 口 is a closed box, 日 a box with a middle line. Narrow columns give 1-wide
   boxes; that is accepted.
6. Left- and right-falling strokes are 45 degree diagonals. Legs of 木 大 人
   run from a centre point to the bottom corners.
7. A hook is one cell: `44-34` at the bottom of a right vertical (刂 月 円), or a
   one-cell upturn for 乚.
8. Lines may touch and cross freely; density is fine. Avoid two parallel
   diagonals one cell apart when one belongs to the radical and one to the right
   component: they read as a single doubled stroke. Likewise avoid diagonals
   of two components lining up into one long stroke.
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
