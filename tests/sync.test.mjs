import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { mergePartsById, mergeProject } from "../project-merge.mjs";

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

const glyph = (char, ...activeEdges) => ({ char, activeEdges, lockedEdges: activeEdges, activePoints: [], status: "未完成" });
const edgesOf = (project, char) => project.glyphs.find((item) => item.char === char).activeEdges.join(",");
const part = (id) => ({ id, name: id, activeEdges: ["h-0-0"] });
const mergeNames = ["glyphSnapshot", "mergePlainObject", "mergePartsById", "mergeLocalIntoRemote"];

test("a stale device no longer overwrites newer shared glyphs when it reopens", () => {
  const ctx = contextFor(mergeNames, {});
  const remote = { savedAt: "2026-01-02T00:00:00Z", glyphs: [glyph("山", "h-0-0"), glyph("川", "v-0-0")], parts: [] };
  const local = { savedAt: "2026-01-03T00:00:00Z", glyphs: [glyph("山"), glyph("川", "v-0-0")], parts: [] };

  const merged = ctx.mergeLocalIntoRemote(remote, local, null, true);
  assert.equal(edgesOf(merged.project, "山"), "h-0-0", "the friend's glyph survives");
  assert.equal(merged.hasUnsent, false);
  assert.equal(merged.setAside.length, 0);
});

test("unsent edits are replayed, delivered ones are skipped and clashes keep the shared copy", () => {
  const ctx = contextFor(mergeNames, {});
  const base = { 山: ctx.glyphSnapshot(glyph("山")), 川: ctx.glyphSnapshot(glyph("川")), 森: ctx.glyphSnapshot(glyph("森")) };
  const remote = {
    savedAt: "2026-01-02T00:00:00Z",
    settings: { view: { showGrid: true, referenceOpacity: 0.2 } },
    parts: [part("a"), part("friend")],
    glyphs: [glyph("山"), glyph("川", "v-0-0"), glyph("森", "h-1-1")]
  };
  const unsent = {
    bases: base,
    patch: {
      glyphs: [glyph("山", "h-0-0"), glyph("川", "v-0-0"), glyph("森", "d1-0-0"), glyph("新", "h-2-2")],
      settings: { view: { referenceOpacity: 0.5 } },
      parts: [part("mine")],
      partsBaseIds: ["a"]
    }
  };

  const merged = ctx.mergeLocalIntoRemote(remote, null, unsent, true);
  assert.equal(edgesOf(merged.project, "山"), "h-0-0", "never-sent edit is kept");
  assert.equal(edgesOf(merged.project, "新"), "h-2-2", "a glyph the server lacks is added");
  assert.equal(edgesOf(merged.project, "森"), "h-1-1", "a glyph someone else changed keeps the shared version");
  assert.deepEqual(Array.from(merged.setAside, (item) => item.char), ["森"]);
  assert.equal(merged.hasUnsent, true);
  assert.deepEqual(JSON.parse(JSON.stringify(merged.project.settings.view)), { showGrid: true, referenceOpacity: 0.5 });
  assert.deepEqual(Array.from(merged.project.parts, (item) => item.id), ["friend", "mine"], "deleted a, kept the friend's, added mine");
  assert.equal(remote.glyphs[0].activeEdges.length, 0, "the fetched project is left untouched for diffing");

  const delivered = ctx.mergeLocalIntoRemote(remote, null, { bases: base, patch: { glyphs: [glyph("川", "v-0-0")] } }, true);
  assert.equal(delivered.hasUnsent, false);
});

test("the first run after the update only fills gaps in the shared copy", () => {
  const ctx = contextFor(mergeNames, {});
  const remote = { savedAt: "2026-01-02T00:00:00Z", glyphs: [glyph("山", "h-0-0"), glyph("川")] };
  const local = { savedAt: "2026-01-03T00:00:00Z", glyphs: [glyph("山", "v-4-0"), glyph("川", "v-0-0"), glyph("森", "h-1-1")] };

  const merged = ctx.mergeLocalIntoRemote(remote, local, null, false);
  assert.equal(edgesOf(merged.project, "山"), "h-0-0");
  assert.equal(edgesOf(merged.project, "川"), "v-0-0", "work the server never received is contributed");
  assert.equal(edgesOf(merged.project, "森"), "h-1-1");
  assert.deepEqual(Array.from(merged.setAside, (item) => item.char), ["山"], "the differing local version is kept aside, not pushed");
  assert.equal(merged.legacy, true);

  const older = ctx.mergeLocalIntoRemote(remote, { ...local, savedAt: "2026-01-01T00:00:00Z" }, null, false);
  assert.equal(edgesOf(older.project, "川"), "", "an older local copy contributes nothing");
});

test("unsent edits are journaled with the version they were based on", () => {
  const stored = new Map();
  const baseline = { glyphs: [glyph("山"), glyph("川", "v-0-0")], settings: {}, parts: [part("a")] };
  const ctx = contextFor(["glyphSnapshot", "mergePlainObject", "pickSharedSettings", "diffRemoteValue", "hasRemotePatchChanges", "buildRemoteProjectPatch", "cacheUnsentChanges", "readUnsentChanges"], {
    UNSENT_STORAGE_KEY: "unsent",
    remoteProjectBaseline: baseline, offlineBaseline: null, carriedUnsent: null,
    localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) }
  });

  ctx.cacheUnsentChanges({ glyphs: [glyph("山", "h-0-0"), glyph("川", "v-0-0")], settings: {}, parts: [part("a"), part("b")] });
  const journal = ctx.readUnsentChanges();
  assert.deepEqual(Array.from(journal.patch.glyphs, (item) => item.char), ["山"]);
  assert.equal(journal.bases["山"], ctx.glyphSnapshot(glyph("山")));
  assert.deepEqual(Array.from(journal.patch.partsBaseIds), ["a"]);

  ctx.cacheUnsentChanges(baseline);
  assert.equal(ctx.readUnsentChanges(), null, "nothing stays queued once the copies match");

  // Started offline: earlier unsent edits stay queued next to this session's.
  vm.runInContext("remoteProjectBaseline = null; offlineBaseline = { glyphs: [], settings: {}, parts: [] };", ctx);
  ctx.offlineBaseline.glyphs.push(glyph("山", "h-0-0"), glyph("川", "v-0-0"));
  ctx.carriedUnsent = journal;
  ctx.cacheUnsentChanges({ glyphs: [glyph("山", "h-0-0"), glyph("川", "v-1-1")], settings: {}, parts: [] });
  const carried = ctx.readUnsentChanges();
  assert.deepEqual(Array.from(carried.patch.glyphs, (item) => item.char).sort(), ["山", "川"].sort());
  assert.equal(carried.bases["山"], journal.bases["山"], "the base stays the last version the server confirmed");
});

test("parts merge by id and old clients still replace the list", () => {
  assert.deepEqual(mergePartsById([part("a"), part("b"), part("x")], [part("a"), part("c")], ["a", "b"]).map((item) => item.id), ["a", "x", "c"]);
  const current = { revision: 4, parts: [part("a"), part("friend")], glyphs: [glyph("山"), glyph("川", "v-0-0")] };
  const merged = mergeProject(current, { glyphs: [glyph("山", "h-0-0")], parts: [part("a"), part("mine")], partsBaseIds: ["a"] });
  assert.deepEqual(merged.parts.map((item) => item.id), ["a", "friend", "mine"]);
  assert.equal(edgesOf(merged, "山"), "h-0-0");
  assert.equal(edgesOf(merged, "川"), "v-0-0");
  assert.equal(merged.revision, 5);
  assert.deepEqual(mergeProject(current, { glyphs: [], parts: [part("only")] }).parts.map((item) => item.id), ["only"]);
});

test("the server reports its revision and merges concurrent part edits", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "trace-logo-sync-"));
  writeFileSync(join(dataDir, "shared-project.json"), JSON.stringify({ version: 2, revision: 7, savedAt: "T", parts: [part("a")], glyphs: [glyph("山")] }));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = spawn(process.execPath, [fileURLToPath(new URL("../local-server.mjs", import.meta.url)), String(port), dataDir], { stdio: ["ignore", "pipe", "inherit"] });
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("exit", () => reject(new Error("server exited")));
    });
    const base = `http://127.0.0.1:${port}/api/project`;
    const patch = (body) => fetch(`${base}/patch`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    let response = await fetch(`${base}/revision`);
    assert.equal(response.headers.get("x-trace-logo-api"), "1");
    assert.deepEqual(await response.json(), { revision: 7, savedAt: "T" });

    await patch({ glyphs: [], parts: [part("a"), part("friend")], partsBaseIds: ["a"] });
    response = await patch({ glyphs: [glyph("山", "h-0-0")], parts: [part("a"), part("mine")], partsBaseIds: ["a"] });
    const saved = (await response.json()).project;
    assert.deepEqual(saved.parts.map((item) => item.id), ["a", "friend", "mine"]);
    assert.equal((await (await fetch(`${base}/revision`)).json()).revision, 9);
    assert.equal(JSON.parse(readFileSync(join(dataDir, "shared-project.backup.json"), "utf8")).revision, 8);
  } finally {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
