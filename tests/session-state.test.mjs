import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function contextFor(names, globals) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1);
    const end = source.indexOf("\n}", start) + 2;
    vm.runInContext(source.slice(start, end), context);
  }
  return context;
}

test("resume storage is local, migrates old projects and tolerates unavailable storage", () => {
  const values = new Map();
  const ctx = contextFor(["cacheSessionLocally", "readLocalSession", "pickSharedSettings"], {
    SESSION_STORAGE_KEY: "session",
    state: { folderFilter: "kanji", kanjiMode: true, kanjiGradeFilter: "2" },
    currentGlyph: () => ({ char: "紙" }),
    localStorage: { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key) }
  });
  ctx.cacheSessionLocally();
  assert.equal(ctx.readLocalSession(null).currentChar, "紙");
  assert.equal(ctx.readLocalSession(null).kanjiGradeFilter, "2");
  assert.equal(Object.hasOwn(ctx.pickSharedSettings(ctx.readLocalSession(null)), "currentChar"), false);
  values.set("session", "invalid json");
  assert.equal(ctx.readLocalSession({ settings: { currentChar: "一" } }).currentChar, "一");
  assert.equal(ctx.readLocalSession(null), null);
  ctx.localStorage.getItem = ctx.localStorage.setItem = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => ctx.cacheSessionLocally());
  assert.equal(ctx.readLocalSession({ currentChar: "水" }).currentChar, "水");
});

test("latest project glyphs are retained while device-local resume location wins", () => {
  let filtered = 0;
  const ctx = contextFor(["restoreProject"], {
    state: { current: 0 }, GRID_COLS: 4, GRID_ROWS: 4,
    DEFAULT_GRID_COLS: 3, DEFAULT_GRID_ROWS: 4,
    DEFAULT_VIEW: {}, DEFAULT_REFERENCE: { font: "system", transform: {} },
    DEFAULT_TRANSFORM: {}, DEFAULT_PREVIEW: {}, FOLDER_FILTERS: [{ id: "all" }, { id: "kanji" }],
    clearGlyphHistory() {}, setGridSize() {}, normalizePart: (part) => part, restoreCustomFonts() {},
    normalizeGlyph: (glyph) => ({ ...glyph }), isHan: () => true,
    normalizeKanjiGrade: (grade) => grade, clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
    moveCurrentIntoVisibleKanjiGrade() { filtered++; ctx.state.current = 0; },
    syncModeControls() {}, els: {}, currentGlyph: () => ctx.state.glyphs[ctx.state.current]
  });
  const project = { glyphs: [{ char: "一" }, { char: "紙", activeEdges: ["new-edge"] }],
    settings: { currentChar: "一", folderFilter: "all", kanjiGradeFilter: "1" } };
  ctx.restoreProject(project, { session: { currentChar: "紙", folderFilter: "kanji", kanjiMode: true, kanjiGradeFilter: "1" } });
  assert.equal(ctx.currentGlyph().char, "紙");
  assert.equal(ctx.currentGlyph().activeEdges[0], "new-edge");
  assert.equal(ctx.state.kanjiMode, true);
  assert.equal(filtered, 0, "search results outside the saved grade also resume exactly");
  ctx.restoreProject(project, { session: { currentChar: "missing" } });
  assert.equal(filtered, 1, "removed glyphs fall back to a valid selection");
  ctx.restoreProject(project);
  assert.equal(ctx.currentGlyph().char, "一", "explicit imports keep their own selection");
});

test("radical suggestion selects once per glyph without registering or overriding manual choices", () => {
  const ctx = contextFor(["syncDetectedPartName", "syncPartCustomNameVisibility"], {
    partNameGlyphChar: null,
    getRadicalNames: (char) => char === "紙" ? ["糹", "纟", "糸"] : char === "一" ? ["一"] : ["弓"],
    els: { partNameSelect: { value: "亻", options: ["亻", "糹", "弓", "other"].map((value) => ({ value })) },
      partNameInput: { value: "" }, partCustomNameRow: { hidden: true } }
  });
  ctx.syncDetectedPartName("紙");
  assert.equal(ctx.els.partNameSelect.value, "糹");
  ctx.els.partNameSelect.value = "other";
  ctx.els.partNameInput.value = "custom";
  ctx.syncDetectedPartName("紙");
  assert.equal(ctx.els.partNameSelect.value, "other");
  assert.equal(ctx.els.partNameInput.value, "custom");
  ctx.syncDetectedPartName("引");
  assert.equal(ctx.els.partNameSelect.value, "弓");
  assert.equal(ctx.els.partCustomNameRow.hidden, true);
  ctx.syncDetectedPartName("一");
  assert.equal(ctx.els.partNameSelect.value, "other");
  assert.equal(ctx.els.partNameInput.value, "一");
  assert.equal(ctx.els.partCustomNameRow.hidden, false);
});
