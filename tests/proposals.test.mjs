import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { applyProposalBatch, applyProposalDecision, emptyProposalDoc, isValidEdgeId } from "../proposals.mjs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function contextFor(names, globals) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, name);
    const end = source.indexOf("\n}", start) + 2;
    vm.runInContext(source.slice(start, end), context);
  }
  return context;
}

const batch = (items) => ({ batch: "t", items });
const variant = (...activeEdges) => ({ activeEdges, source: "model-a" });

test("batches are validated and stored as pending proposals", () => {
  const empty = emptyProposalDoc();
  const { doc, chars } = applyProposalBatch(empty, batch([{ char: "路", note: "n", variants: [variant("h-0-0", "d2-3-3", "h-0-0")] }]), "T1");
  assert.deepEqual(chars, ["路"]);
  assert.deepEqual(doc.items["路"].variants[0], { activeEdges: ["h-0-0", "d2-3-3"], note: "", source: "model-a" });
  assert.equal(doc.items["路"].status, "pending");
  assert.deepEqual(doc.items["路"].grid, { cols: 4, rows: 4 });
  assert.equal(doc.revision, 1);
  assert.deepEqual(empty.items, {}, "the stored document is not mutated");

  assert.equal(isValidEdgeId("h-3-4", 4, 4), true);
  for (const bad of ["h-4-0", "v-0-4", "d1-4-0", "d2-0-4", "p-1-1", "h-1", 7]) assert.equal(isValidEdgeId(bad, 4, 4), false, String(bad));
  for (const items of [
    [],
    [{ char: "路", variants: [] }],
    [{ char: "路", variants: [variant("h-9-9")] }],
    [{ char: "路道", variants: [variant("h-0-0")] }],
    [{ char: "路", variants: Array.from({ length: 9 }, () => variant("h-0-0")) }]
  ]) {
    assert.throws(() => applyProposalBatch(empty, batch(items)), (error) => error.status === 400);
  }
});

test("decisions record the choice and a new batch keeps the last verdict", () => {
  let { doc } = applyProposalBatch(emptyProposalDoc(), batch([{ char: "路", variants: [variant("h-0-0"), variant("v-0-0")] }]), "T1");
  assert.throws(() => applyProposalDecision(doc, { char: "道", status: "rejected" }), (error) => error.status === 404);
  assert.throws(() => applyProposalDecision(doc, { char: "路", status: "adopted", variant: 2 }), (error) => error.status === 400);
  assert.throws(() => applyProposalDecision(doc, { char: "路", status: "done" }), (error) => error.status === 400);
  assert.throws(() => applyProposalDecision(doc, { char: "路", status: "rejected", createdAt: "T0" }), (error) => error.status === 409);

  doc = applyProposalDecision(doc, { char: "路", status: "adopted", variant: 1, final: true, comment: " ok ", createdAt: "T1" }, "T2");
  assert.deepEqual(
    { status: doc.items["路"].status, chosen: doc.items["路"].chosen, final: doc.items["路"].final, comment: doc.items["路"].comment, decidedAt: doc.items["路"].decidedAt },
    { status: "adopted", chosen: 1, final: true, comment: "ok", decidedAt: "T2" }
  );

  doc = applyProposalDecision(doc, { char: "路", status: "rejected", comment: "右が重い" }, "T3");
  assert.equal(doc.items["路"].chosen, null);
  ({ doc } = applyProposalBatch(doc, batch([{ char: "路", variants: [variant("h-1-1")] }]), "T4"));
  assert.equal(doc.items["路"].status, "pending");
  assert.equal(doc.items["路"].previous.comment, "右が重い");
  assert.equal(doc.items["路"].previous.status, "rejected");
});

test("the review queue lists pending proposals for the current grid only", () => {
  const ctx = contextFor(["pendingProposalFor", "adoptedUnfinishedProposalFor", "reviewQueueIndexes", "getVisibleGlyphs", "applyProposalDecisionLocally"], {
    GRID_COLS: 4, GRID_ROWS: 4,
    splitGraphemes: (text) => [...text],
    matchesFolderFilter: () => true, matchesKanjiGrade: () => true,
    state: {
      glyphSearch: "", proposalFilter: true, folderFilter: "all",
      glyphs: [
        { char: "一", status: "未完成", activeEdges: new Set() },
        { char: "路", status: "未完成", activeEdges: new Set() },
        { char: "和", status: "完成", activeEdges: new Set(["h-0-0"]) },
        { char: "A", status: "未完成", activeEdges: new Set() }
      ],
      proposals: new Map([
        ["路", { char: "路", status: "pending", createdAt: "T1", variants: [variant("h-0-0")] }],
        ["和", { char: "和", status: "adopted", variants: [variant("h-0-0")] }],
        ["A", { char: "A", status: "pending", grid: { cols: 6, rows: 6 }, variants: [variant("h-0-0")] }]
      ])
    }
  });
  assert.deepEqual(Array.from(ctx.getVisibleGlyphs(), ({ index }) => index), [1]);
  ctx.state.glyphSearch = "一";
  assert.deepEqual(Array.from(ctx.getVisibleGlyphs(), ({ index }) => index), [0], "search still reaches every glyph");
  ctx.state.glyphSearch = "";

  ctx.applyProposalDecisionLocally(ctx.state.proposals, { char: "路", createdAt: "T0", status: "rejected" });
  assert.equal(ctx.reviewQueueIndexes().length, 1, "a decision for a replaced proposal is ignored");
  ctx.applyProposalDecisionLocally(ctx.state.proposals, { char: "路", createdAt: "T1", status: "rejected", variant: null, comment: "" });
  assert.equal(ctx.reviewQueueIndexes().length, 0);

  // Adopted for hand-fixing: the glyph stays in the queue until it is marked finished.
  ctx.state.glyphs[2].status = "未完成";
  assert.deepEqual(Array.from(ctx.getVisibleGlyphs(), ({ index }) => index), [2]);
  ctx.state.glyphs[2].status = "完成";
  assert.equal(ctx.reviewQueueIndexes().length, 0);
});

test("adopting writes the chosen variant through glyph history and queues the decision", () => {
  const glyph = { char: "路", status: "未完成", activeEdges: new Set(["v-4-0"]), lockedEdges: new Set(), activePoints: new Set(["p-1-1"]), candidateScores: { x: 1 } };
  const calls = [];
  const queue = [];
  const ctx = contextFor(["pendingProposalFor", "adoptedUnfinishedProposalFor", "selectedProposalIndex", "applyProposalDecisionLocally", "decideProposal"], {
    GRID_COLS: 4, GRID_ROWS: 4,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    currentGlyph: () => glyph,
    isAllowedEdgeIdForGlyph: (id) => id !== "h-9-9",
    withHistory: (fn, target) => { calls.push(["history", target.char]); fn(); },
    queuedProposalDecisions: () => queue,
    saveQueuedProposalDecisions: () => calls.push(["saved"]),
    flushProposalDecisions: () => calls.push(["flush"]),
    goToNextProposal: () => calls.push(["next"]),
    syncAllControls: () => calls.push(["sync"]),
    renderAll: () => calls.push(["render"]),
    els: { proposalComment: { value: " 左を細く " } },
    state: {
      proposalChar: "路", proposalVariant: 1,
      proposals: new Map([["路", { char: "路", status: "pending", createdAt: "T1", variants: [variant("h-0-0"), variant("h-1-1", "h-9-9", "d1-0-0")] }]])
    }
  });

  ctx.decideProposal("adopted", false);
  assert.deepEqual([...glyph.activeEdges], ["h-1-1", "d1-0-0"]);
  assert.deepEqual([...glyph.lockedEdges], ["h-1-1", "d1-0-0"]);
  assert.equal(glyph.activePoints.size, 0);
  assert.equal(glyph.status, "未完成", "adopt-and-edit leaves the status to the reviewer");
  assert.equal(queue.length, 1);
  assert.deepEqual(
    { char: queue[0].char, createdAt: queue[0].createdAt, status: queue[0].status, variant: queue[0].variant, final: queue[0].final, comment: queue[0].comment },
    { char: "路", createdAt: "T1", status: "adopted", variant: 1, final: false, comment: "左を細く" }
  );
  assert.deepEqual(calls.map(([name]) => name), ["history", "saved", "flush", "sync", "render"]);
  assert.equal(ctx.pendingProposalFor("路"), null, "a decided proposal leaves the queue at once");
  ctx.decideProposal("adopted", true);
  assert.equal(queue.length, 1, "finishing an adopted glyph sends no second decision");
  assert.equal(glyph.status, "完成", "the finish button marks the hand-fixed glyph finished");
  assert.equal(calls.at(-1)[0], "next");
});

test("the proposals API never touches the shared project file", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "trace-logo-proposals-"));
  const project = JSON.stringify({ version: 2, revision: 7, glyphs: [{ char: "路", activeEdges: [] }] });
  writeFileSync(join(dataDir, "shared-project.json"), project);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = spawn(process.execPath, [fileURLToPath(new URL("../local-server.mjs", import.meta.url)), String(port), dataDir], { stdio: ["ignore", "pipe", "inherit"] });
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("exit", () => reject(new Error("server exited")));
    });
    const base = `http://127.0.0.1:${port}/api/proposals`;
    const post = (url, body) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    let response = await fetch(base);
    assert.equal(response.headers.get("x-trace-logo-api"), "1");
    assert.deepEqual((await response.json()).items, {});

    response = await post(base, batch([{ char: "路", variants: [variant("h-0-0"), variant("v-0-0")] }]));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).chars, ["路"]);
    assert.equal((await post(base, batch([{ char: "路", variants: [variant("h-9-9")] }]))).status, 400);
    assert.equal((await post(base, "not a batch")).status, 400);
    assert.equal((await post(`${base}/decide`, { char: "道", status: "rejected" })).status, 404);

    response = await post(`${base}/decide`, { char: "路", status: "adopted", variant: 1, comment: "ok" });
    assert.equal((await response.json()).proposals.items["路"].chosen, 1);
    const stored = JSON.parse(readFileSync(join(dataDir, "proposals.json"), "utf8"));
    assert.equal(stored.items["路"].status, "adopted");
    assert.equal(stored.revision, 2);
    assert.equal(readFileSync(join(dataDir, "shared-project.json"), "utf8"), project);
  } finally {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
