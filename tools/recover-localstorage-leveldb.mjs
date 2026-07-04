import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
const output = process.argv[3] || "recovered-trace-logo-project.json";
const wanted = "trace-logo-editor:v1";

if (!input) {
  throw new Error("Usage: node tools/recover-localstorage-leveldb.mjs <file.ldb> [output.json]");
}

const data = readFileSync(input);

function readVarint(offset) {
  let result = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < data.length) {
    const byte = data[cursor++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result >>> 0, cursor];
    shift += 7;
  }
  throw new Error("Unterminated varint");
}

function readVarintFrom(buffer, offset) {
  let result = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < buffer.length) {
    const byte = buffer[cursor++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result >>> 0, cursor];
    shift += 7;
  }
  throw new Error("Unterminated block varint");
}

function decodeBlockHandle(offset) {
  const [blockOffset, afterOffset] = readVarint(offset);
  const [blockSize, afterSize] = readVarint(afterOffset);
  return [{ offset: blockOffset, size: blockSize }, afterSize];
}

function decodeEntries(block) {
  if (block.length < 4) return [];
  const restartCount = block.readUInt32LE(block.length - 4);
  const restartBytes = 4 + restartCount * 4;
  if (restartBytes > block.length) return [];
  const limit = block.length - restartBytes;
  const entries = [];
  let offset = 0;
  let previousKey = Buffer.alloc(0);

  while (offset < limit) {
    const [shared, afterShared] = readVarintFrom(block, offset);
    const [nonShared, afterNonShared] = readVarintFrom(block, afterShared);
    const [valueLength, afterValueLength] = readVarintFrom(block, afterNonShared);
    offset = afterValueLength;
    if (offset + nonShared + valueLength > limit) break;

    const keyDelta = block.subarray(offset, offset + nonShared);
    offset += nonShared;
    const value = block.subarray(offset, offset + valueLength);
    offset += valueLength;

    const key = Buffer.concat([previousKey.subarray(0, shared), keyDelta]);
    previousKey = key;
    entries.push({ key, value });
  }

  return entries;
}

function readPhysicalBlock(handle) {
  const trailerOffset = handle.offset + handle.size;
  if (trailerOffset + 5 > data.length) return null;
  const compressionType = data[trailerOffset];
  const block = data.subarray(handle.offset, handle.offset + handle.size);
  if (compressionType === 0) return block;
  if (compressionType === 1) return snappyUncompress(block);
  throw new Error(`Unsupported compression type ${compressionType}.`);
}

function snappyUncompress(input) {
  let offset = 0;
  const [uncompressedLength, afterLength] = readVarintFrom(input, offset);
  offset = afterLength;
  const output = Buffer.alloc(uncompressedLength);
  let out = 0;

  while (offset < input.length) {
    const tag = input[offset++];
    const type = tag & 0x03;

    if (type === 0) {
      let length = tag >>> 2;
      if (length < 60) {
        length += 1;
      } else {
        const byteCount = length - 59;
        length = 1;
        for (let i = 0; i < byteCount; i += 1) {
          length += input[offset++] << (8 * i);
        }
      }
      input.copy(output, out, offset, offset + length);
      offset += length;
      out += length;
      continue;
    }

    let length;
    let copyOffset;
    if (type === 1) {
      length = ((tag >>> 2) & 0x7) + 4;
      copyOffset = input[offset++] | ((tag & 0xe0) << 3);
    } else if (type === 2) {
      length = (tag >>> 2) + 1;
      copyOffset = input[offset] | (input[offset + 1] << 8);
      offset += 2;
    } else {
      length = (tag >>> 2) + 1;
      copyOffset = input[offset] | (input[offset + 1] << 8) | (input[offset + 2] << 16) | (input[offset + 3] << 24);
      offset += 4;
    }

    for (let i = 0; i < length; i += 1) {
      output[out] = output[out - copyOffset];
      out += 1;
    }
  }

  return output;
}

function trimInternalKey(key) {
  return key.length >= 8 ? key.subarray(0, key.length - 8) : key;
}

function asChromeString(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x00 && buffer[1] !== 0x00) {
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i + 1 < buffer.length; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0x01) {
    return buffer.subarray(1).toString("utf16le");
  }
  return buffer.toString("utf8");
}

const magic = data.subarray(data.length - 8).toString("hex");
if (magic !== "57fb808b247547db") {
  throw new Error(`Not a LevelDB table file, magic=${magic}`);
}

const footerOffset = data.length - 48;
const [metaHandle, afterMeta] = decodeBlockHandle(footerOffset);
const [indexHandle] = decodeBlockHandle(afterMeta);
const indexBlock = readPhysicalBlock(indexHandle);
const indexEntries = decodeEntries(indexBlock);
const candidates = [];

for (const indexEntry of indexEntries) {
  const handleBytes = indexEntry.value;
  let cursor = 0;
  const [blockOffset, afterBlockOffset] = readVarintFrom(handleBytes, cursor);
  const [blockSize] = readVarintFrom(handleBytes, afterBlockOffset);
  const block = readPhysicalBlock({ offset: blockOffset, size: blockSize });
  for (const entry of decodeEntries(block)) {
    const userKey = trimInternalKey(entry.key).toString("utf8");
    if (userKey.includes(wanted)) {
      candidates.push({
        key: userKey,
        value: asChromeString(entry.value)
      });
    }
  }
}

if (candidates.length === 0) {
  throw new Error(`No entries found for ${wanted}`);
}

const valid = [];
const parseFailures = [];
for (const candidate of candidates) {
  const normalized = candidate.value.replace(
    /"kanaMarks":"separate-glyphs","dakuten":[\s\S]*?,"view":/,
    '"kanaMarks":"separate-glyphs","dakuten":"゛","handakuten":"゜","view":'
  );
  const glyphsIndex = normalized.indexOf('"glyphs":[');
  const minimal = glyphsIndex >= 0
    ? `{"version":1,"grid":{"cols":6,"rows":6},${normalized.slice(glyphsIndex)}`
    : normalized;
  const attempts = [candidate.value, normalized, minimal];
  const recoveredGlyphs = [];
  const glyphPattern = /"char":"([^"]+)","folder":"[^"]*","activeEdges":(\[[^\]]*\]),"lockedEdges":(\[[^\]]*\])/g;
  for (const match of candidate.value.matchAll(glyphPattern)) {
    try {
      recoveredGlyphs.push({
        char: match[1],
        activeEdges: JSON.parse(match[2]),
        lockedEdges: JSON.parse(match[3]),
        status: "未完成"
      });
    } catch {
      // Skip malformed glyph snippets.
    }
  }
  if (recoveredGlyphs.length > 0) {
    const lower = recoveredGlyphs.filter((glyph) => /^[a-z]$/.test(glyph.char));
    valid.push({
      parsed: { version: 1, grid: { cols: 6, rows: 6 }, glyphs: recoveredGlyphs },
      lowerCount: lower.length,
      glyphCount: recoveredGlyphs.length,
      key: candidate.key
    });
  }

  const statusIndex = normalized.lastIndexOf(',"status":"');
  if (statusIndex > 0) {
    attempts.push(`${normalized.slice(0, statusIndex)},"status":"未完成"}]}`);
  }
  const minimalStatusIndex = minimal.lastIndexOf(',"status":"');
  if (minimalStatusIndex > 0) {
    attempts.push(`${minimal.slice(0, minimalStatusIndex)},"status":"未完成"}]}`);
  }

  for (const text of attempts) {
    try {
      const parsed = JSON.parse(text);
      const glyphs = Array.isArray(parsed.glyphs) ? parsed.glyphs : [];
      const lower = glyphs.filter((glyph) => /^[a-z]$/.test(glyph.char));
      valid.push({ parsed, lowerCount: lower.length, glyphCount: glyphs.length, key: candidate.key });
      break;
    } catch (error) {
      parseFailures.push({
        length: text.length,
        error: error.message,
        head: text.slice(0, 40),
        around: text.slice(100, 180),
        tail: text.slice(-120)
      });
    }
  }
}

if (valid.length === 0) {
  candidates.forEach((candidate, index) => {
    writeFileSync(`decoded-candidate-${index + 1}.txt`, candidate.value, "utf8");
  });
  console.log(JSON.stringify(parseFailures.slice(0, 4), null, 2));
  throw new Error(`Found ${candidates.length} entries, but none contained parseable JSON.`);
}

valid.sort((a, b) => b.lowerCount - a.lowerCount || b.glyphCount - a.glyphCount);
const best = valid[0];
writeFileSync(output, JSON.stringify(best.parsed, null, 2), "utf8");
console.log(JSON.stringify({
  output,
  candidates: candidates.length,
  parseable: valid.length,
  glyphCount: best.glyphCount,
  lowerCount: best.lowerCount,
  key: best.key
}, null, 2));
