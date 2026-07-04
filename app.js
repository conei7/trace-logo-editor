"use strict";

const DEFAULT_GRID_COLS = 6;
const DEFAULT_GRID_ROWS = 6;
const MIN_GRID_SIZE = 3;
const MAX_GRID_SIZE = 12;
const DIGIT_CHARS = splitGraphemes("0123456789");
const LATIN_CHARS = splitGraphemes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
const LATIN_UPPER_CHARS = splitGraphemes("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const HIRAGANA_CHARS = splitGraphemes(
  "あいうえおかきくけこさしすせそたちつてとなにぬねの" +
  "はひふへほまみむめもやゐゆゑよらりるれろわをん" +
  "ぁぃぅぇぉっゃゅょゎゕゖー゛゜"
);
const KATAKANA_CHARS = splitGraphemes(
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ" +
  "ハヒフヘホマミムメモヤヰユヱヨラリルレロワヲン" +
  "ァィゥェォッャュョヮヵヶー゛゜"
);
const ASCII_SYMBOL_CHARS = splitGraphemes("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");
const FULL_WIDTH_SYMBOL_CHARS = splitGraphemes(
  "　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～" +
  "∥｜…‥‘’“”（）〔〕［］｛｝〈〉《》「」『』【】＋－±×÷＝≠＜＞≦≧" +
  "∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓"
);
const COMPLETED_CHARS = splitGraphemes(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "あいうえおかきくけこさしすせそたちつてとなにぬねの" +
  "はひふへほまみむめもやゐゆゑよらりるれろわをん" +
  "ぁぃぅぇぉっゃゅょゎゕゖ゛゜"
);
const TEST_CHARS = splitGraphemes("ABCDEあいうえお");
const KANJI_TEST_CHARS = splitGraphemes("日月火水木金土山川田人口本語技術工業東京千葉量車中美咲鬱魔齋");
const KANJI_PART_NAME_GROUPS = [
  { id: "left", label: "左偏", names: "亻 冫 氵 扌 忄 彳 犭 礻 衤 訁 阝 女 子 山 土 王 木 禾 米 糹 纟 金 釒 貝 車 馬 魚 虫" },
  { id: "right", label: "右旁", names: "刂 阝 卩 力 寸 攵 欠 頁 見 斤 殳 隹 鳥" },
  { id: "top", label: "冠", names: "宀 冖 艹 ⺾ 竹 ⺮ 雨 穴 爫 癶 罒 ⺌ 小 髟" },
  { id: "bottom", label: "脚", names: "灬 心 皿 貝 儿 廾 土 女 手 寸 日 月" },
  { id: "frame", label: "構", names: "門 囗 匚 匸 冂 勹 气 行 弋 戈" },
  { id: "hang", label: "垂", names: "广 疒 厂 尸 戸 麻 虍 鹿" },
  { id: "wrap", label: "繞", names: "辶 ⻌ 廴 走 鬼 尢 兀" }
];
const KANJI_PART_CHARS = uniqueChars(KANJI_PART_NAME_GROUPS.flatMap((group) => group.names.split(/\s+/).filter(Boolean)));
const KANA_CHARS = uniqueChars([...HIRAGANA_CHARS, ...KATAKANA_CHARS]);
const ALL_TARGET_CHARS = uniqueChars([
  ...DIGIT_CHARS,
  ...LATIN_CHARS,
  ...HIRAGANA_CHARS,
  ...KATAKANA_CHARS,
  ...ASCII_SYMBOL_CHARS,
  ...FULL_WIDTH_SYMBOL_CHARS
]);
const FOLDER_FILTERS = [
  { id: "all", label: "全部" },
  { id: "todo", label: "未完成" },
  { id: "done", label: "完成" },
  { id: "digit", label: "数字" },
  { id: "latin", label: "英字" },
  { id: "hiragana", label: "ひらがな" },
  { id: "katakana", label: "カタカナ" },
  { id: "symbol", label: "記号" },
  { id: "kanji", label: "漢字" },
  { id: "other", label: "その他" }
];
const STATUS = ["未完成", "完成"];
const STORAGE_KEY = "trace-logo-editor:v1";
const REMOTE_PROJECT_ENDPOINT = "/api/project";
const REMOTE_SAVE_DEBOUNCE_MS = 900;

let GRID_COLS = DEFAULT_GRID_COLS;
let GRID_ROWS = DEFAULT_GRID_ROWS;
let EDGES = createEdges(GRID_COLS, GRID_ROWS);
let EDGE_BY_ID = new Map(EDGES.map((edge) => [edge.id, edge]));
let remoteSaveAvailable = false;
let remoteSaveTimer = 0;
let remoteSaveInFlight = false;
let pendingRemoteSaveJson = "";

const DEFAULT_TRANSFORM = {
  scale: 0.86,
  offsetX: 0,
  offsetY: 0.04,
  weight: 0
};

const DEFAULT_REFERENCE = {
  font: "system-ui, sans-serif",
  transform: { ...DEFAULT_TRANSFORM }
};

const DEFAULT_AUTO = {
  sensitivity: 56,
  density: 60,
  probe: 24,
  bias: 0,
  connect: 20,
  simplify: 35
};

const DEFAULT_PREVIEW = {
  text: "ABCDE あいうえお",
  size: 56,
  tracking: 0,
  weight: 10,
  spacing: "mono"
};

const DEFAULT_VIEW = {
  showReference: true,
  showGrid: true,
  showConfidence: true,
  showPreview: true,
  showBaseline: true,
  baselineFromBottom: 1,
  referenceOpacity: 0.24
};

const state = {
  gridCols: DEFAULT_GRID_COLS,
  gridRows: DEFAULT_GRID_ROWS,
  glyphs: TEST_CHARS.map(createGlyph),
  preview: { ...DEFAULT_PREVIEW },
  folderFilter: "all",
  current: 0,
  mode: "toggle",
  savedAt: null,
  customFonts: [],
  parts: [],
  reference: {
    font: DEFAULT_REFERENCE.font,
    transform: { ...DEFAULT_REFERENCE.transform }
  },
  view: { ...DEFAULT_VIEW },
  undoStack: [],
  redoStack: [],
  historyStart: null,
  duplicateExactChars: new Set(),
  drawing: false,
  rightErase: false,
  lastEdgeId: null,
  pendingToggle: null,
  longPressTimer: null,
  longPressHandled: false
};

const els = {
  charList: document.getElementById("charList"),
  folderTabs: document.getElementById("folderTabs"),
  glyphCount: document.getElementById("glyphCount"),
  charSetInput: document.getElementById("charSetInput"),
  applyCharSet: document.getElementById("applyCharSet"),
  testSet: document.getElementById("testSet"),
  allSet: document.getElementById("allSet"),
  latinSet: document.getElementById("latinSet"),
  kanaSet: document.getElementById("kanaSet"),
  kataSet: document.getElementById("kataSet"),
  symbolSet: document.getElementById("symbolSet"),
  kanjiSet: document.getElementById("kanjiSet"),
  partSet: document.getElementById("partSet"),
  completedSet: document.getElementById("completedSet"),
  markCompleted: document.getElementById("markCompleted"),
  charSetNote: document.getElementById("charSetNote"),
  currentChar: document.getElementById("currentChar"),
  currentWidthBadge: document.getElementById("currentWidthBadge"),
  glyphSelect: document.getElementById("glyphSelect"),
  statusToggle: document.getElementById("statusToggle"),
  canvas: document.getElementById("editorCanvas"),
  previewCanvas: document.getElementById("previewCanvas"),
  previewText: document.getElementById("previewText"),
  sentencePreview: document.getElementById("sentencePreview"),
  previewSize: document.getElementById("previewSize"),
  previewSizeValue: document.getElementById("previewSizeValue"),
  previewTracking: document.getElementById("previewTracking"),
  previewTrackingValue: document.getElementById("previewTrackingValue"),
  previewWeight: document.getElementById("previewWeight"),
  previewWeightValue: document.getElementById("previewWeightValue"),
  previewSpacingButtons: document.querySelectorAll("[data-preview-spacing]"),
  autoTrace: document.getElementById("autoTrace"),
  undoButton: document.getElementById("undoButton"),
  redoButton: document.getElementById("redoButton"),
  showReference: document.getElementById("showReference"),
  showGrid: document.getElementById("showGrid"),
  showConfidence: document.getElementById("showConfidence"),
  showPreview: document.getElementById("showPreview"),
  showBaseline: document.getElementById("showBaseline"),
  baselineFromBottom: document.getElementById("baselineFromBottom"),
  baselineFromBottomValue: document.getElementById("baselineFromBottomValue"),
  referenceOpacity: document.getElementById("referenceOpacity"),
  referenceOpacityValue: document.getElementById("referenceOpacityValue"),
  gridCols: document.getElementById("gridCols"),
  gridColsValue: document.getElementById("gridColsValue"),
  gridRows: document.getElementById("gridRows"),
  gridRowsValue: document.getElementById("gridRowsValue"),
  kanjiGridButtons: document.querySelectorAll("[data-kanji-grid]"),
  partNameSelect: document.getElementById("partNameSelect"),
  partNameInput: document.getElementById("partNameInput"),
  partCustomNameRow: document.getElementById("partCustomNameRow"),
  savePart: document.getElementById("savePart"),
  partLibrary: document.getElementById("partLibrary"),
  fontSelect: document.getElementById("fontSelect"),
  fontUpload: document.getElementById("fontUpload"),
  refScale: document.getElementById("refScale"),
  refScaleValue: document.getElementById("refScaleValue"),
  refOffsetX: document.getElementById("refOffsetX"),
  refOffsetXValue: document.getElementById("refOffsetXValue"),
  refOffsetY: document.getElementById("refOffsetY"),
  refOffsetYValue: document.getElementById("refOffsetYValue"),
  refWeight: document.getElementById("refWeight"),
  refWeightValue: document.getElementById("refWeightValue"),
  autoSensitivity: document.getElementById("autoSensitivity"),
  autoSensitivityValue: document.getElementById("autoSensitivityValue"),
  autoDensity: document.getElementById("autoDensity"),
  autoDensityValue: document.getElementById("autoDensityValue"),
  autoProbe: document.getElementById("autoProbe"),
  autoProbeValue: document.getElementById("autoProbeValue"),
  autoBias: document.getElementById("autoBias"),
  autoBiasValue: document.getElementById("autoBiasValue"),
  autoConnect: document.getElementById("autoConnect"),
  autoConnectValue: document.getElementById("autoConnectValue"),
  autoSimplify: document.getElementById("autoSimplify"),
  autoSimplifyValue: document.getElementById("autoSimplifyValue"),
  alignLeft: document.getElementById("alignLeft"),
  alignUp: document.getElementById("alignUp"),
  alignDown: document.getElementById("alignDown"),
  alignRight: document.getElementById("alignRight"),
  mirrorX: document.getElementById("mirrorX"),
  mirrorY: document.getElementById("mirrorY"),
  rotateCW: document.getElementById("rotateCW"),
  clearGlyph: document.getElementById("clearGlyph"),
  saveJson: document.getElementById("saveJson"),
  exportSvg: document.getElementById("exportSvg"),
  loadJson: document.getElementById("loadJson"),
  duplicateThreshold: document.getElementById("duplicateThreshold"),
  duplicateThresholdValue: document.getElementById("duplicateThresholdValue"),
  checkDuplicates: document.getElementById("checkDuplicates"),
  clearDuplicates: document.getElementById("clearDuplicates"),
  duplicateCompare: document.getElementById("duplicateCompare"),
  duplicateResults: document.getElementById("duplicateResults")
};

const ctx = els.canvas.getContext("2d", { willReadFrequently: false });
const previewCtx = els.previewCanvas.getContext("2d");

init();

async function init() {
  await loadInitialProject();
  bindEvents();
  syncAllControls();
  resizeCanvases();
  renderAll();
}

function createEdges(cols, rows) {
  const edges = [];
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      edges.push({ id: `h-${x}-${y}`, type: "h", x1: x, y1: y, x2: x + 1, y2: y });
    }
  }
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      edges.push({ id: `v-${x}-${y}`, type: "v", x1: x, y1: y, x2: x, y2: y + 1 });
    }
  }
  return edges;
}

function setGridSize(nextCols, nextRows, options = {}) {
  const cols = clampGridSize(nextCols);
  const rows = clampGridSize(nextRows);
  if (cols === GRID_COLS && rows === GRID_ROWS) return;

  const oldCols = GRID_COLS;
  const oldRows = GRID_ROWS;
  const oldEdgeById = EDGE_BY_ID;
  GRID_COLS = cols;
  GRID_ROWS = rows;
  state.gridCols = GRID_COLS;
  state.gridRows = GRID_ROWS;
  EDGES = createEdges(GRID_COLS, GRID_ROWS);
  EDGE_BY_ID = new Map(EDGES.map((edge) => [edge.id, edge]));

  if (options.remap !== false) {
    for (const glyph of state.glyphs) {
      const hadActiveEdges = glyph.activeEdges.size > 0;
      glyph.activeEdges = remapEdgeSet(glyph.activeEdges, oldCols, oldRows, GRID_COLS, GRID_ROWS, oldEdgeById);
      glyph.lockedEdges = remapEdgeSet(glyph.lockedEdges, oldCols, oldRows, GRID_COLS, GRID_ROWS, oldEdgeById);
      glyph.candidateScores = {};
      if (hadActiveEdges && glyph.status !== "完成") {
        glyph.status = "未完成";
      }
    }
  }
}

function setKanjiGrid(size) {
  withHistory(() => {
    setGridSize(size, size);
  });
  syncAllControls();
  renderAll();
}

function clampGridSize(value) {
  return clamp(Math.round(Number(value) || DEFAULT_GRID_COLS), MIN_GRID_SIZE, MAX_GRID_SIZE);
}

function remapEdgeSet(edgeIds, oldCols, oldRows, newCols, newRows, oldEdgeById) {
  const next = new Set();
  for (const id of edgeIds) {
    const edge = oldEdgeById.get(id);
    if (!edge) continue;
    for (const nextId of remapEdge(edge, oldCols, oldRows, newCols, newRows)) {
      if (EDGE_BY_ID.has(nextId)) next.add(nextId);
    }
  }
  return next;
}

function remapEdge(edge, oldCols, oldRows, newCols, newRows) {
  const scaleX = newCols / oldCols;
  const scaleY = newRows / oldRows;
  if (edge.type === "h") {
    const y = clamp(Math.round(edge.y1 * scaleY), 0, newRows);
    let x1 = clamp(Math.round(edge.x1 * scaleX), 0, newCols);
    let x2 = clamp(Math.round(edge.x2 * scaleX), 0, newCols);
    if (x1 === x2) x2 = clamp(x1 + 1, 1, newCols);
    const from = Math.min(x1, x2);
    const to = Math.max(x1, x2);
    return range(from, to).map((x) => `h-${x}-${y}`);
  }

  const x = clamp(Math.round(edge.x1 * scaleX), 0, newCols);
  let y1 = clamp(Math.round(edge.y1 * scaleY), 0, newRows);
  let y2 = clamp(Math.round(edge.y2 * scaleY), 0, newRows);
  if (y1 === y2) y2 = clamp(y1 + 1, 1, newRows);
  const from = Math.min(y1, y2);
  const to = Math.max(y1, y2);
  return range(from, to).map((y) => `v-${x}-${y}`);
}

function range(from, to) {
  const values = [];
  for (let value = from; value < to; value += 1) values.push(value);
  return values;
}

function createGlyph(char) {
  return {
    char,
    activeEdges: new Set(),
    lockedEdges: new Set(),
    candidateScores: {},
    referenceFont: "system-ui, sans-serif",
    referenceTransform: { ...DEFAULT_TRANSFORM },
    autoSettings: { ...DEFAULT_AUTO },
    status: "未完成"
  };
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvases);
  window.addEventListener("pagehide", flushRemoteSaveOnPageHide);
  populatePartNameSelect();

  els.charList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-index]");
    if (!card) return;
    state.current = Number(card.dataset.index);
    syncAllControls();
    persist();
    renderAll();
  });

  els.glyphSelect.addEventListener("change", () => {
    state.current = Number(els.glyphSelect.value);
    syncAllControls();
    persist();
    renderAll();
  });

  els.applyCharSet.addEventListener("click", () => applyCharSet(els.charSetInput.value));
  els.testSet.addEventListener("click", () => useCharSet(TEST_CHARS));
  els.allSet.addEventListener("click", () => useCharSet(ALL_TARGET_CHARS));
  els.latinSet.addEventListener("click", () => useCharSet([...DIGIT_CHARS, ...LATIN_CHARS]));
  els.kanaSet.addEventListener("click", () => useCharSet(HIRAGANA_CHARS));
  els.kataSet.addEventListener("click", () => useCharSet(KATAKANA_CHARS));
  els.symbolSet.addEventListener("click", () => useCharSet(uniqueChars([...ASCII_SYMBOL_CHARS, ...FULL_WIDTH_SYMBOL_CHARS])));
  els.kanjiSet.addEventListener("click", () => {
    useCharSet(KANJI_TEST_CHARS);
    setKanjiGrid(6);
  });
  els.partSet.addEventListener("click", () => {
    useCharSet(KANJI_PART_CHARS);
    setKanjiGrid(6);
  });
  els.completedSet.addEventListener("click", () => useCharSet(COMPLETED_CHARS));
  els.markCompleted.addEventListener("click", markCompletedGlyphs);

  els.folderTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-folder]");
    if (!button) return;
    state.folderFilter = button.dataset.folder;
    persist();
    renderAll();
  });

  els.statusToggle.addEventListener("click", () => {
    withHistory(() => {
      const glyph = currentGlyph();
      glyph.status = glyph.status === "完成" ? "未完成" : "完成";
    });
    syncStatusToggle();
    renderAll();
  });

  els.autoTrace.addEventListener("click", () => {
    withHistory(() => runAutoTrace(currentGlyph()));
    renderAll();
  });

  els.undoButton.addEventListener("click", undo);
  els.redoButton.addEventListener("click", redo);

  bindViewCheckbox(els.showReference, "showReference");
  bindViewCheckbox(els.showGrid, "showGrid");
  bindViewCheckbox(els.showConfidence, "showConfidence");
  bindViewCheckbox(els.showPreview, "showPreview");
  bindViewCheckbox(els.showBaseline, "showBaseline");

  els.baselineFromBottom.addEventListener("input", () => {
    state.view.baselineFromBottom = Number(els.baselineFromBottom.value);
    syncBaselineControl();
    persist();
    renderAll();
  });

  els.referenceOpacity.addEventListener("input", () => {
    state.view.referenceOpacity = Number(els.referenceOpacity.value) / 100;
    els.referenceOpacityValue.value = `${els.referenceOpacity.value}%`;
    persist();
    renderAll();
  });

  els.gridCols.addEventListener("input", () => {
    withHistory(() => {
      setGridSize(els.gridCols.value, GRID_ROWS);
    });
    syncAllControls();
    renderAll();
  });

  els.gridRows.addEventListener("input", () => {
    withHistory(() => {
      setGridSize(GRID_COLS, els.gridRows.value);
    });
    syncAllControls();
    renderAll();
  });

  els.kanjiGridButtons.forEach((button) => {
    button.addEventListener("click", () => setKanjiGrid(button.dataset.kanjiGrid));
  });

  els.partNameSelect.addEventListener("change", syncPartCustomNameVisibility);
  els.savePart.addEventListener("click", saveCurrentAsPart);

  els.partLibrary.addEventListener("click", (event) => {
    const button = event.target.closest("[data-part-action]");
    if (!button) return;
    if (button.dataset.partAction === "paste") pastePart(button.dataset.partId);
    if (button.dataset.partAction === "delete") deletePart(button.dataset.partId);
  });

  els.previewText.addEventListener("input", () => {
    state.preview.text = els.previewText.value;
    renderSentencePreview();
    persist();
  });

  els.previewSize.addEventListener("input", () => {
    state.preview.size = Number(els.previewSize.value);
    els.previewSizeValue.value = els.previewSize.value;
    renderSentencePreview();
    persist();
  });

  els.previewTracking.addEventListener("input", () => {
    state.preview.tracking = Number(els.previewTracking.value);
    els.previewTrackingValue.value = els.previewTracking.value;
    renderSentencePreview();
    persist();
  });

  els.previewWeight.addEventListener("input", () => {
    state.preview.weight = Number(els.previewWeight.value);
    els.previewWeightValue.value = els.previewWeight.value;
    renderSentencePreview();
    persist();
  });

  els.previewSpacingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.preview.spacing = button.dataset.previewSpacing;
      syncPreviewSpacingButtons();
      renderSentencePreview();
      persist();
    });
  });

  els.fontSelect.addEventListener("change", () => {
    withHistory(() => {
      state.reference.font = els.fontSelect.value;
    });
    persist();
    document.fonts.ready.then(renderAll);
    renderAll();
  });

  els.fontUpload.addEventListener("change", loadUploadedFont);

  bindTransformRange(els.refScale, els.refScaleValue, "scale", (value) => Number(value) / 100, (value) => `${value}%`);
  bindTransformRange(els.refOffsetX, els.refOffsetXValue, "offsetX", (value) => Number(value) / 100, (value) => value);
  bindTransformRange(els.refOffsetY, els.refOffsetYValue, "offsetY", (value) => Number(value) / 100, (value) => value);
  bindTransformRange(els.refWeight, els.refWeightValue, "weight", (value) => Number(value), (value) => value);

  bindAutoRange(els.autoSensitivity, els.autoSensitivityValue, "sensitivity");
  bindAutoRange(els.autoDensity, els.autoDensityValue, "density");
  bindAutoRange(els.autoProbe, els.autoProbeValue, "probe");
  bindAutoRange(els.autoBias, els.autoBiasValue, "bias");
  bindAutoRange(els.autoConnect, els.autoConnectValue, "connect");
  bindAutoRange(els.autoSimplify, els.autoSimplifyValue, "simplify");

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      syncModeControls();
      persist();
    });
  });

  els.alignLeft.addEventListener("click", () => alignCurrentEdges("left"));
  els.alignUp.addEventListener("click", () => alignCurrentEdges("up"));
  els.alignDown.addEventListener("click", () => alignCurrentEdges("down"));
  els.alignRight.addEventListener("click", () => alignCurrentEdges("right"));
  els.mirrorX.addEventListener("click", () => transformCurrentEdges(mirrorXEdge));
  els.mirrorY.addEventListener("click", () => transformCurrentEdges(mirrorYEdge));
  els.rotateCW.addEventListener("click", rotateCurrentClockwise);
  els.clearGlyph.addEventListener("click", () => {
    withHistory(() => {
      const glyph = currentGlyph();
      glyph.activeEdges.clear();
      glyph.lockedEdges.clear();
      glyph.candidateScores = {};
      glyph.status = "未完成";
    });
    renderAll();
  });

  els.saveJson.addEventListener("click", saveProjectJson);
  els.exportSvg.addEventListener("click", exportCurrentSvg);
  els.loadJson.addEventListener("change", loadProjectJson);
  els.duplicateThreshold.addEventListener("input", () => {
    els.duplicateThresholdValue.value = `${els.duplicateThreshold.value}%`;
    persist();
  });
  els.checkDuplicates.addEventListener("click", renderDuplicateResults);
  els.clearDuplicates.addEventListener("click", () => {
    state.duplicateExactChars.clear();
    els.duplicateCompare.replaceChildren();
    els.duplicateCompare.classList.remove("has-selection");
    els.duplicateResults.replaceChildren();
    renderAll();
  });

  els.canvas.addEventListener("pointerdown", onPointerDown);
  els.canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  els.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function bindViewCheckbox(element, key) {
  element.addEventListener("change", () => {
    state.view[key] = element.checked;
    persist();
    renderAll();
  });
}

function syncBaselineControl() {
  const maxFromBottom = Math.max(1, GRID_ROWS - 1);
  els.baselineFromBottom.max = String(maxFromBottom);
  state.view.baselineFromBottom = clamp(state.view.baselineFromBottom, 1, maxFromBottom);
  els.baselineFromBottom.value = state.view.baselineFromBottom;
  els.baselineFromBottomValue.value = `${state.view.baselineFromBottom + 1}本目`;
}

function bindTransformRange(input, output, key, parse, format) {
  input.addEventListener("input", () => {
    const raw = input.value;
    output.value = format(raw);
    state.reference.transform[key] = parse(raw);
    renderAll();
    persist();
  });
}

function bindAutoRange(input, output, key) {
  input.addEventListener("input", () => {
    output.value = input.value;
    currentGlyph().autoSettings[key] = Number(input.value);
    renderAll();
    persist();
  });
}

function currentGlyph() {
  return state.glyphs[state.current] || state.glyphs[0];
}

function syncAllControls() {
  const glyph = currentGlyph();
  els.currentChar.textContent = glyph.char;
  syncCurrentWidthBadge(glyph.char);
  renderGlyphSelect();
  syncStatusToggle();
  syncModeControls();
  els.charSetInput.value = state.glyphs.map((item) => item.char).join("");
  els.glyphCount.textContent = String(state.glyphs.length);

  setSelectValue(els.fontSelect, state.reference.font);

  els.refScale.value = Math.round(state.reference.transform.scale * 100);
  els.refScaleValue.value = `${els.refScale.value}%`;
  els.refOffsetX.value = Math.round(state.reference.transform.offsetX * 100);
  els.refOffsetXValue.value = els.refOffsetX.value;
  els.refOffsetY.value = Math.round(state.reference.transform.offsetY * 100);
  els.refOffsetYValue.value = els.refOffsetY.value;
  els.refWeight.value = state.reference.transform.weight;
  els.refWeightValue.value = state.reference.transform.weight;

  for (const [key, inputId, outputId] of [
    ["sensitivity", "autoSensitivity", "autoSensitivityValue"],
    ["density", "autoDensity", "autoDensityValue"],
    ["probe", "autoProbe", "autoProbeValue"],
    ["bias", "autoBias", "autoBiasValue"],
    ["connect", "autoConnect", "autoConnectValue"],
    ["simplify", "autoSimplify", "autoSimplifyValue"]
  ]) {
    els[inputId].value = glyph.autoSettings[key];
    els[outputId].value = glyph.autoSettings[key];
  }

  els.showReference.checked = state.view.showReference;
  els.showGrid.checked = state.view.showGrid;
  els.showConfidence.checked = state.view.showConfidence;
  els.showPreview.checked = state.view.showPreview;
  els.showBaseline.checked = state.view.showBaseline;
  syncBaselineControl();
  els.referenceOpacity.value = Math.round(state.view.referenceOpacity * 100);
  els.referenceOpacityValue.value = `${els.referenceOpacity.value}%`;
  els.gridCols.value = GRID_COLS;
  els.gridColsValue.value = GRID_COLS;
  els.gridRows.value = GRID_ROWS;
  els.gridRowsValue.value = GRID_ROWS;
  els.previewText.value = state.preview.text;
  els.previewSize.value = state.preview.size;
  els.previewSizeValue.value = state.preview.size;
  els.previewTracking.value = state.preview.tracking;
  els.previewTrackingValue.value = state.preview.tracking;
  els.previewWeight.value = state.preview.weight;
  els.previewWeightValue.value = state.preview.weight;
  syncPreviewSpacingButtons();
}

function syncModeControls() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
}

function syncPreviewSpacingButtons() {
  els.previewSpacingButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.previewSpacing === state.preview.spacing);
  });
}

function setSelectValue(select, value) {
  const hasOption = Array.from(select.options).some((option) => option.value === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.replaceAll("\"", "");
    select.append(option);
  }
  select.value = value;
}

function resizeCanvases() {
  resizeCanvasToElement(els.canvas);
  resizeCanvasToElement(els.previewCanvas);
  renderAll();
}

function resizeCanvasToElement(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function renderAll() {
  renderList();
  renderEditor();
  renderPreview();
  renderSentencePreview();
  renderPartLibrary();
}

function renderSentencePreview() {
  const glyphByChar = new Map(state.glyphs.map((glyph) => [glyph.char, glyph]));
  const text = state.preview.text || "";
  const fragment = document.createDocumentFragment();
  const previewMetrics = getPreviewMetrics();
  els.sentencePreview.style.setProperty("--preview-size", `${state.preview.size}px`);
  els.sentencePreview.style.setProperty("--preview-tracking", `${state.preview.tracking}px`);
  els.sentencePreview.style.setProperty("--preview-em-height", `${state.preview.size * previewMetrics.heightRatio}px`);
  els.sentencePreview.style.setProperty("--preview-space-half", `${state.preview.size * previewMetrics.cellRatio * 2}px`);
  els.sentencePreview.style.setProperty("--preview-space-full", `${state.preview.size * previewMetrics.cellRatio * 4}px`);

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const lineEl = document.createElement("div");
    lineEl.className = "preview-line";
    let visualIndex = 0;

    if (line.length === 0) {
      const spacer = document.createElement("span");
      spacer.className = "preview-space";
      lineEl.append(spacer);
    }

    for (const char of expandTextToGlyphTokens(line)) {
      if (char === " " || char === "　") {
        const space = document.createElement("span");
        space.className = `preview-space${char === "　" ? " is-wide" : ""}`;
        applyPreviewSpacing(space, visualIndex);
        lineEl.append(space);
        visualIndex += 1;
        continue;
      }

      const glyph = glyphByChar.get(char);
      if (glyph && glyph.activeEdges.size > 0) {
        const item = document.createElement("span");
        item.className = "preview-glyph";
        applyPreviewAdvance(item, glyph);
        applyPreviewSpacing(item, visualIndex);
        item.innerHTML = buildSvg(glyph, {
          size: 100,
          strokeWidth: state.preview.weight,
          pad: 12,
          yOffsetCells: getPreviewYOffsetCells(glyph.char),
          previewTopPadCells: previewMetrics.topPadCells,
          previewBottomPadCells: previewMetrics.bottomPadCells,
          includeXml: false
        });
        lineEl.append(item);
        visualIndex += 1;
      } else {
        const missing = document.createElement("span");
        missing.className = "preview-missing";
        applyPreviewSpacing(missing, visualIndex);
        missing.textContent = char;
        lineEl.append(missing);
        visualIndex += 1;
      }
    }

    fragment.append(lineEl);
  }

  els.sentencePreview.replaceChildren(fragment);
}

function applyPreviewSpacing(element, visualIndex) {
  if (visualIndex > 0) {
    element.style.marginLeft = `${state.preview.tracking}px`;
  }
}

function applyPreviewAdvance(element, glyph) {
  const metrics = getPreviewAdvanceMetrics(glyph);
  element.style.setProperty("--advance-ratio", String(metrics.advanceRatio));
  element.style.setProperty("--glyph-shift-ratio", String(metrics.shiftRatio));
}

function getPreviewAdvanceMetrics(glyph) {
  if (state.preview.spacing !== "proportional") {
    return { advanceRatio: 1, shiftRatio: 0 };
  }

  const bounds = getEdgeBounds(glyph.activeEdges);
  if (!bounds) return { advanceRatio: 1, shiftRatio: 0 };

  const size = 100;
  const pad = 12;
  const cell = Math.min((size - pad * 2) / GRID_COLS, (size - pad * 2) / GRID_ROWS);
  const gridWidth = cell * GRID_COLS;
  const left = (size - gridWidth) / 2;
  const trimPad = Math.max(cell * 0.18, state.preview.weight * 0.55);
  const minX = Math.max(0, left + bounds.minX * cell - trimPad);
  const maxX = Math.min(size, left + bounds.maxX * cell + trimPad);

  return {
    advanceRatio: clamp((maxX - minX) / size, 0.2, 1),
    shiftRatio: -minX / size
  };
}

function getPreviewMetrics() {
  const topPadCells = 0;
  const bottomPadCells = Math.max(0, GRID_ROWS - getBaselineY());
  const cell = Math.min((100 - 12 * 2) / GRID_COLS, (100 - 12 * 2) / GRID_ROWS);
  return {
    topPadCells,
    bottomPadCells,
    cellRatio: cell / 100,
    heightRatio: (100 + (topPadCells + bottomPadCells) * cell) / 100
  };
}

function getPreviewYOffsetCells(char) {
  if (!shouldDropBelowLatinBaseline(char)) return 0;
  return GRID_ROWS - getBaselineY();
}

function shouldDropBelowLatinBaseline(char) {
  return /^[a-z]$/.test(char);
}

function renderList() {
  renderFolderTabs();
  const fragment = document.createDocumentFragment();
  const visibleGlyphs = getVisibleGlyphs();
  visibleGlyphs.forEach(({ glyph, index }) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `char-card ${glyph.status === "完成" ? "is-done" : "is-todo"}${state.duplicateExactChars.has(glyph.char) ? " is-duplicate" : ""}${index === state.current ? " is-active" : ""}`;
    card.dataset.index = String(index);

    const char = document.createElement("span");
    char.className = "char-glyph";
    char.textContent = glyph.char;

    const thumb = document.createElement("span");
    thumb.className = "thumb";
    thumb.innerHTML = buildSvg(glyph, { size: 96, strokeWidth: 9, pad: 12, includeXml: false });

    const status = document.createElement("span");
    status.className = `status-pill ${glyph.status === "完成" ? "is-done" : "is-todo"}`;
    status.textContent = glyph.status;

    const widthInfo = getSymbolWidthInfo(glyph.char);
    const widthBadge = document.createElement("span");
    widthBadge.className = "symbol-width-badge";
    widthBadge.textContent = widthInfo ? widthInfo.label : "";
    widthBadge.hidden = !widthInfo;
    if (widthInfo) widthBadge.dataset.width = widthInfo.id;

    card.append(char, thumb, status, widthBadge);
    fragment.append(card);
  });

  els.charList.replaceChildren(fragment);
  els.glyphCount.textContent = state.folderFilter === "all"
    ? String(state.glyphs.length)
    : `${visibleGlyphs.length}/${state.glyphs.length}`;
  els.currentChar.textContent = currentGlyph().char;
  syncCurrentWidthBadge(currentGlyph().char);
  renderGlyphSelect();
  syncStatusToggle();
}

function syncStatusToggle() {
  const done = currentGlyph().status === "完成";
  els.statusToggle.textContent = done ? "完成" : "未完成";
  els.statusToggle.classList.toggle("is-done", done);
  els.statusToggle.setAttribute("aria-pressed", done ? "true" : "false");
}

function renderFolderTabs() {
  const counts = getFolderCounts();
  const fragment = document.createDocumentFragment();
  for (const filter of FOLDER_FILTERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `folder-tab${state.folderFilter === filter.id ? " is-active" : ""}`;
    button.dataset.folder = filter.id;
    button.textContent = `${filter.label} ${counts[filter.id] || 0}`;
    fragment.append(button);
  }
  els.folderTabs.replaceChildren(fragment);
}

function getVisibleGlyphs() {
  return state.glyphs
    .map((glyph, index) => ({ glyph, index }))
    .filter(({ glyph }) => matchesFolderFilter(glyph, state.folderFilter));
}

function getFolderCounts() {
  const counts = Object.fromEntries(FOLDER_FILTERS.map((filter) => [filter.id, 0]));
  counts.all = state.glyphs.length;
  for (const glyph of state.glyphs) {
    counts[classifyGlyphFolder(glyph.char)] = (counts[classifyGlyphFolder(glyph.char)] || 0) + 1;
    if (glyph.status === "完成") counts.done += 1;
    if (glyph.status !== "完成") counts.todo += 1;
  }
  return counts;
}

function matchesFolderFilter(glyph, filter) {
  if (filter === "all") return true;
  if (filter === "done") return glyph.status === "完成";
  if (filter === "todo") return glyph.status !== "完成";
  return classifyGlyphFolder(glyph.char) === filter;
}

function renderGlyphSelect() {
  const options = state.glyphs.map((glyph, index) => {
    const option = document.createElement("option");
    const widthInfo = getSymbolWidthInfo(glyph.char);
    option.value = String(index);
    option.textContent = widthInfo ? `${glyph.char}  ${widthInfo.label}  ${glyph.status}` : `${glyph.char}  ${glyph.status}`;
    return option;
  });
  els.glyphSelect.replaceChildren(...options);
  els.glyphSelect.value = String(state.current);
}

function syncCurrentWidthBadge(char) {
  const widthInfo = getSymbolWidthInfo(char);
  els.currentWidthBadge.textContent = widthInfo ? widthInfo.label : "";
  els.currentWidthBadge.classList.toggle("is-hidden", !widthInfo);
  if (widthInfo) {
    els.currentWidthBadge.dataset.width = widthInfo.id;
  } else {
    delete els.currentWidthBadge.dataset.width;
  }
}

function getSymbolWidthInfo(char) {
  if (ASCII_SYMBOL_CHARS.includes(char)) return { id: "half", label: "半角" };
  if (FULL_WIDTH_SYMBOL_CHARS.includes(char)) return { id: "full", label: "全角" };
  return null;
}

function renderEditor() {
  const canvas = els.canvas;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const layout = getLayout(width, height);
  const glyph = currentGlyph();

  if (state.view.showReference) {
    drawReferenceGlyph(ctx, glyph, layout, state.view.referenceOpacity);
  }

  if (state.view.showGrid) {
    drawGrid(ctx, layout);
  }

  if (shouldShowBaseline(glyph)) {
    drawBaselineGuide(ctx, layout);
  }

  if (state.view.showConfidence) {
    drawConfidence(ctx, glyph, layout);
  }

  drawActiveEdges(ctx, glyph, layout);
  drawIntersections(ctx, layout);
}

function renderPreview() {
  const canvas = els.previewCanvas;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  previewCtx.clearRect(0, 0, width, height);
  previewCtx.fillStyle = "#ffffff";
  previewCtx.fillRect(0, 0, width, height);

  if (!state.view.showPreview) {
    canvas.style.display = "none";
    return;
  }

  canvas.style.display = "block";
  const layout = getLayout(width, height, 0.12);
  drawActiveEdges(previewCtx, currentGlyph(), layout, { finalOnly: true });
}

function getLayout(width, height, paddingRatio = 0.1) {
  const minSide = Math.min(width, height);
  const pad = Math.max(28, minSide * paddingRatio);
  const maxWidth = width - pad * 2;
  const maxHeight = height - pad * 2;
  const cell = Math.min(maxWidth / GRID_COLS, maxHeight / GRID_ROWS);
  const gridWidth = cell * GRID_COLS;
  const gridHeight = cell * GRID_ROWS;
  const left = (width - gridWidth) / 2;
  const top = (height - gridHeight) / 2;
  return { width, height, left, top, size: Math.max(gridWidth, gridHeight), gridWidth, gridHeight, cell };
}

function pointToCanvas(layout, x, y) {
  return {
    x: layout.left + x * layout.cell,
    y: layout.top + y * layout.cell
  };
}

function drawReferenceGlyph(context, glyph, layout, opacity) {
  const tr = state.reference.transform;
  context.save();
  context.beginPath();
  context.rect(layout.left, layout.top, layout.gridWidth, layout.gridHeight);
  context.clip();
  context.globalAlpha = opacity;
  context.fillStyle = "#111111";
  context.strokeStyle = "#111111";
  context.lineJoin = "round";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${Math.min(layout.gridWidth, layout.gridHeight) * tr.scale}px ${state.reference.font}`;
  const x = layout.left + layout.gridWidth / 2 + tr.offsetX * layout.cell;
  const y = layout.top + layout.gridHeight / 2 + tr.offsetY * layout.cell;
  if (tr.weight > 0) {
    context.lineWidth = tr.weight;
    context.strokeText(glyph.char, x, y);
  }
  context.fillText(glyph.char, x, y);
  context.restore();
}

function drawGrid(context, layout) {
  context.save();
  context.strokeStyle = "#beb5a8";
  context.lineWidth = 1;
  context.globalAlpha = 0.75;
  for (let y = 0; y <= GRID_ROWS; y += 1) {
    const a = pointToCanvas(layout, 0, y);
    const b = pointToCanvas(layout, GRID_COLS, y);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }
  for (let x = 0; x <= GRID_COLS; x += 1) {
    const c = pointToCanvas(layout, x, 0);
    const d = pointToCanvas(layout, x, GRID_ROWS);
    context.beginPath();
    context.moveTo(c.x, c.y);
    context.lineTo(d.x, d.y);
    context.stroke();
  }
  context.restore();
}

function drawBaselineGuide(context, layout) {
  const baselineY = getBaselineY();
  const line = pointToCanvas(layout, 0, baselineY);
  const left = pointToCanvas(layout, 0, baselineY);
  const right = pointToCanvas(layout, GRID_COLS, baselineY);
  const bottom = pointToCanvas(layout, 0, GRID_ROWS);

  context.save();
  if (baselineY < GRID_ROWS) {
    context.fillStyle = "#285c9f";
    context.globalAlpha = 0.08;
    context.fillRect(layout.left, line.y, layout.gridWidth, bottom.y - line.y);
  }

  context.globalAlpha = 1;
  context.strokeStyle = "#285c9f";
  context.lineWidth = Math.max(2, layout.cell * 0.025);
  context.setLineDash([Math.max(6, layout.cell * 0.12), Math.max(5, layout.cell * 0.08)]);
  context.beginPath();
  context.moveTo(left.x, left.y);
  context.lineTo(right.x, right.y);
  context.stroke();

  context.setLineDash([]);
  context.fillStyle = "#285c9f";
  context.font = `700 ${Math.max(11, layout.cell * 0.13)}px system-ui, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.fillText("baseline", left.x + 4, left.y - 4);
  context.restore();
}

function shouldShowBaseline(glyph) {
  return state.view.showBaseline && isLatinLowercase(glyph.char);
}

function getBaselineY() {
  return clamp(GRID_ROWS - state.view.baselineFromBottom, 1, GRID_ROWS);
}

function drawConfidence(context, glyph, layout) {
  context.save();
  context.lineCap = "square";
  for (const edge of EDGES) {
    const score = glyph.candidateScores[edge.id] || 0;
    if (score <= 0.025 || glyph.lockedEdges.has(edge.id)) continue;
    const active = glyph.activeEdges.has(edge.id);
    const alpha = Math.min(0.68, 0.08 + score * 1.28);
    context.globalAlpha = active ? Math.max(alpha, 0.42) : alpha;
    context.strokeStyle = active ? "#0f766e" : "#c77816";
    context.lineWidth = active ? Math.max(7, layout.cell * 0.12) : Math.max(4, layout.cell * 0.07);
    strokeEdge(context, edge, layout);
  }
  context.restore();
}

function drawActiveEdges(context, glyph, layout, options = {}) {
  context.save();
  context.lineCap = "square";
  context.lineJoin = "miter";
  for (const id of glyph.activeEdges) {
    const edge = EDGE_BY_ID.get(id);
    if (!edge) continue;
    const locked = glyph.lockedEdges.has(id);
    context.globalAlpha = locked || options.finalOnly ? 1 : 0.72;
    context.strokeStyle = locked || options.finalOnly ? "#171a18" : "#0f766e";
    context.lineWidth = locked || options.finalOnly ? Math.max(9, layout.cell * 0.16) : Math.max(7, layout.cell * 0.13);
    strokeEdge(context, edge, layout);
  }
  context.restore();
}

function drawIntersections(context, layout) {
  context.save();
  context.fillStyle = "#1d211f";
  context.globalAlpha = 0.42;
  for (let y = 0; y <= GRID_ROWS; y += 1) {
    for (let x = 0; x <= GRID_COLS; x += 1) {
      const point = pointToCanvas(layout, x, y);
      context.beginPath();
      context.arc(point.x, point.y, Math.max(2, layout.cell * 0.025), 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function strokeEdge(context, edge, layout) {
  const a = pointToCanvas(layout, edge.x1, edge.y1);
  const b = pointToCanvas(layout, edge.x2, edge.y2);
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.stroke();
}

function onPointerDown(event) {
  const rightErase = isRightEraseEvent(event);
  if (rightErase) event.preventDefault();
  if (!rightErase && event.button !== 0) return;

  const edge = findEdgeAtEvent(event);
  if (!rightErase && !edge) return;

  els.canvas.setPointerCapture(event.pointerId);
  state.drawing = true;
  state.rightErase = rightErase;
  state.lastEdgeId = null;
  state.pendingToggle = null;
  state.longPressHandled = false;
  beginHistory();

  if (rightErase) {
    if (edge) applyRightErase(edge.id);
    return;
  }

  if (state.mode === "toggle") {
    state.pendingToggle = edge.id;
    state.longPressTimer = window.setTimeout(() => {
      toggleLock(edge.id);
      state.longPressHandled = true;
      state.pendingToggle = null;
      finishHistory();
      renderAll();
    }, 520);
    return;
  }

  applyEdgeMode(edge.id);
}

function onPointerMove(event) {
  if (!state.drawing) return;
  const edge = findEdgeAtEvent(event);

  if (state.rightErase) {
    if (edge && edge.id !== state.lastEdgeId) applyRightErase(edge.id);
    return;
  }

  if (!edge || edge.id === state.lastEdgeId) return;

  if (state.mode === "toggle") {
    clearLongPress();
    return;
  }

  applyEdgeMode(edge.id);
}

function onPointerUp(event) {
  if (!state.drawing) return;
  if (event && els.canvas.hasPointerCapture(event.pointerId)) {
    els.canvas.releasePointerCapture(event.pointerId);
  }
  clearLongPress();

  if (!state.rightErase && state.mode === "toggle" && state.pendingToggle && !state.longPressHandled) {
    toggleEdge(state.pendingToggle);
  }

  state.drawing = false;
  state.rightErase = false;
  state.pendingToggle = null;
  state.longPressHandled = false;
  finishHistory();
  renderAll();
}

function isRightEraseEvent(event) {
  return event.button === 2 || (event.buttons & 2) === 2;
}

function clearLongPress() {
  if (state.longPressTimer) {
    window.clearTimeout(state.longPressTimer);
    state.longPressTimer = null;
  }
}

function findEdgeAtEvent(event) {
  const rect = els.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const layout = getLayout(rect.width, rect.height);
  let best = null;
  let bestDistance = Infinity;
  const tolerance = Math.max(14, layout.cell * 0.16);

  for (const edge of EDGES) {
    const a = pointToCanvas(layout, edge.x1, edge.y1);
    const b = pointToCanvas(layout, edge.x2, edge.y2);
    const distance = distanceToSegment(x, y, a.x, a.y, b.x, b.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = edge;
    }
  }

  return bestDistance <= tolerance ? best : null;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const lengthSq = vx * vx + vy * vy;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSq));
  const x = x1 + t * vx;
  const y = y1 + t * vy;
  return Math.hypot(px - x, py - y);
}

function applyEdgeMode(edgeId) {
  state.lastEdgeId = edgeId;
  if (state.mode === "draw") {
    setEdge(edgeId, true, true);
  } else if (state.mode === "erase") {
    setEdge(edgeId, false, false);
  } else if (state.mode === "lock") {
    toggleLock(edgeId);
  }
  renderAll();
}

function applyRightErase(edgeId) {
  state.lastEdgeId = edgeId;
  const glyph = currentGlyph();
  glyph.activeEdges.delete(edgeId);
  glyph.lockedEdges.delete(edgeId);
  markManual(glyph);
  renderAll();
}

function toggleEdge(edgeId) {
  const glyph = currentGlyph();
  const active = glyph.activeEdges.has(edgeId);
  setEdge(edgeId, !active, !active);
}

function setEdge(edgeId, active, lockWhenOn) {
  const glyph = currentGlyph();
  if (active) {
    glyph.activeEdges.add(edgeId);
    if (lockWhenOn) glyph.lockedEdges.add(edgeId);
  } else {
    if (glyph.lockedEdges.has(edgeId) && state.mode === "erase") return;
    glyph.activeEdges.delete(edgeId);
    glyph.lockedEdges.delete(edgeId);
  }
  markManual(glyph);
}

function toggleLock(edgeId) {
  const glyph = currentGlyph();
  if (glyph.lockedEdges.has(edgeId)) {
    glyph.lockedEdges.delete(edgeId);
  } else {
    glyph.activeEdges.add(edgeId);
    glyph.lockedEdges.add(edgeId);
  }
  markManual(glyph);
}

function markManual(glyph) {
  glyph.status = normalizeStatus(glyph.status);
}

function runAutoTrace(glyph) {
  const scores = scoreEdges(glyph);
  glyph.candidateScores = scores;

  const settings = glyph.autoSettings;
  const sensitivity = settings.sensitivity / 100;
  const density = settings.density / 100;
  const simplify = settings.simplify / 100;
  const threshold = clamp(0.34 - sensitivity * 0.24 - (density - 0.5) * 0.1, 0.045, 0.42);
  const limitRatio = 0.18 + density * 0.52 - simplify * 0.32;
  const limit = clamp(Math.round(EDGES.length * limitRatio), Math.min(4, EDGES.length), EDGES.length);

  const sorted = EDGES
    .map((edge) => ({ edge, score: scores[edge.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  const selected = new Set(glyph.lockedEdges);
  for (const item of sorted) {
    if (selected.size >= limit) break;
    if (item.score >= threshold) selected.add(item.edge.id);
  }

  if (settings.connect > 0) {
    addConnectingEdges(selected, sorted, scores, threshold, settings);
  }

  for (const id of glyph.lockedEdges) selected.add(id);
  glyph.activeEdges = selected;

  glyph.status = normalizeStatus(glyph.status);
}

function scoreEdges(glyph) {
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const maskCtx = canvas.getContext("2d", { willReadFrequently: true });
  const layout = getLayout(size, size, 0.04, 0);
  drawMask(maskCtx, glyph, size, layout);
  const image = maskCtx.getImageData(0, 0, size, size);
  const scores = {};
  const settings = glyph.autoSettings;
  const radius = Math.max(2, Math.round(layout.cell * (settings.probe / 100)));
  const hFactor = 1 + Math.max(0, -settings.bias) / 100 - Math.max(0, settings.bias) / 150;
  const vFactor = 1 + Math.max(0, settings.bias) / 100 - Math.max(0, -settings.bias) / 150;

  for (const edge of EDGES) {
    const raw = sampleEdge(image.data, size, edge, radius, layout);
    const factor = edge.type === "h" ? hFactor : vFactor;
    scores[edge.id] = clamp(raw * factor, 0, 1);
  }

  return scores;
}

function drawMask(context, glyph, size, layout) {
  drawMaskChar(context, glyph.char, size, layout, state.reference.transform, state.reference.font);
}

function drawMaskChar(context, char, size, layout, transform, fontFamily) {
  const tr = transform;
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#000000";
  context.strokeStyle = "#000000";
  context.lineJoin = "round";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const fontSize = Math.min(layout.gridWidth || layout.size, layout.gridHeight || layout.size) * tr.scale;
  context.font = `800 ${fontSize}px ${fontFamily}`;
  const cell = layout.cell;
  const x = layout.left + (layout.gridWidth || layout.size) / 2 + tr.offsetX * cell;
  const y = layout.top + (layout.gridHeight || layout.size) / 2 + tr.offsetY * cell;
  if (tr.weight > 0) {
    context.lineWidth = tr.weight * (size / 620);
    context.strokeText(char, x, y);
  }
  context.fillText(char, x, y);
}

function sampleEdge(data, size, edge, radius, layout) {
  const a = pointToCanvas(layout, edge.x1, edge.y1);
  const b = pointToCanvas(layout, edge.x2, edge.y2);
  const x1 = a.x;
  const y1 = a.y;
  const x2 = b.x;
  const y2 = b.y;
  const steps = 56;
  const offsetStep = 2;
  let weightedInk = 0;
  let totalWeight = 0;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (let offset = -radius; offset <= radius; offset += offsetStep) {
      const sx = edge.type === "h" ? x : x + offset;
      const sy = edge.type === "h" ? y + offset : y;
      if (sx < 0 || sx >= size || sy < 0 || sy >= size) continue;
      const weight = 1 - Math.abs(offset) / (radius + 1);
      const ix = clamp(Math.round(sx), 0, size - 1);
      const iy = clamp(Math.round(sy), 0, size - 1);
      const index = (iy * size + ix) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const ink = 1 - (r + g + b) / 765;
      weightedInk += ink * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedInk / totalWeight : 0;
}

function addConnectingEdges(selected, sorted, scores, threshold, settings) {
  const extraLimit = Math.round(settings.connect / 8);
  const bridgeThreshold = threshold * (0.9 - settings.connect * 0.0035);
  let added = 0;

  for (const item of sorted) {
    if (added >= extraLimit) break;
    if (selected.has(item.edge.id) || item.score < bridgeThreshold) continue;
    const a = `${item.edge.x1},${item.edge.y1}`;
    const b = `${item.edge.x2},${item.edge.y2}`;
    const degreeA = endpointDegree(selected, a);
    const degreeB = endpointDegree(selected, b);
    if (degreeA > 0 && degreeB > 0) {
      selected.add(item.edge.id);
      added += 1;
    }
  }
}

function endpointDegree(edgeIds, pointKey) {
  let degree = 0;
  for (const id of edgeIds) {
    const edge = EDGE_BY_ID.get(id);
    if (!edge) continue;
    if (`${edge.x1},${edge.y1}` === pointKey || `${edge.x2},${edge.y2}` === pointKey) {
      degree += 1;
    }
  }
  return degree;
}

function transformCurrentEdges(mapper) {
  withHistory(() => {
    const glyph = currentGlyph();
    glyph.activeEdges = new Set(Array.from(glyph.activeEdges, mapper).filter(Boolean));
    glyph.lockedEdges = new Set(Array.from(glyph.lockedEdges, mapper).filter(Boolean));
    markManual(glyph);
  });
  renderAll();
}

function rotateCurrentClockwise() {
  const glyph = currentGlyph();
  const oldEdgeById = EDGE_BY_ID;
  const activeIds = Array.from(glyph.activeEdges);
  const lockedIds = Array.from(glyph.lockedEdges);

  withHistory(() => {
    const rotatedActive = new Set();
    const rotatedLocked = new Set();
    const oldCols = GRID_COLS;
    const oldRows = GRID_ROWS;

    setGridSize(oldRows, oldCols, { remap: false });

    for (const id of activeIds) {
      const nextId = rotateCWEdgeWithSize(id, oldCols, oldRows, oldEdgeById);
      if (nextId && EDGE_BY_ID.has(nextId)) rotatedActive.add(nextId);
    }
    for (const id of lockedIds) {
      const nextId = rotateCWEdgeWithSize(id, oldCols, oldRows, oldEdgeById);
      if (nextId && EDGE_BY_ID.has(nextId)) rotatedLocked.add(nextId);
    }

    glyph.activeEdges = rotatedActive;
    glyph.lockedEdges = rotatedLocked;
    glyph.candidateScores = {};
    markManual(glyph);
  });

  syncAllControls();
  renderAll();
}

function alignCurrentEdges(direction) {
  const glyph = currentGlyph();
  const bounds = getEdgeBounds(glyph.activeEdges);
  if (!bounds) return;

  let dx = 0;
  let dy = 0;
  if (direction === "left") dx = -bounds.minX;
  if (direction === "right") dx = GRID_COLS - bounds.maxX;
  if (direction === "up") dy = -bounds.minY;
  if (direction === "down") dy = GRID_ROWS - bounds.maxY;
  if (dx === 0 && dy === 0) return;

  withHistory(() => {
    glyph.activeEdges = shiftEdgeSet(glyph.activeEdges, dx, dy);
    glyph.lockedEdges = shiftEdgeSet(glyph.lockedEdges, dx, dy);
    glyph.candidateScores = {};
    markManual(glyph);
  });
  renderAll();
}

function populatePartNameSelect() {
  els.partNameSelect.replaceChildren();
  for (const group of KANJI_PART_NAME_GROUPS) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const name of group.names.split(/\s+/).filter(Boolean)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      optgroup.append(option);
    }
    els.partNameSelect.append(optgroup);
  }

  const other = document.createElement("option");
  other.value = "other";
  other.textContent = "その他";
  els.partNameSelect.append(other);
  syncPartCustomNameVisibility();
}

function syncPartCustomNameVisibility() {
  const showCustom = els.partNameSelect.value === "other";
  els.partCustomNameRow.hidden = !showCustom;
}

function getSelectedPartName(fallback) {
  if (els.partNameSelect.value === "other") {
    return (els.partNameInput.value || fallback || "部品").trim();
  }
  return els.partNameSelect.value || fallback || "部品";
}

function renderPartLibrary() {
  const fragment = document.createDocumentFragment();

  if (state.parts.length === 0) {
    const note = document.createElement("p");
    note.className = "note-line";
    note.textContent = "保存済み部品はありません";
    fragment.append(note);
    els.partLibrary.replaceChildren(fragment);
    return;
  }

  for (const part of state.parts) {
    const item = document.createElement("div");
    item.className = "part-item";

    const preview = document.createElement("div");
    preview.className = "part-preview";
    preview.innerHTML = buildPartSvg(part, { size: 72, strokeWidth: 8, pad: 8 });

    const meta = document.createElement("div");
    meta.className = "part-meta";

    const name = document.createElement("strong");
    name.textContent = part.name;

    const size = document.createElement("span");
    size.textContent = `${part.gridCols}x${part.gridRows}`;
    meta.append(name, size);

    const actions = document.createElement("div");
    actions.className = "part-actions";
    actions.append(
      createPartActionButton(part.id, "paste", "貼る"),
      createPartActionButton(part.id, "delete", "削除")
    );

    item.append(preview, meta, actions);
    fragment.append(item);
  }

  els.partLibrary.replaceChildren(fragment);
}

function createPartActionButton(partId, action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = action === "delete" ? "danger-button" : "ghost-button";
  button.dataset.partId = partId;
  button.dataset.partAction = action;
  button.textContent = label;
  return button;
}

function saveCurrentAsPart() {
  const glyph = currentGlyph();
  if (!glyph || glyph.activeEdges.size === 0) {
    els.charSetNote.textContent = "部品化する辺がありません";
    return;
  }

  const name = getSelectedPartName(glyph.char);
  const bounds = getEdgeBounds(glyph.activeEdges);
  const part = {
    id: `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
    bounds,
    activeEdges: Array.from(glyph.activeEdges),
    lockedEdges: Array.from(glyph.lockedEdges)
  };

  state.parts.push(part);
  els.partNameInput.value = "";
  persist();
  renderPartLibrary();
}

function pastePart(partId) {
  const part = state.parts.find((item) => item.id === partId);
  if (!part) return;
  const activeEdges = remapPartEdgesExact(part.activeEdges, part);
  const lockedEdges = remapPartEdgesExact(part.lockedEdges || [], part);
  if (activeEdges.size === 0) return;

  withHistory(() => {
    const glyph = currentGlyph();
    for (const id of activeEdges) glyph.activeEdges.add(id);
    for (const id of lockedEdges) glyph.lockedEdges.add(id);
    glyph.candidateScores = {};
    markManual(glyph);
  });
  renderAll();
}

function deletePart(partId) {
  state.parts = state.parts.filter((part) => part.id !== partId);
  persist();
  renderPartLibrary();
}

function remapPartEdgesExact(edgeIds, part) {
  const sourceEdgeById = new Map(createEdges(part.gridCols, part.gridRows).map((edge) => [edge.id, edge]));
  if (part.gridCols === GRID_COLS && part.gridRows === GRID_ROWS) {
    return new Set(edgeIds.filter((id) => sourceEdgeById.has(id) && EDGE_BY_ID.has(id)));
  }

  return remapEdgeSet(
    new Set(edgeIds),
    part.gridCols,
    part.gridRows,
    GRID_COLS,
    GRID_ROWS,
    sourceEdgeById
  );
}

function getEdgeBounds(edgeIds) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of edgeIds) {
    const edge = EDGE_BY_ID.get(id);
    if (!edge) continue;
    minX = Math.min(minX, edge.x1, edge.x2);
    minY = Math.min(minY, edge.y1, edge.y2);
    maxX = Math.max(maxX, edge.x1, edge.x2);
    maxY = Math.max(maxY, edge.y1, edge.y2);
  }

  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

function shiftEdgeSet(edgeIds, dx, dy) {
  const shifted = new Set();
  for (const id of edgeIds) {
    const edge = EDGE_BY_ID.get(id);
    if (!edge) continue;
    const nextId = edgeIdFromPoints(
      { x: edge.x1 + dx, y: edge.y1 + dy },
      { x: edge.x2 + dx, y: edge.y2 + dy }
    );
    if (nextId && EDGE_BY_ID.has(nextId)) shifted.add(nextId);
  }
  return shifted;
}

function mirrorXEdge(id) {
  const edge = EDGE_BY_ID.get(id);
  if (!edge) return null;
  if (edge.type === "h") return `h-${GRID_COLS - 1 - edge.x1}-${edge.y1}`;
  return `v-${GRID_COLS - edge.x1}-${edge.y1}`;
}

function mirrorYEdge(id) {
  const edge = EDGE_BY_ID.get(id);
  if (!edge) return null;
  if (edge.type === "h") return `h-${edge.x1}-${GRID_ROWS - edge.y1}`;
  return `v-${edge.x1}-${GRID_ROWS - 1 - edge.y1}`;
}

function rotateCWEdge(id) {
  const edge = EDGE_BY_ID.get(id);
  if (!edge) return null;
  const a = rotatePoint(edge.x1, edge.y1);
  const b = rotatePoint(edge.x2, edge.y2);
  return edgeIdFromPoints(a, b);
}

function rotatePoint(x, y) {
  return { x: GRID_ROWS - y, y: x };
}

function rotateCWEdgeWithSize(id, cols, rows, edgeById) {
  const edge = edgeById.get(id);
  if (!edge) return null;
  const a = { x: rows - edge.y1, y: edge.x1 };
  const b = { x: rows - edge.y2, y: edge.x2 };
  return edgeIdFromPoints(a, b);
}

function edgeIdFromPoints(a, b) {
  if (a.y === b.y) {
    return `h-${Math.min(a.x, b.x)}-${a.y}`;
  }
  if (a.x === b.x) {
    return `v-${a.x}-${Math.min(a.y, b.y)}`;
  }
  return null;
}

async function loadUploadedFont() {
  const file = els.fontUpload.files && els.fontUpload.files[0];
  if (!file) return;
  const family = `UploadedFont${Date.now()}`;
  const source = await readFileAsDataUrl(file);
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, "");
  try {
    await registerCustomFont({ family, name, source });
    els.fontSelect.value = family;
    withHistory(() => {
      state.customFonts = state.customFonts.filter((font) => font.family !== family);
      state.customFonts.push({ family, name, source });
      state.reference.font = family;
    });
    persist();
    renderAll();
  } catch (error) {
    els.charSetNote.textContent = `フォント読込エラー: ${error.message}`;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolveRead, rejectRead) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolveRead(reader.result));
    reader.addEventListener("error", () => rejectRead(reader.error || new Error("Font file could not be read")));
    reader.readAsDataURL(file);
  });
}

async function registerCustomFont(fontMeta) {
  if (!fontMeta || !fontMeta.family || !fontMeta.source) return;
  const font = new FontFace(fontMeta.family, `url(${fontMeta.source})`);
  await font.load();
  document.fonts.add(font);
  ensureFontOption(fontMeta.family, fontMeta.name || fontMeta.family);
}

function ensureFontOption(value, label) {
  const exists = Array.from(els.fontSelect.options).some((option) => option.value === value);
  if (exists) return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  els.fontSelect.append(option);
}

function applyCharSet(text) {
  const parsed = parseCharSet(text);
  if (parsed.chars.length === 0) {
    els.charSetNote.textContent = "文字がありません";
    return;
  }

  withHistory(() => {
    const existing = new Map(state.glyphs.map((glyph) => [glyph.char, glyph]));
    state.glyphs = parsed.chars.map((char) => existing.get(char) || createGlyph(char));
    state.current = Math.min(state.current, state.glyphs.length - 1);
  });

  els.charSetInput.value = state.glyphs.map((glyph) => glyph.char).join("");
  const rejected = parsed.rejected.length > 0 ? ` / 除外: ${parsed.rejected.join("")}` : "";
  els.charSetNote.textContent = `${state.glyphs.length}文字${rejected}`;
  syncAllControls();
  renderAll();
}

function useCharSet(chars) {
  const text = chars.join("");
  els.charSetInput.value = text;
  applyCharSet(text);
}

function markCompletedGlyphs() {
  const completed = new Set(COMPLETED_CHARS);
  let marked = 0;

  withHistory(() => {
    for (const glyph of state.glyphs) {
      if (completed.has(glyph.char)) {
        glyph.status = "完成";
        marked += 1;
      }
    }
  });

  els.charSetNote.textContent = `${marked}文字を完成にしました`;
  renderAll();
}

function parseCharSet(text) {
  const chars = [];
  const rejected = [];
  const seen = new Set();
  for (const char of expandTextToGlyphTokens(text)) {
    if (/\s/.test(char)) continue;
    if (!seen.has(char)) {
      seen.add(char);
      chars.push(char);
    }
  }
  return { chars, rejected };
}

function classifyGlyphFolder(char) {
  if (DIGIT_CHARS.includes(char)) return "digit";
  if (LATIN_CHARS.includes(char)) return "latin";
  if (HIRAGANA_CHARS.includes(char)) return "hiragana";
  if (KATAKANA_CHARS.includes(char)) return "katakana";
  if (ASCII_SYMBOL_CHARS.includes(char) || FULL_WIDTH_SYMBOL_CHARS.includes(char)) return "symbol";
  if (isHan(char)) return "kanji";
  return "other";
}

function isLatinLowercase(char) {
  return /^[a-z]$/.test(char);
}

function isHan(char) {
  try {
    return /\p{Script=Han}/u.test(char);
  } catch {
    return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
  }
}

function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (segment) => segment.segment.normalize("NFC"));
  }

  const chars = [];
  for (const char of Array.from(text)) {
    if (/[\u0300-\u036f\u3099\u309a]/.test(char) && chars.length > 0) {
      chars[chars.length - 1] += char;
    } else {
      chars.push(char);
    }
  }
  return chars.map((char) => char.normalize("NFC"));
}

function expandTextToGlyphTokens(text) {
  return splitGraphemes(text).flatMap(expandKanaMarks);
}

function expandKanaMarks(grapheme) {
  if (grapheme === "゛" || grapheme === "ﾞ") return ["゛"];
  if (grapheme === "゜" || grapheme === "ﾟ") return ["゜"];

  const decomposed = grapheme.normalize("NFD");
  const tokens = [];
  for (const char of Array.from(decomposed)) {
    if (char === "\u3099") {
      tokens.push("゛");
    } else if (char === "\u309a") {
      tokens.push("゜");
    } else if (char === "ﾞ") {
      tokens.push("゛");
    } else if (char === "ﾟ") {
      tokens.push("゜");
    } else {
      tokens.push(char.normalize("NFC"));
    }
  }
  return tokens.length > 0 ? tokens : [grapheme];
}

function uniqueChars(chars) {
  const unique = [];
  const seen = new Set();
  for (const char of chars) {
    if (seen.has(char)) continue;
    seen.add(char);
    unique.push(char);
  }
  return unique;
}

function saveProjectJson() {
  const json = JSON.stringify(serializeProject(), null, 2);
  downloadText("trace-logo-project.json", json, "application/json");
}

function loadProjectJson() {
  const file = els.loadJson.files && els.loadJson.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const project = JSON.parse(String(reader.result));
      restoreProject(project);
      state.undoStack = [];
      state.redoStack = [];
      syncAllControls();
      renderAll();
      persist();
      els.charSetNote.textContent = `${state.glyphs.length}文字を読み込みました`;
    } catch (error) {
      els.charSetNote.textContent = `JSON読込エラー: ${error.message}`;
    }
  };
  reader.readAsText(file);
}

function exportCurrentSvg() {
  const glyph = currentGlyph();
  const svg = buildSvg(glyph, { size: 600, strokeWidth: 22, pad: 60, includeXml: true });
  const safeName = glyph.char.codePointAt(0).toString(16).toUpperCase();
  downloadText(`glyph-${safeName}.svg`, svg, "image/svg+xml");
}

function renderDuplicateResults() {
  const threshold = Number(els.duplicateThreshold.value) / 100;
  const matches = findSimilarGlyphs(threshold);
  state.duplicateExactChars = new Set(
    matches
      .filter((match) => match.exact)
      .flatMap((match) => [match.a.char, match.b.char])
  );
  const fragment = document.createDocumentFragment();

  if (matches.length === 0) {
    const note = document.createElement("p");
    note.className = "note-line";
    note.textContent = "重複候補はありません";
    fragment.append(note);
  }

  for (const match of matches.slice(0, 80)) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "duplicate-item";
    item.addEventListener("click", () => renderDuplicateCompare(match));

    const main = document.createElement("span");
    main.className = "duplicate-row-main";

    const pair = document.createElement("span");
    pair.className = "duplicate-list-pair";
    pair.textContent = `${match.a.char} / ${match.b.char}`;

    const meta = document.createElement("div");
    meta.className = "duplicate-meta";

    const kind = document.createElement("span");
    kind.className = "duplicate-kind";
    kind.textContent = match.exact ? "完全一致" : "ほぼ同じ";

    const score = document.createElement("span");
    score.className = "duplicate-score";
    score.textContent = `${Math.round(match.score * 100)}%`;

    meta.append(kind, score);
    main.append(pair, meta);

    const actions = document.createElement("span");
    actions.className = "duplicate-row-actions";
    actions.append(
      createDuplicateRowEditButton(match.a.char, match.aIndex),
      createDuplicateRowEditButton(match.b.char, match.bIndex)
    );

    item.append(main, actions);
    fragment.append(item);
  }

  if (matches.length > 80) {
    const note = document.createElement("p");
    note.className = "note-line";
    note.textContent = `他 ${matches.length - 80} 件あります`;
    fragment.append(note);
  }

  els.duplicateResults.replaceChildren(fragment);
  renderList();
  if (matches.length > 0) {
    renderDuplicateCompare(matches[0]);
  } else {
    els.duplicateCompare.replaceChildren();
    els.duplicateCompare.classList.remove("has-selection");
  }
}

function createDuplicateRowEditButton(char, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `${char}編集`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    focusGlyph(index);
  });
  return button;
}

function renderDuplicateCompare(match) {
  const title = document.createElement("div");
  title.className = "duplicate-compare-title";

  const pair = document.createElement("span");
  pair.textContent = `${match.a.char} / ${match.b.char}`;

  const score = document.createElement("span");
  score.textContent = `${match.exact ? "完全一致" : "類似"} ${Math.round(match.score * 100)}%`;

  title.append(pair, score);

  const previews = document.createElement("div");
  previews.className = "duplicate-compare-previews";
  previews.append(
    createDuplicateCompareCard(match.a, match.aIndex, match),
    createDuplicateCompareCard(match.b, match.bIndex, match)
  );

  els.duplicateCompare.replaceChildren(title, previews);
  els.duplicateCompare.classList.add("has-selection");
}

function createDuplicateCompareCard(glyph, index, match) {
  const card = document.createElement("div");
  card.className = "duplicate-compare-card";

  const svg = document.createElement("div");
  svg.innerHTML = buildSvg(glyph, { size: 160, strokeWidth: 14, pad: 18, includeXml: false });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "duplicate-edit-button";
  button.textContent = `${glyph.char} を編集`;
  button.addEventListener("click", () => focusGlyph(index));

  const nudge = document.createElement("div");
  nudge.className = "duplicate-nudge-grid";
  for (const [label, dx, dy] of [
    ["←", -1, 0],
    ["↑", 0, -1],
    ["↓", 0, 1],
    ["→", 1, 0]
  ]) {
    const nudgeButton = document.createElement("button");
    nudgeButton.type = "button";
    nudgeButton.textContent = label;
    nudgeButton.title = `${glyph.char} を1マス移動`;
    nudgeButton.addEventListener("click", () => {
      nudgeGlyphByIndex(index, dx, dy);
      renderDuplicateCompare(refreshDuplicateMatch(match));
    });
    nudge.append(nudgeButton);
  }

  card.append(svg, button, nudge);
  return card;
}

function focusGlyph(index) {
  state.current = index;
  syncAllControls();
  persist();
  renderAll();
}

function nudgeGlyphByIndex(index, dx, dy) {
  const glyph = state.glyphs[index];
  if (!glyph || glyph.activeEdges.size === 0) return;
  const bounds = getEdgeBounds(glyph.activeEdges);
  if (!bounds) return;
  if (bounds.minX + dx < 0 || bounds.maxX + dx > GRID_COLS) return;
  if (bounds.minY + dy < 0 || bounds.maxY + dy > GRID_ROWS) return;

  withHistory(() => {
    glyph.activeEdges = shiftEdgeSet(glyph.activeEdges, dx, dy);
    glyph.lockedEdges = shiftEdgeSet(glyph.lockedEdges, dx, dy);
    glyph.candidateScores = {};
  });

  state.current = index;
  syncAllControls();
  renderAll();
}

function refreshDuplicateMatch(match) {
  const a = state.glyphs[match.aIndex];
  const b = state.glyphs[match.bIndex];
  const aSignature = getGlyphSignature(a.activeEdges);
  const bSignature = getGlyphSignature(b.activeEdges);
  const exact = setEquals(aSignature, bSignature);
  const score = exact ? 1 : getGlyphSimilarity(a, b);
  return {
    ...match,
    a,
    b,
    exact,
    score
  };
}

function findSimilarGlyphs(threshold) {
  const comparable = state.glyphs
    .map((glyph, index) => ({
      glyph,
      index,
      signature: getGlyphSignature(glyph.activeEdges),
      normalized: getNormalizedSignature(glyph.activeEdges)
    }))
    .filter((item) => item.signature.size > 0);

  const matches = [];
  for (let i = 0; i < comparable.length; i += 1) {
    for (let j = i + 1; j < comparable.length; j += 1) {
      const a = comparable[i];
      const b = comparable[j];
      const exact = setEquals(a.signature, b.signature);
      const score = exact ? 1 : getGlyphSimilarity(a.glyph, b.glyph);
      if (exact || score >= threshold) {
        matches.push({
          a: a.glyph,
          b: b.glyph,
          aIndex: a.index,
          bIndex: b.index,
          exact,
          score
        });
      }
    }
  }

  return matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return b.score - a.score;
  });
}

function getGlyphSignature(edgeIds) {
  return new Set(Array.from(edgeIds).filter((id) => EDGE_BY_ID.has(id)).sort());
}

function getNormalizedSignature(edgeIds) {
  const bounds = getEdgeBounds(edgeIds);
  if (!bounds) return new Set();
  const normalized = new Set();
  for (const id of edgeIds) {
    const edge = EDGE_BY_ID.get(id);
    if (!edge) continue;
    const nextId = edgeIdFromPoints(
      { x: edge.x1 - bounds.minX, y: edge.y1 - bounds.minY },
      { x: edge.x2 - bounds.minX, y: edge.y2 - bounds.minY }
    );
    if (nextId) normalized.add(nextId);
  }
  return normalized;
}

function getGlyphSimilarity(aGlyph, bGlyph) {
  const shapeScore = jaccardSimilarity(
    getNormalizedSignature(aGlyph.activeEdges),
    getNormalizedSignature(bGlyph.activeEdges)
  );
  const aBounds = getEdgeBounds(aGlyph.activeEdges);
  const bBounds = getEdgeBounds(bGlyph.activeEdges);
  if (!aBounds || !bBounds) return shapeScore;

  const aWidth = aBounds.maxX - aBounds.minX;
  const bWidth = bBounds.maxX - bBounds.minX;
  const aHeight = aBounds.maxY - aBounds.minY;
  const bHeight = bBounds.maxY - bBounds.minY;
  const sizeDiff = Math.abs(aWidth - bWidth) + Math.abs(aHeight - bHeight);
  const positionDiff = Math.abs(aBounds.minX - bBounds.minX) + Math.abs(aBounds.minY - bBounds.minY);
  const penalty = Math.min(0.35, sizeDiff * 0.08 + positionDiff * 0.035);
  return clamp(shapeScore - penalty, 0, 1);
}

function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function setEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function buildSvg(glyph, options) {
  const { size, strokeWidth, pad, includeXml } = options;
  const yOffsetCells = options.yOffsetCells || 0;
  const cell = Math.min((size - pad * 2) / GRID_COLS, (size - pad * 2) / GRID_ROWS);
  const gridWidth = cell * GRID_COLS;
  const gridHeight = cell * GRID_ROWS;
  const left = (size - gridWidth) / 2;
  const top = (size - gridHeight) / 2;
  const viewBox = getSvgViewBox(glyph, options);
  const lines = Array.from(glyph.activeEdges)
    .map((id) => EDGE_BY_ID.get(id))
    .filter(Boolean)
    .map((edge) => {
      const x1 = left + edge.x1 * cell;
      const y1 = top + (edge.y1 + yOffsetCells) * cell;
      const x2 = left + edge.x2 * cell;
      const y2 = top + (edge.y2 + yOffsetCells) * cell;
      const color = glyph.lockedEdges.has(edge.id) ? "#171a18" : "#0f766e";
      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="square"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.map(round).join(" ")}" role="img" aria-label="${escapeAttr(glyph.char)}" preserveAspectRatio="xMidYMid meet">${lines}</svg>`;
  return includeXml ? `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n` : svg;
}

function buildPartSvg(part, options) {
  const { size, strokeWidth, pad } = options;
  const cols = part.gridCols || GRID_COLS;
  const rows = part.gridRows || GRID_ROWS;
  const cell = Math.min((size - pad * 2) / cols, (size - pad * 2) / rows);
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  const left = (size - gridWidth) / 2;
  const top = (size - gridHeight) / 2;
  const edgeById = new Map(createEdges(cols, rows).map((edge) => [edge.id, edge]));
  const locked = new Set(part.lockedEdges || []);
  const lines = Array.from(part.activeEdges || [])
    .map((id) => edgeById.get(id))
    .filter(Boolean)
    .map((edge) => {
      const x1 = left + edge.x1 * cell;
      const y1 = top + edge.y1 * cell;
      const x2 = left + edge.x2 * cell;
      const y2 = top + edge.y2 * cell;
      const color = locked.has(edge.id) ? "#171a18" : "#0f766e";
      return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="square"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeAttr(part.name)}">${lines}</svg>`;
}

function getSvgViewBox(glyph, options) {
  const { size, strokeWidth, pad } = options;
  const previewTopPadCells = options.previewTopPadCells || 0;
  const previewBottomPadCells = options.previewBottomPadCells || 0;
  const bounds = options.trim || options.trimX ? getEdgeBounds(glyph.activeEdges) : null;
  const cell = Math.min((size - pad * 2) / GRID_COLS, (size - pad * 2) / GRID_ROWS);
  if (!bounds) {
    if (previewTopPadCells || previewBottomPadCells) {
      const extraTop = previewTopPadCells * cell;
      const extraBottom = previewBottomPadCells * cell;
      return [0, -extraTop, size, size + extraTop + extraBottom];
    }
    return [0, 0, size, size];
  }

  const gridWidth = cell * GRID_COLS;
  const gridHeight = cell * GRID_ROWS;
  const left = (size - gridWidth) / 2;
  const top = (size - gridHeight) / 2;
  const trimPad = strokeWidth * 0.62;
  const minX = Math.max(0, left + bounds.minX * cell - trimPad);
  const maxX = Math.min(size, left + bounds.maxX * cell + trimPad);

  if (options.trimX) {
    return [minX, 0, Math.max(1, maxX - minX), size];
  }

  const minY = Math.max(0, top + bounds.minY * cell - trimPad);
  const maxY = Math.min(size, top + bounds.maxY * cell + trimPad);
  return [minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY)];
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function serializeProject() {
  const settings = serializeProjectSettings();
  return {
    version: 2,
    savedAt: state.savedAt,
    grid: { cols: GRID_COLS, rows: GRID_ROWS },
    gridSize: GRID_COLS === GRID_ROWS ? GRID_COLS : undefined,
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
    customFonts: state.customFonts.map((font) => ({ ...font })),
    parts: state.parts.map((part) => ({
      ...part,
      activeEdges: [...part.activeEdges],
      lockedEdges: [...(part.lockedEdges || [])]
    })),
    composition: {
      kanaMarks: "separate-glyphs",
      dakuten: "゛",
      handakuten: "゜"
    },
    settings,
    view: settings.view,
    folderFilter: settings.folderFilter,
    preview: settings.preview,
    currentChar: settings.currentChar,
    mode: settings.mode,
    duplicateThreshold: settings.duplicateThreshold,
    glyphs: state.glyphs.map((glyph) => ({
      char: glyph.char,
      folder: classifyGlyphFolder(glyph.char),
      activeEdges: Array.from(glyph.activeEdges),
      lockedEdges: Array.from(glyph.lockedEdges),
      candidateScores: { ...glyph.candidateScores },
      autoSettings: { ...glyph.autoSettings },
      status: glyph.status
    }))
  };
}

function serializeProjectSettings() {
  return {
    view: { ...state.view },
    reference: {
      font: state.reference.font,
      transform: { ...state.reference.transform }
    },
    preview: { ...state.preview },
    folderFilter: state.folderFilter,
    currentChar: currentGlyph().char,
    currentIndex: state.current,
    mode: state.mode,
    duplicateThreshold: Number(els.duplicateThreshold.value)
  };
}

function restoreProject(project, options = {}) {
  if (!project || !Array.isArray(project.glyphs)) {
    throw new Error("glyphs が見つかりません");
  }
  if (project.glyphs.length === 0) {
    throw new Error("glyphs が空です");
  }
  const incomingCols = project.grid && project.grid.cols ? project.grid.cols : project.gridCols || project.gridSize;
  const incomingRows = project.grid && project.grid.rows ? project.grid.rows : project.gridRows || project.gridSize;
  setGridSize(incomingCols || DEFAULT_GRID_COLS, incomingRows || DEFAULT_GRID_ROWS, { remap: false });
  state.savedAt = typeof project.savedAt === "string" ? project.savedAt : null;
  state.customFonts = Array.isArray(project.customFonts)
    ? project.customFonts.filter((font) => font && font.family && font.source)
    : [];
  state.parts = Array.isArray(project.parts) ? project.parts.map(normalizePart).filter(Boolean) : [];
  restoreCustomFonts();
  const settings = project.settings || project;
  state.view = { ...DEFAULT_VIEW, ...(settings.view || {}) };
  const fallbackReferenceGlyph = project.glyphs.find((glyph) => glyph.referenceFont || glyph.referenceTransform) || {};
  state.reference = {
    font: (settings.reference && settings.reference.font) || project.referenceFont || fallbackReferenceGlyph.referenceFont || DEFAULT_REFERENCE.font,
    transform: {
      ...DEFAULT_REFERENCE.transform,
      ...((settings.reference && settings.reference.transform) || project.referenceTransform || fallbackReferenceGlyph.referenceTransform || {})
    }
  };
  state.preview = { ...DEFAULT_PREVIEW, ...(settings.preview || {}) };
  if (!["mono", "proportional"].includes(state.preview.spacing)) {
    state.preview.spacing = "mono";
  }
  state.folderFilter = FOLDER_FILTERS.some((filter) => filter.id === settings.folderFilter)
    ? settings.folderFilter
    : "all";
  state.mode = ["toggle", "draw", "erase", "lock"].includes(settings.mode) ? settings.mode : "toggle";
  state.glyphs = project.glyphs.map((item) => normalizeGlyph(item));
  const targetChar = options.currentChar || settings.currentChar;
  if (targetChar) {
    const sameCharIndex = state.glyphs.findIndex((glyph) => glyph.char === targetChar);
    state.current = sameCharIndex >= 0 ? sameCharIndex : Math.min(state.current, state.glyphs.length - 1);
  } else {
    const index = Number.isInteger(settings.currentIndex) ? settings.currentIndex : 0;
    state.current = clamp(index, 0, state.glyphs.length - 1);
  }
  if (Number.isFinite(Number(settings.duplicateThreshold))) {
    els.duplicateThreshold.value = clamp(Number(settings.duplicateThreshold), 70, 100);
    els.duplicateThresholdValue.value = `${els.duplicateThreshold.value}%`;
  }
  syncModeControls();
}

function normalizeGlyph(item) {
  const glyph = createGlyph(item.char || "?");
  glyph.activeEdges = new Set((item.activeEdges || []).filter((id) => EDGE_BY_ID.has(id)));
  glyph.lockedEdges = new Set((item.lockedEdges || []).filter((id) => EDGE_BY_ID.has(id)));
  glyph.candidateScores = item.candidateScores || {};
  glyph.referenceFont = item.referenceFont || glyph.referenceFont;
  glyph.referenceTransform = { ...DEFAULT_TRANSFORM, ...(item.referenceTransform || {}) };
  glyph.autoSettings = { ...DEFAULT_AUTO, ...(item.autoSettings || {}) };
  glyph.status = normalizeStatus(item.status);
  return glyph;
}

function normalizePart(item) {
  if (!item || !item.name || !Array.isArray(item.activeEdges)) return null;
  const gridCols = clampGridSize(item.gridCols || GRID_COLS);
  const gridRows = clampGridSize(item.gridRows || GRID_ROWS);
  const edgeIds = new Set(createEdges(gridCols, gridRows).map((edge) => edge.id));
  return {
    id: item.id || `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: item.name,
      placement: item.placement || "asis",
      gridCols,
      gridRows,
      bounds: item.bounds || null,
      activeEdges: item.activeEdges.filter((id) => edgeIds.has(id)),
      lockedEdges: Array.isArray(item.lockedEdges) ? item.lockedEdges.filter((id) => edgeIds.has(id)) : []
  };
}

function restoreCustomFonts() {
  for (const font of state.customFonts) {
    registerCustomFont(font)
      .then(renderAll)
      .catch((error) => {
        els.charSetNote.textContent = `Font restore error: ${error.message}`;
      });
  }
}

function normalizeStatus(status) {
  if (status === "完成" || status === "手動調整済み") return "完成";
  return "未完成";
}

function beginHistory() {
  if (state.historyStart === null) {
    state.historyStart = JSON.stringify(serializeProject());
  }
}

function finishHistory() {
  if (state.historyStart === null) return;
  const after = JSON.stringify(serializeProject());
  if (after !== state.historyStart) {
    state.undoStack.push(state.historyStart);
    if (state.undoStack.length > 80) state.undoStack.shift();
    state.redoStack = [];
    persist();
  }
  state.historyStart = null;
}

function withHistory(fn) {
  beginHistory();
  fn();
  finishHistory();
}

function undo() {
  const previous = state.undoStack.pop();
  if (!previous) return;
  const currentChar = currentGlyph().char;
  state.redoStack.push(JSON.stringify(serializeProject()));
  restoreProject(JSON.parse(previous), { currentChar });
  syncAllControls();
  renderAll();
  persist();
}

function redo() {
  const next = state.redoStack.pop();
  if (!next) return;
  const currentChar = currentGlyph().char;
  state.undoStack.push(JSON.stringify(serializeProject()));
  restoreProject(JSON.parse(next), { currentChar });
  syncAllControls();
  renderAll();
  persist();
}

function persist() {
  state.savedAt = new Date().toISOString();
  const json = JSON.stringify(serializeProject());
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
  scheduleRemoteSave(json);
}

async function loadInitialProject() {
  const localProject = readProjectFromStorage();
  const remoteProject = await loadRemoteProject();
  const project = chooseInitialProject(localProject, remoteProject);
  if (!project) return;

  try {
    restoreProject(project);
    cacheProjectLocally();
  } catch {
    state.glyphs = TEST_CHARS.map(createGlyph);
    state.current = 0;
  }
}

function readProjectFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheProjectLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject()));
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
}

async function loadRemoteProject() {
  if (location.protocol === "file:") return null;
  try {
    const response = await fetch(REMOTE_PROJECT_ENDPOINT, { cache: "no-store" });
    const apiAvailable = response.headers.get("x-trace-logo-api") === "1";
    remoteSaveAvailable = apiAvailable;
    if (!response.ok) return null;
    return await response.json();
  } catch {
    remoteSaveAvailable = false;
    return null;
  }
}

function chooseInitialProject(localProject, remoteProject) {
  if (!remoteProject) return localProject;
  if (!localProject) return remoteProject;

  const localTime = Date.parse(localProject.savedAt || "");
  const remoteTime = Date.parse(remoteProject.savedAt || "");
  if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
    return localTime > remoteTime ? localProject : remoteProject;
  }
  return remoteProject;
}

function scheduleRemoteSave(json) {
  if (!remoteSaveAvailable || location.protocol === "file:") return;
  pendingRemoteSaveJson = json;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(flushRemoteSave, REMOTE_SAVE_DEBOUNCE_MS);
}

async function flushRemoteSave() {
  if (remoteSaveInFlight || !pendingRemoteSaveJson) return;
  const json = pendingRemoteSaveJson;
  pendingRemoteSaveJson = "";
  remoteSaveInFlight = true;

  try {
    const response = await fetch(REMOTE_PROJECT_ENDPOINT, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: json
    });
    remoteSaveAvailable = response.headers.get("x-trace-logo-api") === "1";
    if (!response.ok) {
      console.warn("Remote autosave failed", response.status);
    }
  } catch (error) {
    console.warn("Remote autosave failed", error);
  } finally {
    remoteSaveInFlight = false;
    if (pendingRemoteSaveJson) {
      window.clearTimeout(remoteSaveTimer);
      remoteSaveTimer = window.setTimeout(flushRemoteSave, REMOTE_SAVE_DEBOUNCE_MS);
    }
  }
}

function flushRemoteSaveOnPageHide() {
  if (!remoteSaveAvailable || !pendingRemoteSaveJson || !navigator.sendBeacon) return;
  const blob = new Blob([pendingRemoteSaveJson], { type: "application/json" });
  navigator.sendBeacon(REMOTE_PROJECT_ENDPOINT, blob);
  pendingRemoteSaveJson = "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
