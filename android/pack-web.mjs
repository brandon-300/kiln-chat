import fs from "node:fs";
import path from "node:path";

const root = path.resolve("android/app/src/main/assets");
const htmlPath = process.argv[2];
const staticDir = path.resolve(".vercel/output/static");
if (!htmlPath || !fs.existsSync(htmlPath)) {
  console.error("Missing rendered index.html");
  process.exit(1);
}
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
const bridge = fs.readFileSync(path.resolve("android/bridge.js"), "utf8");
let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(/<script src="https:\/\/grok\.com\/grok-app-builder\/extensions\.js"[^>]*><\/script>/g, "");
html = html.replace(/<head([^>]*)>/, `<head$1><script>${bridge}</script>`);
html = html.replaceAll('src="/favicon.svg"', 'src="favicon.svg"');
html = html.replaceAll('href="/favicon.svg"', 'href="favicon.svg"');
fs.writeFileSync(path.join(root, "index.html"), html);
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    const rel = path.relative(staticDir, full);
    if (rel.endsWith(".html")) continue;
    const destRel = rel.startsWith(`assets${path.sep}`) ? rel.slice(`assets${path.sep}`.length) : rel;
    const dest = path.join(root, destRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(full, dest);
  }
};
walk(staticDir);
const needed = fs.readFileSync(path.join(root, "index.html"), "utf8").match(/\/assets\/[^"' )]+/g) || [];
const missing = needed
  .map((item) => item.replace(/^\/assets\//, ""))
  .filter((item) => !fs.existsSync(path.join(root, item)));
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log("packed", fs.readdirSync(root).length, "files");
