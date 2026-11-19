// Merges an autosave patch into the stored shared project. Glyphs are replaced
// one by one, so two people editing different characters never overwrite each
// other, and parts are merged by id for the same reason.

const WHOLE_VALUE_KEYS = ["grid", "gridSize", "gridCols", "gridRows", "customFonts", "composition"];

export function mergeProject(current, patch) {
  const merged = { ...current };
  const glyphs = Array.isArray(current.glyphs) ? current.glyphs.map((glyph) => ({ ...glyph })) : [];
  const glyphIndex = new Map(glyphs.map((glyph, index) => [glyph.char, index]));

  for (const glyph of patch.glyphs || []) {
    if (!glyph || typeof glyph.char !== "string") continue;
    const index = glyphIndex.get(glyph.char);
    if (index === undefined) {
      glyphIndex.set(glyph.char, glyphs.length);
      glyphs.push(glyph);
    } else {
      glyphs[index] = glyph;
    }
  }

  merged.glyphs = glyphs;
  if (patch.settings) merged.settings = mergeObject(current.settings, patch.settings);
  for (const key of WHOLE_VALUE_KEYS) {
    if (Object.hasOwn(patch, key)) merged[key] = patch[key];
  }
  if (Object.hasOwn(patch, "parts")) {
    // Older clients send the whole list without saying what they started from.
    merged.parts = Array.isArray(patch.partsBaseIds)
      ? mergePartsById(current.parts, patch.parts, patch.partsBaseIds)
      : patch.parts;
  }
  merged.savedAt = new Date().toISOString();
  merged.revision = Math.max(0, Number(current.revision) || 0) + 1;
  return merged;
}

// Three-way merge: keeps parts someone else added, drops the ones this editor
// deleted, and appends the ones this editor added.
export function mergePartsById(remoteParts, localParts, baseIds) {
  const remote = Array.isArray(remoteParts) ? remoteParts : [];
  const local = Array.isArray(localParts) ? localParts : [];
  const base = new Set(baseIds || []);
  const localIds = new Set(local.map((part) => part.id));
  const merged = remote.filter((part) => !base.has(part.id) || localIds.has(part.id));
  const mergedIds = new Set(merged.map((part) => part.id));
  for (const part of local) {
    if (!base.has(part.id) && !mergedIds.has(part.id)) merged.push(part);
  }
  return merged;
}

export function mergeObject(target, patch) {
  const result = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeObject(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
