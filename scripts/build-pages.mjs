import { cp, mkdir, rm } from "node:fs/promises";

const files = ["app.js", "kanji-radicals.js", "index.html", "styles.css", "manifest.webmanifest", "icons", "_headers"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all(files.map((file) => cp(file, `dist/${file}`, { recursive: true })));
