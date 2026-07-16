import { createReadStream, existsSync, statSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const dataDir = resolve(join(root, "data"));
const sharedProjectPath = join(dataDir, "shared-project.json");
const sharedBackupPath = join(dataDir, "shared-project.backup.json");
const maxBodyBytes = 8 * 1024 * 1024;
let projectWriteQueue = Promise.resolve();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-trace-logo-api": "1"
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        rejectBody(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    request.on("error", rejectBody);
  });
}

function queueProjectWrite(task) {
  const queued = projectWriteQueue.then(task, task);
  projectWriteQueue = queued.catch(() => {});
  return queued;
}

function mergeObject(target, patch) {
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

function mergeProject(current, patch) {
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
  for (const key of ["grid", "gridSize", "gridCols", "gridRows", "customFonts", "parts", "composition"]) {
    if (Object.hasOwn(patch, key)) merged[key] = patch[key];
  }
  merged.savedAt = new Date().toISOString();
  merged.revision = Math.max(0, Number(current.revision) || 0) + 1;
  return merged;
}

async function writeSharedProject(project) {
  await mkdir(dataDir, { recursive: true });
  if (existsSync(sharedProjectPath)) {
    await copyFile(sharedProjectPath, sharedBackupPath);
  }
  const tmpPath = `${sharedProjectPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(project, null, 2), "utf8");
  await rename(tmpPath, sharedProjectPath);
}

async function handleProjectApi(request, response) {
  if (request.method === "GET" || request.method === "HEAD") {
    if (!existsSync(sharedProjectPath)) {
      sendJson(response, 404, { error: "No saved project" });
      return;
    }

    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-trace-logo-api": "1"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(await readFile(sharedProjectPath, "utf8"));
    return;
  }

  if (request.method === "PUT" || request.method === "POST") {
    try {
      const body = await readRequestBody(request);
      const project = JSON.parse(body);
      if (!project || !Array.isArray(project.glyphs)) {
        sendJson(response, 400, { error: "Project JSON must include glyphs" });
        return;
      }

      await queueProjectWrite(() => writeSharedProject(project));
      sendJson(response, 200, {
        ok: true,
        savedAt: project.savedAt || null,
        glyphs: project.glyphs.length,
        project
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

async function handleProjectPatchApi(request, response) {
  if (request.method !== "PATCH" && request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const patch = JSON.parse(await readRequestBody(request));
    if (!patch || !Array.isArray(patch.glyphs)) {
      sendJson(response, 400, { error: "Project patch must include glyphs" });
      return;
    }

    const project = await queueProjectWrite(async () => {
      const current = existsSync(sharedProjectPath)
        ? JSON.parse(await readFile(sharedProjectPath, "utf8"))
        : { version: 2, glyphs: [] };
      const merged = mergeProject(current, patch);
      await writeSharedProject(merged);
      return merged;
    });
    sendJson(response, 200, {
      ok: true,
      savedAt: project.savedAt,
      revision: project.revision,
      glyphs: project.glyphs.length,
      project
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const requestPath = decodeURIComponent(url.pathname);

  if (requestPath === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      projectExists: existsSync(sharedProjectPath)
    });
    return;
  }

  if (requestPath === "/api/project") {
    handleProjectApi(request, response).catch((error) => {
      sendJson(response, 500, { error: error.message });
    });
    return;
  }

  if (requestPath === "/api/project/patch") {
    handleProjectPatchApi(request, response).catch((error) => {
      sendJson(response, 500, { error: error.message });
    });
    return;
  }

  const cleanPath = requestPath === "/" ? "index.html" : requestPath.replace(/^[/\\]+/, "");
  const target = resolve(join(root, normalize(cleanPath)));

  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mime[extname(target)] || "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(target).pipe(response);
});

server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`trace-logo-editor listening on http://${host}:${port}`);
});
