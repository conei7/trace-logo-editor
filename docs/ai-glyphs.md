# AI glyph proposals

Kanji can be drafted by an AI agent and reviewed by a person in the app. This
file is the brief for the agent: read it fully before designing anything.

## Rules that do not bend

- An agent only creates **proposals**. Never PATCH or PUT `/api/project`; glyph
  data changes only when a person adopts a proposal in the app.
- Generate proposals under the standing go-ahead described in "Loop", and
  only for the elementary kanji (grades 1 to 6) until the owner has done the
  overall review that follows them.
- Only propose characters that have no edges yet. `status` lists them per grade.
  `check` warns when a target already has edges; drop those unless told otherwise.
- Batch files and pulled data live in `data/ai/` (ignored by Git). Do not commit
  production glyph data.

## Working mode for now

The owner wants glyphs made in batches that grow while the adoption rate holds
(see "Target"), not in bulk. Draw six to eight variants per character, weed
them yourself (see "Review your own work"), queue the best three or four (one
or two for a simple character) and tell the owner which characters are waiting. They choose in the app. Settle how recurring components
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

Third round (g4-f, 20 characters reviewed in the app): 16 adopted as drawn, 3
adopted and fixed by hand, 1 rejected. Each fix restored something the
finished glyphs already do, so run `study` and copy hooks and proportions from
the finished glyph that contains the same component.

- 材: the bar of 木 and the bar of 才 joined into one line (`01-41`), as in 村,
  was chosen over a separate 才.
- 官: the owner dropped the dot of 宀 and moved the roof to the top
  (`00-40; 00-01; 40-41`) so both boxes of 㠯 get room (`11-31-32-12`,
  `13-43-44-14`). 室 宮 実 do the same. **When the part under 宀 needs four
  rows, drop the dot instead of squashing boxes into slits.**
- 氏: the last stroke ends with an upward tick `43-44`, as the 氏 in 紙 does.
- 欠: redrawn as bar `11-41` with a hook down to the left from its right end
  (`41-32`), stem `21-23`, and legs `23-14-04` and `23-34-44` that end in short
  horizontals. 次 and 歌 also keep a hook at the right end of the bar.
- 岡: after adoption the owner redrew the inside: 丷 as `10-21; 30-21`, bar
  `11-31`, 山 hanging from the bar (`21-23; 12-13; 32-33; 13-33`), and the hook
  of 冂 (`34-44`). Every 冂 in the finished glyphs (同 円 内 用 司) has that
  hook, and house style rule 7 says so; the proposal missed it.
- 塩: the bottom bar of 皿 sticks out past the box (`14-44`), as in 皿 温 血.
- 緑: the owner joined two diagonals into one long stroke `11-44`.
- 典: both variants rejected. Both lost the separate bar under 曲. Leave it for
  conversation.

Fourth round (g4-g, 32 characters): 20 adopted as drawn, 11 adopted for fixing
(治 and 唱 were then finished unchanged), 1 rejected (軍). Most fixes again
copied a component from a finished glyph.

- 法: the owner rebuilt the 厶 hanging from the bottom bar of 土
  (`32-23; 23-24; 24-44; 43-44`), which is the variant I had removed for
  joining. 会 and 伝 hang 厶 from the bar above in the same way. **Do not drop a
  variant for a contact that a finished glyph already has.**
- 灯: the owner kept both the right stroke of 火 (`13-24`) and the hook of 丁
  (`24-34`), meeting at one point. Same priority as 固 and 英: keep defining
  strokes, accept the touch. Offer that variant next time.
- 連: rebuilt with the 車 of 庫: bar `20-40`, box `21-41-42-22` with a V inside
  (`21-32; 41-32`), bar `23-43`, vertical `30-34` from the top bar down to the
  bottom of ⻌. A blind reader had taken a similar shape for 運; the owner
  still wants the 庫 form. Copy the finished component first and treat the
  blind reading as a warning, not a veto.
- 失: the vertical runs to `23` and the legs are one-cell diagonals with
  horizontal tails (`23-14-04`, `23-34-44`). 欠 got the same legs last round,
  and 見 東 楽 交 園 already use them. **Legs that start on row 3 end in tails
  along the bottom**; long diagonals from row 2 (夫 大 天) are for legs that
  start at a bar on row 2.
- 令: the bar under the roof joins both roof legs (`11-31`); 卩 is `12-32`,
  `32-33`, `23-33` with the vertical `22-24`.
- 底: 氐 got the top stroke `21-31-40` up to the end of the 广 bar, a left
  vertical to the bottom (`21-24`), a bottom bar `14-34` under it and the flick
  `24-33`.
- 的: 勺 is a long ノ `30-12` that touches 白, a bar `21-41` starting from the
  middle of the ノ, the vertical `41-44` with hook `34-44`, and the dot `32-33`.
- 伝: the short top bar of 云 is still two cells (`21-41`).
- 児: 儿 hangs one row below 日 (`23-14`; `33-34-44-43`), not from it.
- 軍: both variants rejected. Retry with the 車 of 庫 under 冖.

Batch g5-a (34 characters) was picked differently: only characters whose
every top-level component already appears, in the same position, in a finished
glyph, and each component was copied from that glyph. The blind reader read 40
of 43. Its three misses are worth remembering: 季 without the legs of 禾 read
as 孝, 支 with the vertical of 十 stopping at the bar read as 文, and 攵 with a
vertical tick above its bar read as 支 (枚 as 枝); drawing the first stroke of
攵 as a diagonal onto the bar fixed it.

Fifth round (g5-a, 34 characters): 26 adopted as drawn, 7 adopted and fixed, 0
rejected; 老 was left half-fixed because of an app bug (erasing every line hid
the fixing panel; fixed with `AI案に戻す`). 軍 passed with the 車 of 庫 under
冖. Copying components from finished glyphs works; keep doing it.

- 径 経: the 又 of 圣 starts with its top bar `20-40`; without it the right side
  lost its roof (owner's note: 経 also lacks the top line).
- 現 視 続: the right leg of 儿 (in 見 and 売) is a vertical with a tail,
  `33-34-44`, not the diagonal `33-44`. In 続 the right vertical of the box
  above stops at `32` so the leg starts on its own.
- 香: the wings of 禾 are two-cell diagonals `21-03` and `21-43` that reach past
  the 日 below, not one-cell stubs.
- 胃: a 田 squeezed into one row gets the V `10-21-30` inside, so it does not
  read as 皿 or 罒.

Batch g5-b (49 characters, 61 variants) grew the batch as planned. Only eight
untouched characters had every component finished in the same position, so
most of the rest copy one side from a finished glyph and squeeze the other
into two columns; a few simple standalone characters (己 寸 示 干 尺 亡 史 非)
fill it out. The blind reader read 61 of 66. Dropped before sending: 閉 (both
variants read as 附 or 防; the 門 with a narrow 才 inside splits into 阝 and
寸), 紅 with 工 on rows 1..3 (read as 結) and 責 with stub legs (read as 建).
Kept with a warning: 納 read as 約, because 内 has one column inside.
句 went out by mistake although it was already 完成; it was withdrawn at once
by rejecting it with a note, and `push` now refuses characters that already
have edges unless `--replace` is given for a redraw the owner asked for.
Always take candidates from `feasible`-style lists of untouched glyphs, never
from memory.

Sixth round (g5-b, 49 characters): all adopted, 31 as drawn, 18 fixed, 0
rejected. 老 from g5-a was finished unchanged after `AI案に戻す`. The fixes:

- 関: the owner put back the diagonals of 門 (`00-11; 40-31`), so 丷 became the
  long lines `00-22; 40-22`. **Keep 門 as in 間 開 even when its diagonals line
  up with what hangs below.**
- 責: a 貝 squeezed into one row is a box with a V inside (`12-23; 32-23`) and
  the stub legs of 貝 itself (`04-14; 34-44`), not diagonal legs.
- 腸: the bottom of 日 joins the middle bar of 月 (`02-42`) and 勿 keeps all
  three diagonals (`32-14; 33-24; 43-34`), as in 場.
- 紅: 工 beside 糸 stands on the base line (`21-41; 31-34; 24-44`).
- 納: 人 inside a narrow 内 hangs from a vertical `30-32` with legs
  `32-23; 32-43` to the walls.
- 除: 余 on the right is roof `30-21; 30-41`, bars `21-41; 22-42`, vertical
  `31-34` and the two dots as short verticals `23-24; 43-44`.
- 判: 丷 of 半 is two short verticals (`00-01; 20-21`) beside a vertical from
  the top.
- 若: the ノ of 右 starts with a stub from the bar above (`21-22-04`).
- 念: 今 keeps its own bar `11-31` under the roof as well as `12-32`.
- 因: 大 inside 囗 keeps the stub up to the frame (`20-22`).
- 圧: 厂 here is `10-40; 10-13; 13-04`, starting one column in, like 广.
- 史: 口 on rows 1..2 (`11-31; 12-32; 11-12; 31-32`) with the vertical `20-23`
  through it, ノ `23-14`, and the right-falling stroke `12-34-44`.
- 在: 土 sits low (`23-43; 32-34; 24-44`).
- 宅: 乇 is ノ `31-22`, short bar `12-22`, long bar `03-43`, vertical `22-24`
  and `24-44`.
- 忘 別: shorter bars (`12-32` under 亡, `12-22` for 力).
- 易: the first stroke of 勿 runs from the left edge (`03-43; 03-04`).
- 特: 牜 is `10-01-02` with its bar `12-42` joining the second bar of 寺.

Batch g5-c (21 characters, 24 variants) is smaller on purpose: few
untouched characters are left whose parts can be copied, and the rest have
three or more stacked parts. It leans on the fixes of g5-b (則's 貝, 特's 牜,
在's 𠂇, 枚's 攵). The blind reader read 23 of 25. Dropped: 異 (田 with its
sides run down into 共 read as 典 or 具). Kept with a warning: 牧 read as 救.

Fixes from g5-c decided before the owner asked for the next batch (the rest
was still under review):

- 牧: 牜 has no lower bar of its own: `10-01-02`, bar `01-21` joined to 攵,
  vertical `10-14` and the rising stroke `22-04`.
- 祝: 兄 is 口 on rows 0..2 with 儿 hanging from it: right leg `32-34-44-43`,
  left leg `33-24`.
- 乱: 千 is `20-11`, short bar `01-11`, bar `02-22`, vertical `11-13`; 口 sits
  on rows 3..4.
- 再: 冂 is narrowed to x = 1..3 (`11-31; 11-14; 31-34`, hook `24-34`) so the
  long bar `03-43` sticks out on both sides.
- 任: 壬 keeps the tail of its ノ (`40-31; 21-31`), like 千.
- 布: 巾 sits centred under ナ: `12-32; 12-13; 32-33` with the vertical `20-24`
  from the top.
- 単: the top is three strokes (`00-11; 10-21; 40-31`), and 田 keeps two rows.
- 仏: both variants rejected (厶 drawn as an L with a diagonal into the corner).
  The finished 公 会 雲 draw 厶 as ノ, bar and a short vertical at the right
  end (`22-13; 13-14; 14-34; 33-34`); use that.

Batch g5-d (15 characters, 18 variants) answered a request from the app
sent while g5-c was still being reviewed. The blind reader read all 18. 仏 is
retried with the 厶 of 公; a large 厶 (an L with a tick) read as 化, so it stays
small in the lower right.

Rounds g5-c and g5-d finished: of 36 characters, 16 were adopted as drawn,
17 fixed and 3 rejected (仏 in g5-c, then 周 and 異). The fixes:

- 背: 北 is `00-10; 10-11; 01-11` on the left and `30-31; 31-41; 40-31` on the
  right; 月 below starts at `12-32`.
- 宝: the bottom bar of 玉 is the full width `04-44`.
- 弁: 厶 is drawn with the house 厶 laid flat on top (`10-01; 01-41; 40-41`) and
  廾 has its verticals cross the bar (`11-13-04; 31-34`).
- 株: the legs of 朱 start at the second bar (`32-23; 32-43`).
- 久: the first ノ runs to the edge (`20-02`).
- 永: a flat dot `10-20`, a short bar `11-21` into the top of the vertical,
  `02-22` then `22-04` on the left, and 水's crossing pair on the right.
- 仏 私: 厶 starts with a vertical `30-32` above its ノ
  (`30-32-23-24-44; 43-44`).
- 冊: four verticals under a bar `00-30`, the long bar `02-42` and a hook
  `23-34`.
- 料: 米 on the left is a V into the vertical (`00-11; 20-11`), bar `02-22`
  and legs from its crossing (`12-03; 12-23`); 斗 is 科's with the vertical at
  x = 3.
- 周: rejected, "looks like 固 or 同". A 同 with one more stroke is too close.
- 異: rejected, "probably impossible". Leave it.

Batch g5-e (6 characters, 8 variants): 精 (料's 米 with 晴's 青), 奈, 閉,
改, 囲 and 系. The blind reader read all 8, 閉 included this time. The pool of
elementary kanji whose parts can be copied is nearly used up; most of the
roughly 380 untouched ones have three or more stacked parts.

g5-e: all 6 adopted; 精 改 囲 as drawn. The fixes:

- 奈: the legs of 大 run long (`21-03; 21-43`) through the ends of 示's first
  bar, and 示 gets its hook `14-24`.
- 閉: 才 inside 門 is a bar `13-33`, a vertical `22-24` and a ノ `23-14`.
- 系: a shorter top `10-30`, 幺 as `20-11; 11-22; 21-12; 31-42`, and no
  `34-44`.

Batch g6-a (20 characters) starts on the dense ones, as the owner asked:
茨 害 覚 管 器 求 漁 郡 営 舎 往 保 灰 皇 宣 並 佐 借 松 省, one variant each,
built from finished parts (the top of 学 労, 都's 阝, 球's 求, 念's 今, 圧's 厂)
with bold omissions. The blind reader read 19 of 20; 覚 with 目 cut down to
口 read as 党, so 目 got its middle bar back before sending.

g6-a (first dense batch): all 20 adopted, 8 as drawn (覚 管 器 営 往 保 灰 並),
12 fixed, 0 rejected. Dense characters work. The fixes:

- **A 日 or 目 squeezed into one row gets a V inside** (`11-22; 31-22` style),
  as in 胃 and 責: the owner added it to 皇, 宣 and 借. Do it from the start.
- 害: 丰 is `11-31; 12-32` plus the long bar `03-43` that is also the top of
  口, with the vertical `20-23` from the roof down.
- 舎: the vertical of 干 runs from the roof's apex (`20-22`) to a long bar
  `02-42`; 口 below is separate.
- 皇: 白 is ノ `20-11` and a one-row box with a V; its bottom runs out as the
  first bar of 王 (`02-42`).
- 借: 龷 is two bars `11-41; 12-42` crossed by `20-22; 30-32`; 日 is one row
  with a V.
- 求: like 水 under a bar: `01-12` and `13-04` on the left, `41-32` and
  `22-44` on the right, dot `30-41`.
- 漁: 𠂊 on top of 魚 is `30-40; 30-21; 40-31`, and 灬 keeps four dots.
- 郡: 君's middle bar joins 阝 (`01-31`) and 阝 closes its lower bulge
  (`32-43-34`).
- 茨: the left stroke of 欠 runs down to `23`.
- 佐: the ノ of ナ is two cells (`31-13`) and crosses the top of 工.
- 松: the right stroke of 八 is a short vertical `41-42`.
- 省: 少 keeps its long ノ `30-03` across the top; 目 sits on rows 2..4.

Batch g6-b (14 dense characters): 芽 賀 希 景 菜 笑 置 票 厚 査 災 述 堂 党,
drawn with the g6-a lessons from the start (one-row 日 with a V, legs of 木
running through the part below as in 奈). The blind reader read all 14.

g6-b: all 14 adopted, 7 as drawn (賀 景 置 票 厚 査 党), 7 fixed:

- 笑 災: **the old rule again: legs that start on row 3 end in tails along the
  bottom** (`23-14-04; 23-34-44`). I forgot it for 夭 and 火; check every
  pair of legs against it before sending.
- 災: 巛 is three く (`10-01-12; 20-11-22; 30-21-32`); 火 below has its dots
  `02-13; 42-33` and the vertical `22-23`.
- 希: 㐅 is a big X `10-32; 30-12`, then ナ (`02-42; 22-04`) and 巾 on rows
  3..4 with the vertical `22-24`.
- 芽: 牙 is three bars (`01-41; 02-42; 03-43`), the short left stroke `12-13`,
  the vertical `32-34` with hook `24-34`, and ノ `23-14`.
- 述: 朮 in two columns has its dot `30-41` and short verticals for legs
  (`22-23; 42-43`).
- 堂: 口 hangs from the bar of 冖 (`11-12; 31-32; 12-32`), then 土 with its
  vertical from the bottom of 口.
- 菜: 爫 as `02-32; 02-13; 41-32; 42-33`.

Batch g6-c (9 dense characters): 阪 設 吸 要 仮 洗 律 争 無, copying parts the
owner finished meanwhile (坂's 反, 役's 殳, 級's 及, 安's 女). The blind reader
read all 9.

g6-c: all 9 adopted, 4 as drawn (阪 設 吸 律), 5 fixed:

- 要: 覀 keeps two rows (`00-40`; box `01-41-42-02` with `10-12; 30-32`);
  女 below is `22-13-24`, bar `03-43`, ノ `32-14` and ticks `04-14; 24-44`.
- 仮: 反 keeps its sweep `23-14` even where it meets the bottom of 亻.
- 洗: 先's right leg is 乚 from the top (`30-34-44-43`), the left leg `33-24`.
- 争: 彐 is narrow (`11-31; 13-33; 31-33`) with only the middle bar long.
- 無: the ノ runs to the edge (`20-02`), the bar starts at x = 1 (`11-41`), and
  灬 keeps four dots.

Batch g6-d (7 characters): 飯 賞 常 割 机 捨 泉. The blind reader read 5 of
7: 賞 without the 口 of 尚 read as 覚, and 捨 read as 拾 because the vertical
of 干 merged into the roof. Both were fixed before sending (口 put back; the
vertical runs from below the roof through the bar to 口).

g6-d: 6 of 7 adopted (常 泉 as drawn), 賞 rejected without a comment. Fixes:

- 飯: 反's left side runs to the bottom (`20-24`) and loses its sweep; 飠 and
  反 share that line.
- 割: the vertical of 害 stops at the bar (`10-12`) instead of entering 口.
- 机: 几 is `20-30` on top, a left leg `20-23-14` and a right leg
  `30-34-44-43`.
- 捨: 舎 keeps the bar under its roof (`01-41`, joined to 扌) and the vertical
  `30-32` from the apex.
- 賞: rejected; 尚 over a squeezed 貝 is too much for four rows. Leave it.

Batch g6-e (8 characters): 飼 械 差 刷 試 初 張 状. Bold omissions, said in
the notes: 廾 of 戒, 工 of 式, the extra dot of 衤. The blind reader read all
8 (械 with low confidence).

g6-e: all 8 adopted (飼 状 as drawn). **Every component I left out came back
in the fix**: 械 got 廾 (`12-32; 21-23`), 試 got 工 (`12-32; 22-23`) and the
ノ of 戈 (`32-14`), 初 got the extra dot of 衤 (`22-13`). So do not drop a
component to make room; squeeze it in, even as a single stroke. Also:

- 差: 工 is `13-33`, `23-24` and a full-width bottom `04-44`.
- 刷: the right side of 巾 stops at `23`.
- 張: 長's long bar joins 弓 (`03-43`), with `24-34`, `43-34` and `33-44`
  below.

Batch g6-f (6 characters): 側 浴 浅 銭 誌 授. The blind reader read all 6.
Only one stroke is left out (the short stroke of 刂 in 側, which has no
column left).

Batch g7 (32 characters, 35 variants) was drawn by four subagents with the
brief in this file, 8 characters each, and pushed without a blind reading at
the owner's request. Roughest: 潔 夢 費 減 健 順.

First g7 decisions (健 岐 種 賃 順; g6-f was all adopted meanwhile):

- 順: the third stroke of 川 is the left side of 頁 run full height (`20-24`),
  with `00-04` and a short `11-13`. Shared lines solve "three strokes in two
  columns".
- 健: 聿's bars reach left to the 亻 (`11-41; 12-42`) with the vertical
  `30-34`; 廴 is `21-12`, `13-24` and `23-14` along the bottom.
- 岐: 又 keeps its full bar `22-42`, and its right-falling stroke starts at
  the bar's left end (`22-44`).
- 種: 重 starts with a ノ off a short top bar (`30-40; 30-21`).
- 賃: rejected without a comment (任 over a squeezed 貝).

Batches g8-e to g8-m (72 characters, about 80 variants) were drawn overnight
by nine subagents, eight characters each, each pushing its own file as soon
as it passed `check` (no blind reading). This covers the rest of grade 4,
including 愛 億 熊 鹿 and a third try at 典 with the separate bar under 曲.
The subagents' reports list what they left out or joined; expect fixes on
熱 栃 飛 街 潟 願 挙 輪 類 養 and the shared lines in 協 競 群.

g7 and g8, first decisions (11 of them): 積 説 巣 adopted as drawn; 孫 帯 節
戦 選 然 倉 adopted with fixes; 隊 still being fixed.

- 孫: when the left part's top bar and the right part's top sit on the
  same row, they become one line across (`00-40`). 系's right side ends in a
  short vertical (`41-42`), not a slant.
- 帯: the top part uses the top row too: `00-40` and `11-31`, with the three
  short verticals crossing `11-31`.
- 節: 卩 on the right is `31-41; 41-43; 31-34` with a slant inside
  (`32-43`), not a short bar.
- 戦: 単 squeezed into three columns keeps its ツ as two ╲ and one ╱
  (`00-11; 10-21; 20-11`), its 十 runs from row 1 (`11-14`), and it gets a
  base (`04-24`). 戈's dot stays (`40-41`).
- 選: each 己 of 巳巳 is a top bar, a slant down-left and the inner bar
  (`10-20; 20-11`, `30-40; 40-31`); 共 is `02-42`, the verticals `21-23`
  and `31-33`, and `13-43`.
- 然: the 夕 with its dot on the upper left is two crossed pairs of slants
  (`00-11; 10-01` and `01-12; 20-02`) under a short top bar `10-20`.
- 倉: 戸 inside 人 gets its left side full height (`11-14`) and a V
  (`11-22; 31-22`); 口 sits on the bottom row (`14-34`).
- Dots that tell a component apart stay (衤 in 初, 戈 in 戦). Redraw pending
  proposals whose notes say such a dot was left out (戈 in 議 and 夕 in 夢
  went to batch g9-r).

Next decisions: 達 adopted as drawn; 兆 典 努 働 徳 栃 梨 adopted with fixes;
熱 still being fixed.

- 典 (third try): 「なんで上と下が離れてんの?」. Parts stacked in one
  character touch; no empty row between them. 曲 is `01-31; 02-32`, the
  verticals `10-13; 20-23`, the sides `01-03; 31-33`, and its bottom is the
  long bar `03-43`, with the legs `13-04; 23-34`.
- 梨: 木 at the bottom pokes up one row to touch what is above (`22-23`, as
  集 楽 業 薬). The owner added exactly that line, plus 禾's top ノ `10-01`.
  Before pushing, check that no row band is crossed by nothing when the
  parts are meant to touch (賀, with 貝 hanging under 加, is the exception).
- 兆: the dot at the top left is a slant (`00-11`), not a vertical stub.
- 努: 力 at the bottom starts its ノ as a short vertical above the bar and
  slants below it (`22-23; 23-14`), as in 男 and 労.
- 徳: 十 over 罒 keeps its own bar (`20-40`); it does not share 罒's top.
- 栃: 木's bar and the top bar of 万 become one line (`01-41`), as in 孫.
- 働: 重 starts with a slant from the top (`20-11`) onto a bar that runs to
  the left edge (`01-41`), and sits on a base `04-24`.

Then: 必 標 飛 adopted with fixes, 府 being fixed, and 熱 博 adopted, worked
on, then given up (`やめて却下`, no comment).

- 必: 心's dots are short verticals (`11-13`, `31-32`), the ノ runs
  `32-14` through it, and the hook sits on `04-14`.
- 標: 示 at the lower right spreads 小 from the bar like 木's legs
  (`33-24; 33-44` with `33-34`), as in 票 and 宗. 祭 and 察 keep the stubs on
  the bottom row.
- 飛: redrawn by the owner as two columns of short verticals (`10-13`,
  `20-24`, `30-34`) between `00-30` and `02-42`, with slants on the right
  (`31-42; 42-33`, `40-31`) and `10-01`, `13-04` on the left.
- 熱: before giving up, the owner had moved 丸's cross down to `22-44;
  32-23` and given 坴 a top bar `00-20` over `10-13`. Retry from there.

Then: 副 adopted as drawn; 府 阜 富 変 便 adopted with fixes; 望 being fixed.

- 府: 广 keeps its dot. The owner redrew the 庫 form (roof on row 0, no dot)
  into the 店 form: roof `01-41` across row 1, the dot `20-21` above it,
  the left side `01-04` full height. Without the dot 广 reads as 厂. 付
  inside is `21-03; 12-14` and 寸 `22-42; 31-34; 24-34` with the dot
  `22-33`. 康 and 鹿, which had dropped the dot, went to a redraw.
- 富: a 田 on the bottom row that spans the full width is a wide box with
  one divider (`03-43; 04-44; 03-04; 43-44; 23-24`), no V; the 口 above
  shares its bottom with the 田's top.
- 変: 亦's outer strokes are slants (`11-02`, `31-42`), not short verticals.
- 便: 更's vertical runs through the 日 from the top bar (`30-33`).
- 阜: the inner box's right side stops at the middle bar (`31-32`).

Then: 勇 量 輪 類 adopted as drawn; 満 陸 養 例 adopted with small fixes; 液
being redrawn by the owner.

- 陸: the upper 土 of 坴 keeps its top bar (`20-40`); shrinking 土 to a 十
  is dropping a stroke.
- 満: 両 keeps its 人人 as an X inside the box (`21-32; 31-22`).
- 養: 食's bar runs the full width (`01-41`) and 艮's legs cross at the
  lower right.

Then: 価 快 基 adopted with fixes (価 redrawn); 潔 being fixed; 液 隊 府 望
finished after long fixes.

- 価: 亻 takes a single column (`10-01; 01-04`) so 西 gets three: its top
  bar `11-41`, the box `12-42; 14-44; 12-14; 42-44`, and the two inner
  verticals running from the top bar to the bottom (`21-24; 31-34`).
- 快: 忄's right dot slants down to the right from the vertical (`11-22`);
  情 and 性 got the same fix, so 忄 is `10-14; 01-02; 11-22`.
- 基: 其 is a two-row box under a bar on the top row (`00-40`), with a V in
  each row (`10-21; 30-21`, `11-22; 31-22`), as in 期; 土's vertical rises
  to touch it (`22-24`).

Then: 個 効 鉱 adopted as drawn; 減 潔 adopted with fixes; 混 being fixed.

- 減: 咸 is 厂 (`11-41; 11-14`) holding 一 and 口 against its left side
  (`12-22`, `13-23; 14-24; 23-24`), with 戈 on the right: `30-33`, the
  slant `33-44`, the ノ `42-24`, the dot `30-41` and the hook `43-44`.
- 潔: the owner redrew 糸 under 丰刀 (`31-22; 32-23` with `31-42; 32-43;
  33-44` and the bar `23-43`); copy the finished glyph for 糸 squeezed into
  the lower right.

Then: 似 adopted as drawn; 混 際 資 序 adopted with fixes; 賞 (fourth try,
the 堂 top over a two-row 目) adopted and being fixed.

- 資: 欠 in 次 keeps the hook as a short vertical (`30-31`) and 人 starts
  from it (`31-22; 31-42`), as in the finished 次. 姿, still pending, was
  redrawn that way (g10-r).
- 序: 予's マ is a single slant under the bar (`31-22`), and its top bar
  runs to the left edge (`02-42`) to meet 广's side.
- 混: 氵 squeezed beside 日 and 比 became two short bars `01-11; 02-12`
  over the slant `13-04`.
- 際: 祭's top right is three short verticals under `20-40` with the slants
  `20-42; 21-32; 31-22; 41-32`.

Then: 税 績 絶 adopted as drawn; 情 性 制 賞 adopted with fixes; 素 being
fixed.

- 情 性: 忄's right dot fixed to `11-22`, as in 快.
- 制: the top of 制 gets its short left bar (`01-11`) beside the ノ.
- 賞: 貝 under 尚 is a one-row box (`12-32; 13-33`) with two ╲ inside
  (`12-23; 22-33`) instead of a V, and its legs are stubs on the bottom row
  (`04-14; 34-44`), as in 賀.

Then: 貸 銅 導 破 adopted as drawn (導 with the empty one-row 自); 素 測 団
燃 adopted with fixes; 費 being fixed.

- 素: 小 under 糸 on the bottom row is the centre stub `23-24` with the
  side strokes as stubs `04-14; 34-44`, like 貝's legs.
- 測: 貝's legs spread outward from its bottom corners (`23-14; 33-44`).
- 団: 寸's bar reaches the right side of 囗 (`11-41`).
- 燃: 灬 under the narrow 然 is three short verticals (`23-24; 33-34;
  43-44`), as in 馬; full-width 灬 stays the four slants of 然 and 点.

Then: 評 粉 報 adopted as drawn; 貧 墓 夢 adopted with fixes; 容 being fixed;
費 and 豊 rejected without a comment.

- 容: the owner moved 宀's roof down to row 1 to give it its dot (`20-21`).
  Most finished 宀 keep the dot (字 家 安 客 実 守 宿 定 害 完 宇 宗 宅 宝 空
  究 案); only the tightest drop it (官 富 宮 室). 額 and 察, which had
  dropped it, went to a redraw with the dot first (g10-r2).
- 墓: 大's legs run from its bar through 土 to the bottom corners
  (`22-13-04; 22-33-44`), as 木's legs run through 奈 and 査.
- 貧: 分's 刀 bends as `21-32` with the ノ `22-13`.
- 夢: the owner chose the narrower 罒 under 艹 (as 草), and gave 夕 a base
  `14-24`.
- 豊: the 曲 without its middle bar, sitting straight on 豆's 口, was
  rejected; retry with the 曲 of 典.

When a hand fix fails, the owner can now press `やめて却下` in the app: the
glyph goes back to what it held before adoption and the proposal becomes
rejected with `triedVariant` set. `harvest` records it as a rejection.

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

1. **Real character, real weight.** `check --sheet` puts the real glyph beside
   the variants and draws them as the app's preview does: strokes about 0.46
   of a cell wide and no grid, which is how the font is actually read. The
   owner asked for this; thin lines on a grid hide how close strokes sit and
   how small a one-row box becomes. Judge, and let critics judge, on these
   sheets. Add `--grid` only when you need to read exact edges. Compare joins,
   crossings and proportions stroke by stroke.
2. **Shape rank.** `score <batch>` ranks each variant against every elementary
   kanji in a system font. Hand-made glyphs come first 60% of the time and in
   the top ten 90%, so a rank beyond ten, or a look-alike listed first (同 for
   a 岡), means the variant reads as something else. It says nothing about
   joins or crossings. Characters with 氵 rank badly even when the owner drew
   them (温 226, 汽 160, 泳 139, 漢 107), so for those lean on the blind
   reading instead. `--ocr` adds Windows OCR, which read only 15% of the
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
   owner had rejected, so passing proves little. In batch g4-g it read 50 of
   52; both misses were 連 read as 運, because the top bar of 車 sat on the top
   row and looked like the roof of 冖. Letting the vertical of 車 stick out
   above its top bar (as 庫 does) fixed it. Large batches go in two sheets of
   about 26 tiles at `cell` 34.
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
python tools/glyph_proposals.py wait                 # blocks until the owner has reviewed everything
```

The owner reviews on the phone and cannot message the session from there, so
the standing go-ahead is: after pushing a batch, start `wait` in the
background (it checks the server every minute and survives network errors).
It exits when the queue is empty, or when the owner presses 次の組を頼む in the
app's AIへの依頼 box; then it prints the owner's note, which is an instruction
for this round (batch size, characters to do, anything else). Pull, harvest,
record what the decisions teach, draw the next batch, review it, push it (that
marks the request handled), and start `wait` again. A character left
undecided in the app keeps `wait` waiting unless the owner sends a request;
that is the owner's way to pause the loop.

**Stream, do not batch.** The owner finds the waiting too long: push each
group as soon as it is drawn (a few characters at a time is fine), skip the
blind reading when it would hold things up, and come back to the unsure ones
when the owner's fixes and rejections say what was wrong. Drawing can be
split among subagents; push each one's file as it arrives.

**Keep about 100 waiting, and redraw them as the lessons arrive.** The owner
reviews on the train and rarely gets through more than 100 in one sitting, so
keep the pending queue near 100 and no further. Run `wait --after 5`; each
time it fires:

1. `pull`, `harvest`, read the fixes and rejections, and record what they
   teach under "Decisions so far".
2. Redraw the pending proposals a new lesson applies to (`find` lists the
   kanji with a component; keep the pending ones drawn before the lesson).
   Pushing a character that is still pending replaces it quietly: the server
   keeps the older version, so a decision the owner makes on it from a phone
   that loaded it earlier still counts (`harvest` names those, and the redraw
   can be sent again). Do not announce redraws; the note describes the new
   shape like any other. `push` refuses adopted proposals, which are the
   owner's hand fixes in progress.
3. Retry rejected characters once the comments or later fixes say what was
   wrong.
4. Top the queue back up to about 100 with new characters, then start
   `wait --after 5` again.

Nothing comes out right in one go anyway; the fixes teach as they arrive.

**Stop at the elementary kanji.** The owner will review the whole set once
all 1026 elementary kanji are drawn and decided, before anything beyond them
(常用, 人名用, the rest of JIS level 1). When no undrawn elementary kanji are
left, keep up the redraws and retries and draw nothing new.

**Do not ask the owner anything in the conversation.** The point of the loop
is that the owner works only in the app; a question in the chat stalls it.
When a choice comes up, make it, and say what was chosen in the variant
`note` the owner sees in the app (offer both sides as variants when it is a
real trade-off). Hard characters are not optional either: every kanji in the
project has to be drawn sooner or later, so when the easy ones run out, move
on to the dense ones with bold omissions rather than stopping to ask.

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
7. A hook is one cell: `44-34` at the bottom of a right vertical (刂 月 円, and
   every 冂), or a one-cell upturn for 乚 and the end of 氏 (`43-44`).
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
