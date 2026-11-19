// AI glyph proposals live in their own document, separate from the shared
// project. Proposals never change glyph data: a person adopts one in the app,
// and that edit travels through the normal per-glyph autosave.

export const PROPOSAL_STATUSES = ["pending", "adopted", "rejected"];

const EDGE_ID_PATTERN = /^(h|v|d1|d2)-(\d{1,2})-(\d{1,2})$/;
const MAX_ITEMS_PER_BATCH = 400;
const MAX_VARIANTS = 8;
const MAX_EDGES = 200;
const MAX_TEXT = 400;

export function emptyProposalDoc() {
  return { version: 1, revision: 0, updatedAt: null, items: {} };
}

export function normalizeProposalDoc(raw) {
  const doc = emptyProposalDoc();
  if (!raw || typeof raw !== "object") return doc;
  doc.revision = Math.max(0, Number(raw.revision) || 0);
  doc.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : null;
  if (raw.items && typeof raw.items === "object" && !Array.isArray(raw.items)) {
    for (const [char, item] of Object.entries(raw.items)) {
      if (item && typeof item === "object" && item.char === char && Array.isArray(item.variants)) {
        doc.items[char] = item;
      }
    }
  }
  return doc;
}

export function isValidEdgeId(id, cols, rows) {
  const match = typeof id === "string" ? EDGE_ID_PATTERN.exec(id) : null;
  if (!match) return false;
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (match[1] === "h") return x < cols && y <= rows;
  if (match[1] === "v") return x <= cols && y < rows;
  return x < cols && y < rows;
}

export function applyProposalBatch(current, body, now = new Date().toISOString()) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    throw requestError("Proposal batch must include items");
  }
  if (body.items.length > MAX_ITEMS_PER_BATCH) {
    throw requestError(`Proposal batch is limited to ${MAX_ITEMS_PER_BATCH} items`);
  }

  const doc = cloneDoc(current);
  const batch = cleanText(body.batch) || now.slice(0, 10);
  const chars = [];
  for (const raw of body.items) {
    const item = normalizeIncomingItem(raw, batch, now);
    const previous = doc.items[item.char];
    if (previous && previous.status !== "pending") {
      item.previous = {
        batch: previous.batch,
        status: previous.status,
        chosen: previous.chosen ?? null,
        comment: previous.comment || "",
        decidedAt: previous.decidedAt || null
      };
    } else if (previous && previous.previous) {
      item.previous = previous.previous;
    }
    doc.items[item.char] = item;
    chars.push(item.char);
  }
  return { doc: stamp(doc, now), chars };
}

export function applyProposalDecision(current, body, now = new Date().toISOString()) {
  if (!body || typeof body.char !== "string") throw requestError("Decision must include char");
  if (!PROPOSAL_STATUSES.includes(body.status)) throw requestError("Decision status is not supported");

  const doc = cloneDoc(current);
  const item = doc.items[body.char];
  if (!item) throw requestError("No proposal for this character", 404);
  if (body.createdAt && item.createdAt && body.createdAt !== item.createdAt) {
    throw requestError("The proposal was replaced after this decision was made", 409);
  }

  if (body.status === "adopted") {
    const chosen = Number(body.variant);
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= item.variants.length) {
      throw requestError("Adopted decision must name an existing variant");
    }
    item.chosen = chosen;
    item.final = Boolean(body.final);
  } else {
    item.chosen = null;
    delete item.final;
  }
  item.status = body.status;
  item.comment = body.status === "pending" ? "" : cleanText(body.comment);
  item.decidedAt = body.status === "pending" ? null : now;
  return stamp(doc, now);
}

function normalizeIncomingItem(raw, batch, now) {
  if (!raw || typeof raw.char !== "string" || !isSingleGlyphChar(raw.char)) {
    throw requestError("Each proposal needs a single character");
  }
  const cols = gridSize(raw.grid && raw.grid.cols);
  const rows = gridSize(raw.grid && raw.grid.rows);
  if (!Array.isArray(raw.variants) || raw.variants.length === 0 || raw.variants.length > MAX_VARIANTS) {
    throw requestError(`${raw.char}: variants must hold 1 to ${MAX_VARIANTS} entries`);
  }

  const variants = raw.variants.map((variant) => {
    const edges = variant && Array.isArray(variant.activeEdges) ? [...new Set(variant.activeEdges)] : [];
    if (edges.length === 0 || edges.length > MAX_EDGES) {
      throw requestError(`${raw.char}: each variant needs 1 to ${MAX_EDGES} edges`);
    }
    const invalid = edges.find((id) => !isValidEdgeId(id, cols, rows));
    if (invalid !== undefined) throw requestError(`${raw.char}: edge ${String(invalid)} is outside the ${cols}x${rows} grid`);
    // source names who drew the variant (a model or a person); the app hides it so reviews stay blind.
    return { activeEdges: edges, note: cleanText(variant.note), source: cleanText(variant.source).slice(0, 40) };
  });

  return {
    char: raw.char,
    batch,
    grid: { cols, rows },
    note: cleanText(raw.note),
    variants,
    status: "pending",
    chosen: null,
    comment: "",
    createdAt: now,
    decidedAt: null
  };
}

function isSingleGlyphChar(char) {
  if (char.length === 0 || char.length > 8 || /[\s\u0000-\u001f]/u.test(char)) return false;
  return [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(char)].length === 1;
}

function gridSize(value) {
  const size = value === undefined ? 4 : Number(value);
  if (!Number.isInteger(size) || size < 2 || size > 12) throw requestError("Proposal grid must be 2 to 12 cells");
  return size;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function cloneDoc(current) {
  return JSON.parse(JSON.stringify(normalizeProposalDoc(current)));
}

function stamp(doc, now) {
  doc.revision += 1;
  doc.updatedAt = now;
  return doc;
}

function requestError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
