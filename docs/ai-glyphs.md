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

The owner wants glyphs made in small batches, about six characters at a time,
not in bulk. Draw six to eight variants per character, weed them yourself (see
"Review your own work"), queue the best three or four and tell the owner which
characters are waiting. They choose in the app. Settle how recurring components
are drawn as they come up and record it under "Decisions so far".
Batch generation, including the two-model comparison below, waits for an
explicit request. In the first trial, characters with four stacked layers
(愛) were judged not good enough to delegate.

## Decisions so far

- 流: the left stroke of 川 bends out to the lower left even beside 氵 (chosen
  over three straight verticals).
- 和: 禾 part plus a detached 口 one cell wide on y = 1..3 (`31-41-43-33-31`).
  An earlier version with 口 touching 禾 was replaced.
- 以: short left stroke with its upturn, a dot, and a small low 人
  (`01-04-13; 11-22; 31-33; 33-24; 33-44`).
- 案: 宀, 女 with its bar, 木 with bar and short legs, accepted as the least
  cramped option (`20-21; 01-41; 01-02; 41-42; 21-12-23; 31-13; 02-42; 03-43;
  23-24; 23-14; 23-34`).
- 路: undecided; two variants wait in the review queue.
- 衣: 亠, then ノ from the centre, a vertical with a hook under it, and a long
  right-falling stroke joined to the 亠 by a short stem (`20-22; 01-41; 21-03;
  12-14-24; 22-44; 42-33`).
- 位: narrow 立 is tick, bar, two short verticals that close into a V on the
  base line (`30-31; 21-41; 22-23-34-43-42; 24-44`). The base does not reach
  the 亻.
- 加: 力 on x = 0..2 as `01-21-24-14; 10-13-04`, with a detached 口 one cell
  wide on y = 1..4. The height of a right-hand 口 is chosen per character (tall
  here, y = 1..3 in 和).
- 果: 木 under 田 keeps its bar, stem and two short legs from the bar. The owner
  asked to see a full-width 田 and then chose the narrow one (x = 1..3): try
  what they suggest, but let them judge the rendering.

- 固: the vertical of 十 keeps its stub above the bar even though it then
  touches the frame; the variant that dropped the stub lost. Together with 英
  this gives a priority: **keeping a stroke that defines the character beats
  avoiding a touch.** Avoid contact by moving things, not by deleting strokes.
- 完: 元's left leg starts one column out (`13-04`), so the legs stand apart.
- 功: 工 sits one row down (`01-21; 11-13; 03-23`) and 力's bar is on y = 2, as
  in the real proportions; the version with 工 at the very top lost.
- 好: adopted, then the owner widened 子's top bar to two cells (`20-40`).
- 路: adopted, then the owner redrew the right-falling stroke of 夂 as
  `30-31-42`, a short vertical and a diagonal, so it crosses the left-falling
  stroke at a grid point. A crossing can use a kinked stroke when a straight
  one does not fit.
- 共, 札: adopted as drawn (札 uses the same hook as 礼).

## Target

The owner's goal is 常用漢字 (2,136) plus 人名用漢字 and the rest of JIS level
1, roughly 3,300 to 3,500 characters; JIS level 2 is undecided. Order:
elementary school, the rest of 常用, 人名用, the rest of level 1. Batches grow
as the adoption rate holds: 20 to 30 characters for now, then 50, then 100.
Characters with too many stacked layers for the grid (愛, 億) are left out of
batches and done in conversation at the end.

## What the owner rejects outright

From the first conversational round. These outrank the house style below.

- **Joining what is separate.** Components that do not touch in the real
  character must not touch or share a line (a 口 using 力's vertical as its own
  side; a base line running into the radical).
- **Crossing what does not cross.** Two strokes that only meet in the real
  character must not be drawn through each other.
- **Breaking a key component.** 木 has to stay a 木, 女 a 女, 立 a 立. If a
  component cannot keep its shape in the space, change the layout rather than
  squash it. Saying "this one is simply hard" is better than a crushed shape.
- **Bad spacing.** Components pushed far apart, or one component sitting low
  or off to a side for no reason.

When all candidates are weak the owner says so and names the least bad one;
treat that as a direction, not as approval.

Two more lessons from the second round:

- **Look at the real character before drawing.** `check --sheet` puts the real
  glyph next to the variants. Do not rely on memory for which strokes touch,
  cross or stick out: 岡's 山 does join the bar above it, the right-falling
  stroke of 夂 does cross the left-falling one and both run long, and the
  vertical of 央 does stick out above its frame. Leaving out a real join or
  crossing is as wrong as adding a false one.
- **Offer many variants.** Three is too few. Work out the independent choices
  (how long the left side is, where the right side starts, which line a bar
  sits on) and offer the combinations, six to eight when the character allows.
  The owner picked "left of 2, right of 3" for 印; that combination should
  have been on the table already.

## Review your own work before showing it

The owner should only have to say yes or no. Before showing anything, run the
variants through these checks and drop or redraw what fails. What each check
is worth was measured against the hand-made glyphs and the owner's verdicts in
[ai-glyph-verdicts.json](ai-glyph-verdicts.json).

1. **Real character.** `check --sheet` puts the real glyph beside the variants.
   Compare joins, crossings and proportions stroke by stroke.
2. **Shape rank.** `score <batch>` ranks each variant against every elementary
   kanji in a system font. Hand-made glyphs come first 60% of the time and in
   the top ten 90%, so a rank beyond ten, or a look-alike listed first (同 for
   a 岡), means the variant reads as something else. It says nothing about
   joins or crossings. `--ocr` adds Windows OCR, which read only 15% of the
   hand-made glyphs: ignore a miss. `score` also counts how many lines a scan
   crosses and prints `MORE lines than the real one` when the variant has more
   than the real character. That caught a 臣 with an invented middle bar, which
   had passed two visual checks and a critic. About one hand-made glyph in six
   trips it because of diagonals, so treat it as "count the strokes again in
   the real glyph", and never queue a flagged variant without doing so.
3. **Blind reading.** `blind <batch> -o sheet.png` renders the variants
   shuffled and unlabelled. Give only the PNG to a fresh agent and ask which
   kanji each tile is. A vision model read 29 of 30 hand-made glyphs this way,
   so a miss is a real legibility problem. It also read 7 of 8 variants the
   owner had rejected, so passing proves little.
4. **Critic.** Give a fresh agent the `check --sheet` image, the five rejection
   rules and the verdict file as examples, and ask for the rules each variant
   breaks and a ranking. In the first test its top choice matched the owner's
   for 3 of 7 characters, and the owner's choice was in its top three for all
   7; it put every joined or uncrossed variant near the bottom. Use it to
   remove bad variants, not to pick the winner. Render its sheet large
   (`check --sheet … --cell 44 --cols 5`): at the default size it misreads
   single-cell details, and every concrete claim it makes has to be checked
   against the strokes before acting on it.
   Split a batch of twenty into two sheets of ten. When the critic and you
   disagree about the real character, render that character alone and large
   and look again: for 臣 the critic was right and the first drafts were wrong
   (the inner box hangs from the left vertical and short verticals tie it to
   the top and bottom bars), while for 氏 and 民 it misread the drafts. Even
   then the redrawn 臣 gained a bar that does not exist, from miscounting the
   enlarged image; the owner caught it. Count bars against the `MORE` check,
   not by eye alone.
5. **Queue three or four.** Put the survivors in the review queue, best first.
   The owner weeds in the app: adopt and finish, adopt and fix by hand, or
   reject all with a remark. Showing a single pick and asking yes or no was
   considered and dropped, because the owner's choice is reliably among the
   top three but is the first pick only about half the time.
6. **Harvest.** Before the next batch run `pull` and then `harvest`. It copies
   each decision into the verdict file: the adopted variant, what it was edited
   to afterwards (`edited_to`), and the variants that lost. Read the new
   entries, above all the hand edits, before drawing again.

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
- Up to eight variants per character. Offer the combinations of the real
  choices; leave out only what is plainly broken.

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
   x = 2..4. Keep a gap to the radical unless the real character joins them;
   some finished glyphs share a line (糹 with its right side), but do not add
   new contact. A left component that is not a registered part (力 in 加) is
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
8. Density is fine, but strokes touch or cross only where the real character
   does. Avoid two parallel
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
