import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { handler as listPresetsHandler } from "./tools/listPresets.js";
import { handler as rerunJobHandler } from "./tools/rerunJob.js";
import { handler as generateHandler } from "./tools/generate.js";
import { handler as listJobsHandler } from "./tools/listJobs.js";
import { loadPresets } from "../core/presets.js";
import { MOCK_EXPENSIVE_MODEL } from "../core/providers/index.js";

// Mock-провайдер на настоящем каталоге, история задач — во временном каталоге.
// Никаких обёрток, глотающих провал: тест либо проверяет, либо падает.
before(() => {
  process.env.NULLUME_PROVIDER = "mock";
  process.env.NULLUME_HOME = mkdtempSync(path.join(tmpdir(), "nullume-mcp-presets-"));
});

const textOf = (r: { content: Array<{ text: string }> }) => r.content[0].text;

test("list_presets: все пресеты с обязательными полями", async () => {
  const result = await listPresetsHandler();
  assert.ok(!result.isError, textOf(result));
  const json = JSON.parse(textOf(result));
  const presets = await loadPresets();
  assert.equal(json.length, presets.length);
  for (const p of json) {
    assert.ok(p.id && p.title && p.category && p.task, `пресет ${p.id}: не хватает полей`);
    assert.ok(p.prompt_hint ?? p.promptHint, `пресет ${p.id}: нет подсказки промпта`);
  }
});

test("rerun_job: несуществующая задача — понятная ошибка без пути на диске", async () => {
  const result = await rerunJobHandler({ job_id: "00000000-0000-0000-0000-000000000000" });
  assert.ok(result.isError);
  const text = textOf(result);
  assert.match(text, /нет в истории/);
  assert.doesNotMatch(text, /ENOENT|\/jobs\//, "путь файловой системы не должен уходить наружу");
});

test("presets load from data directory", async () => {
  const presets = await loadPresets();
  const expectedIds = [
    "product-photo",
    "banner-16x9",
    "social-square",
    "social-story",
    "image-edit",
    "short-video",
    "image-to-video",
    "voiceover",
    "music",
  ];
  for (const id of expectedIds) {
    assert.ok(presets.find((p) => p.id === id), `нет пресета ${id}`);
  }
});

async function jobCount(): Promise<number> {
  const r = await listJobsHandler({});
  const { total } = JSON.parse(textOf(r)) as { total: number };
  assert.equal(typeof total, "number", "list_jobs должен отдавать total");
  return total;
}

test("generate: дороже $1 без подтверждения — задача не создаётся", async () => {
  const before = await jobCount();
  const result = await generateHandler({ model: MOCK_EXPENSIVE_MODEL, prompt: "test", wait: false, confirm_cost: false });
  const out = JSON.parse(textOf(result));
  // Прежний тест принимал любую ошибку — и проходил на «модель не найдена»,
  // ни разу не дойдя до шлюза. Теперь требуем именно запрос подтверждения.
  assert.equal(out.needs_confirmation, true, textOf(result));
  assert.equal(await jobCount(), before, "задача создана без подтверждения");
});

test("generate: дороже $1 с подтверждением — задача создаётся", async () => {
  const before = await jobCount();
  const result = await generateHandler({ model: MOCK_EXPENSIVE_MODEL, prompt: "test", wait: false, confirm_cost: true });
  assert.ok(!result.isError, textOf(result));
  assert.equal(await jobCount(), before + 1);
});

test("generate: дешёвая модель без подтверждения — запускается", async () => {
  const before = await jobCount();
  const result = await generateHandler({ model: "mock/image", prompt: "test", wait: false, confirm_cost: false });
  assert.ok(!result.isError, textOf(result));
  assert.equal(await jobCount(), before + 1);
});
