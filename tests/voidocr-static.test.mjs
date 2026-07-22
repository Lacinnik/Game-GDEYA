import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../public-web/public/labs/voidocr/", import.meta.url);

test("VoidOCR release contains its complete local runtime", async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
  ]);
  assert.match(html, /VOID OCR · STABLE 1\.0/);
  assert.match(html, /data-stage="trigger"/);
  assert.match(html, /data-stage="pause"/);
  assert.match(html, /data-stage="distinguish"/);
  assert.match(html, /data-stage="result"/);
  assert.match(js, /architectonica\.voidocr-trace\/1\.0\.0/);
  assert.match(js, /localStorage\.setItem/);
  assert.match(js, /stability >= 2 \? "ALLOW" : "DENY"/);
  assert.match(js, /document\.body\.append\(link\)/);
  assert.match(js, /setTimeout\(\(\) =>/);
  assert.match(js, /serviceWorker\.register\("\.\.\/\.\.\/sw\.js"\)/);
  assert.match(css, /-webkit-appearance:none/);
});

test("VoidOCR has no external runtime dependency", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /\.\/app\.js/);
  assert.match(html, /\.\/styles\.css/);
});
