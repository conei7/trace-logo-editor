import { cp, mkdir, rm } from "node:fs/promises";

const files = ["app.js", "index.html", "styles.css", "_headers"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all(files.map((file) => cp(file, `dist/${file}`)));
