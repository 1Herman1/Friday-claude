import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRssItems, extractImgSrcs, sleep } from "./http.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "__fixtures__");

test("parseRssItems: должен распарсить RSS с content:encoded", () => {
  const xml = fs.readFileSync(path.join(fixturesDir, "rss-sample.xml"), "utf-8");
  const items = parseRssItems(xml);

  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, "First Item");
  assert.strictEqual(items[0].link, "https://example.com/item1");
  assert(items[0].description?.includes("HTML content"));
  assert.strictEqual(items[0].enclosureUrl, "https://example.com/video1.mp4");
});

test("parseRssItems: должен использовать content:encoded поверх description", () => {
  const xml = `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
    <item>
      <title>Test</title>
      <description>Old desc</description>
      <content:encoded>New content</content:encoded>
    </item>
  </rss>`;

  const items = parseRssItems(xml);
  assert.strictEqual(items[0].description, "New content");
});

test("parseRssItems: должен работать без enclosure", () => {
  const xml = `<rss version="2.0">
    <item>
      <title>No Enclosure</title>
      <link>https://example.com</link>
    </item>
  </rss>`;

  const items = parseRssItems(xml);
  assert.strictEqual(items[0].enclosureUrl, undefined);
});

test("extractImgSrcs: должен найти все https URLs в src атрибутах", () => {
  const html = `
    <img src="https://example.com/img1.jpg" />
    <video src="https://example.com/video.mp4">
      <source src="https://example.com/video.webm" />
    </video>
    <img src="http://bad.com/http.jpg" />
  `;

  const srcs = extractImgSrcs(html);
  assert.strictEqual(srcs.length, 3);
  assert(srcs.includes("https://example.com/img1.jpg"));
  assert(srcs.includes("https://example.com/video.mp4"));
  assert(srcs.includes("https://example.com/video.webm"));
});

test("extractImgSrcs: должен игнорировать http URLs", () => {
  const html = `<img src="http://example.com/img.jpg" />`;
  const srcs = extractImgSrcs(html);

  assert.strictEqual(srcs.length, 0);
});

test("sleep: должен ждать указанное время", async () => {
  const start = Date.now();
  await sleep(50);
  const elapsed = Date.now() - start;

  assert(elapsed >= 40, `Ожидалось не менее 40ms, получено ${elapsed}ms`);
});
