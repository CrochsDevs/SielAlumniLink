import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const manifest = JSON.parse(readFileSync(path.join(directory, ".vite/manifest.json")));
const visited = new Set(), initial = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  initial.add(chunk.file);
  for (const css of chunk.css || []) initial.add(css);
  for (const imported of chunk.imports || []) visit(imported);
}
for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
const measure = files => {
  const totals = { bytes: 0, gzipBytes: 0, files: files.length };
  for (const file of files) {
    const data = readFileSync(path.join(directory, file));
    totals.bytes += data.length;
    totals.gzipBytes += gzipSync(data).length;
  }
  return totals;
};
const all = readdirSync(path.join(directory, "assets")).map(file => `assets/${file}`);
const report = Object.fromEntries(["js", "css"].map(type => [type, {
  initial: measure([...initial].filter(file => file.endsWith(`.${type}`))),
  allRoutes: measure(all.filter(file => file.endsWith(`.${type}`))),
}]));
console.log(JSON.stringify(report, null, 2));
