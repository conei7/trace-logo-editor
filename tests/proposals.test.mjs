import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { applyProposalBatch, applyProposalDecision, applyProposalRequest, emptyProposalDoc, isValidEdgeId, normalizeProposalDoc } from "../proposals.mjs";

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

  doc = applyProposalDecision(doc, { char: "路", status: "adopted", variant: 1, replacedEdges: ["v-4-0", "h-9-9", "v-4-0"] }, "T2");
  assert.deepEqual(doc.items["路"].replacedEdges, ["v-4-0"], "the edges the adoption replaced are kept, cleaned");
  doc = applyProposalDecision(doc, { char: "路", status: "rejected", comment: "右が重い" }, "T3");
  assert.equal(doc.items["路"].chosen, null);
  assert.equal(doc.items["路"].triedVariant, 1, "rejecting after adoption remembers the variant that was tried");
  ({ doc } = applyProposalBatch(doc, batch([{ char: "路", variants: [variant("h-1-1")] }]), "T4"));
  assert.equal(doc.items["路"].status, "pending");
  assert.equal(doc.items["路"].previous.comment, "右が重い");
  assert.equal(doc.items["路"].previous.status, "rejected");
});

test("a request from the app waits until the next batch arrives", () => {
  let doc = applyProposalRequest(emptyProposalDoc(), { note: "  次は50字で  " }, "T1");
  assert.deepEqual(doc.request, { requestedAt: "T1", note: "次は50字で", handledAt: null });
  assert.equal(doc.revision, 1);
  assert.deepEqual(normalizeProposalDoc(JSON.parse(JSON.stringify(doc))).request, doc.request, "the request survives a reload");
  doc = applyProposalRequest(doc, {}, "T2");
  assert.deepEqual(doc.request, { requestedAt: "T2", note: "", handledAt: null }, "a newer request replaces the older one");
  ({ doc } = applyProposalBatch(doc, batch([{ char: "路", variants: [variant("h-0-0")] }]), "T3"));
  assert.equal(doc.request.handledAt, "T3", "pushing a batch handles the request");
  ({ doc } = applyProposalBatch(doc, batch([{ char: "道", variants: [variant("h-0-0")] }]), "T4"));
  assert.equal(doc.request.handledAt, "T3", "a handled request keeps its time");
  assert.equal(normalizeProposalDoc({ items: {} }).request, undefined);
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
  ctx.state.glyphs[2].activeEdges = new Set();
  assert.deepEqual(Array.from(ctx.getVisibleGlyphs(), ({ index }) => index), [2], "erasing every line keeps it in the queue");
  ctx.state.glyphs[2].status = "完成";
  assert.equal(ctx.reviewQueueIndexes().length, 0);
});

test("adopting writes the chosen variant through glyph history and queues the decision", () => {
  const glyph = { char: "路", status: "未完成", activeEdges: new Set(["v-4-0"]), lockedEdges: new Set(), activePoints: new Set(["p-1-1"]), candidateScores: { x: 1 } };
  const calls = [];
  const queue = [];
  const ctx = contextFor(["pendingProposalFor", "adoptedUnfinishedProposalFor", "adoptedVariantEdges", "selectedProposalIndex", "applyProposalDecisionLocally", "sendProposalDecision", "restoreAdoptedProposal", "giveUpAdoptedProposal", "decideProposal"], {
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
  assert.deepEqual(Array.from(queue[0].replacedEdges), ["v-4-0"], "the decision carries what the glyph held before");
  ctx.decideProposal("adopted", true);
  assert.equal(queue.length, 1, "finishing an adopted glyph sends no second decision");
  assert.equal(glyph.status, "完成", "the finish button marks the hand-fixed glyph finished");
  assert.equal(calls.at(-1)[0], "next");
});

test("giving up on a hand fix puts the glyph back and rejects the proposal", () => {
  const glyph = { char: "路", status: "未完成", activeEdges: new Set(["v-4-0"]), lockedEdges: new Set(), activePoints: new Set(), candidateScores: {} };
  const queue = [];
  const history = [];
  let answer = false;
  const els = { proposalComment: { value: "" } };
  const ctx = contextFor(["pendingProposalFor", "adoptedUnfinishedProposalFor", "adoptedVariantEdges", "selectedProposalIndex", "applyProposalDecisionLocally", "sendProposalDecision", "restoreAdoptedProposal", "giveUpAdoptedProposal", "decideProposal"], {
    GRID_COLS: 4, GRID_ROWS: 4,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    currentGlyph: () => glyph,
    isAllowedEdgeIdForGlyph: () => true,
    withHistory: (fn, target) => { history.push(target.char); fn(); },
    queuedProposalDecisions: () => queue,
    saveQueuedProposalDecisions: () => {},
    flushProposalDecisions: () => {},
    goToNextProposal: () => {},
    syncAllControls: () => {},
    renderAll: () => {},
    window: { confirm: () => answer },
    els,
    state: {
      proposalChar: "路", proposalVariant: 0,
      proposals: new Map([["路", { char: "路", status: "pending", createdAt: "T1", variants: [variant("h-0-0")] }]])
    }
  });

  ctx.decideProposal("adopted", false);
  glyph.activeEdges.add("h-2-2");
  ctx.decideProposal("rejected", false);
  assert.equal(queue.length, 1, "nothing changes when the reviewer cancels the confirmation");
  assert.equal(glyph.activeEdges.has("h-2-2"), true);

  answer = true;
  els.proposalComment.value = " 直せない ";
  ctx.decideProposal("rejected", false);
  assert.deepEqual([...glyph.activeEdges], ["v-4-0"], "the edges from before adoption come back");
  assert.equal(glyph.status, "未完成");
  assert.deepEqual(history, ["路", "路"], "both changes go through undo history");
  assert.equal(queue.length, 2);
  assert.deepEqual(
    { status: queue[1].status, variant: queue[1].variant, comment: queue[1].comment, createdAt: queue[1].createdAt },
    { status: "rejected", variant: null, comment: "直せない", createdAt: "T1" }
  );
  const item = ctx.state.proposals.get("路");
  assert.equal(item.status, "rejected");
  assert.equal(item.triedVariant, 0);
  assert.equal(ctx.adoptedUnfinishedProposalFor(glyph), null, "the glyph leaves the review queue");
});

test("a hand fix can start over from the adopted AI shape, even after erasing every line", () => {
  const glyph = { char: "老", status: "未完成", activeEdges: new Set(), lockedEdges: new Set(), activePoints: new Set(), candidateScores: {} };
  const queue = [];
  const history = [];
  let answer = false;
  const ctx = contextFor(["pendingProposalFor", "adoptedUnfinishedProposalFor", "adoptedVariantEdges", "selectedProposalIndex", "applyProposalDecisionLocally", "sendProposalDecision", "restoreAdoptedProposal", "giveUpAdoptedProposal", "decideProposal"], {
    GRID_COLS: 4, GRID_ROWS: 4,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    currentGlyph: () => glyph,
    isAllowedEdgeIdForGlyph: (id) => id !== "h-9-9",
    withHistory: (fn, target) => { history.push(target.char); fn(); },
    queuedProposalDecisions: () => queue,
    saveQueuedProposalDecisions: () => {},
    flushProposalDecisions: () => {},
    goToNextProposal: () => {},
    syncAllControls: () => {},
    renderAll: () => {},
    window: { confirm: () => answer },
    els: { proposalComment: { value: "" } },
    state: {
      proposalChar: "老", proposalVariant: 0,
      proposals: new Map([["老", { char: "老", status: "adopted", chosen: 1, createdAt: "T1", variants: [variant("h-0-0"), variant("h-1-1", "h-9-9", "v-2-0")] }]])
    }
  });

  ctx.decideProposal("adopted", true);
  assert.equal(glyph.status, "未完成", "an empty glyph cannot be marked finished");
  ctx.decideProposal("adopted", false);
  assert.deepEqual([...glyph.activeEdges], ["h-1-1", "v-2-0"], "the adopted variant comes back without asking");
  assert.deepEqual([...glyph.lockedEdges], ["h-1-1", "v-2-0"]);
  glyph.activeEdges.add("h-3-3");
  ctx.decideProposal("adopted", false);
  assert.equal(glyph.activeEdges.has("h-3-3"), true, "a hand fix is kept when the reviewer cancels");
  answer = true;
  ctx.decideProposal("adopted", false);
  assert.deepEqual([...glyph.activeEdges], ["h-1-1", "v-2-0"]);
  assert.deepEqual(history, ["老", "老"], "each restore goes through undo history");
  assert.equal(queue.length, 0, "restoring sends no decision");
  assert.equal(ctx.state.proposals.get("老").status, "adopted");
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
