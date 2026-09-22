import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UsageError } from "../../core/errors.js";

// Модели берём из каталога по свойствам, а не по имени: каталог обновляется
// из живой документации, и прибитые id ломали эти тесты на каждом обновлении.
import { loadCatalog } from "../../core/catalog.js";
import type { ModelInfo } from "../../core/catalog.js";

const catalogModels = await loadCatalog();

/** Модели, которым для задачи хватает одного промпта */
function needsOnlyPrompt(m: ModelInfo): boolean {
  const prompt = m.meta?.promptField ?? "prompt";
  const defaults = m.meta?.defaults ?? {};
  return (m.meta?.required ?? []).every((field) => field === prompt || field in defaults);
}

function pickModel(predicate: (m: ModelInfo) => boolean, what: string): string {
  const found = catalogModels.find((m) => needsOnlyPrompt(m) && predicate(m));
  if (!found) throw new Error(`В каталоге нет модели: ${what}`);
  return found.id;
}

/** Дороже $1 — включает шлюз подтверждения */
const EXPENSIVE_MODEL = pickModel((m) => (m.price?.usdMax ?? 0) >= 1, "дороже $1");
/** Дешевле $1 с точной ценой — шлюз не включается */
const CHEAP_MODEL = pickModel(
  (m) => m.price !== undefined && m.price.usdMax < 1 && m.price.approximate === false,
  "дешевле $1 с точной ценой"
);
/** Без цены в каталоге — оценка неизвестна */
const UNPRICED_MODEL = pickModel((m) => m.price === undefined, "без цены");
/** Принимает картинку на вход */
const IMAGE_MODEL_ID = pickModel((m) => Boolean(m.meta?.imageField), "с полем изображения");

let freshCounter = 0;

interface RunResult {
  error?: unknown;
  stdout: string;
  fetchUrls: string[];
  jobsDir: string;
  jobFiles: string[];
}

async function runCreate(
  args: string[],
  env: Record<string, string> = {}
): Promise<RunResult> {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-gate-"));
  const savedEnv = { ...process.env };
  const savedFetch = globalThis.fetch;
  const savedLog = console.log;
  const fetchUrls: string[] = [];
  let stdout = "";

  Object.assign(process.env, { NULLUME_HOME: home, KIE_API_KEY: "test-key" }, env);
  globalThis.fetch = (async (url: any) => {
    const href = String(url);
    fetchUrls.push(href);
    const data = href.includes("file-stream-upload")
      ? { downloadUrl: "https://cdn.example.com/uploaded.png" }
      : { taskId: "remote-task-1" };
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data }),
      text: async () => "",
    } as unknown as Response;
  }) as typeof fetch;
  console.log = (...parts: unknown[]) => {
    stdout += parts.join(" ") + "\n";
  };

  let error: unknown;
  try {
    const mod = await import(`./generate.js?fresh=${freshCounter++}`);
    await mod.default.parseAsync(["create", ...args], { from: "user" });
  } catch (e) {
    error = e;
  } finally {
    console.log = savedLog;
    globalThis.fetch = savedFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  }

  const jobsDir = path.join(home, "jobs");
  const jobFiles = fs.existsSync(jobsDir)
    ? fs.readdirSync(jobsDir).filter((f) => f.endsWith(".json"))
    : [];

  return { error, stdout, fetchUrls, jobsDir, jobFiles };
}

function readJob(res: RunResult): any {
  assert.strictEqual(res.jobFiles.length, 1, `ожидалась одна задача, файлов: ${res.jobFiles.length}`);
  return JSON.parse(fs.readFileSync(path.join(res.jobsDir, res.jobFiles[0]), "utf-8"));
}

test("шлюз стоимости: дорогая модель без --yes — ошибка с кодом 2 и ничего не создано", async () => {
  const res = await runCreate([EXPENSIVE_MODEL, "--prompt", "кот на льду"], {
    NULLUME_PROVIDER: "kie",
  });

  assert(res.error instanceof UsageError, `ожидался UsageError, получено: ${res.error}`);
  assert.strictEqual((res.error as UsageError).exitCode, 2);
  assert.match((res.error as UsageError).message, /--yes/);
  assert.deepStrictEqual(res.jobFiles, [], "задача не должна создаваться");
  assert.deepStrictEqual(res.fetchUrls, [], "запрос к API не должен уходить");
});

test("шлюз стоимости: дорогая модель с --yes — задача создаётся", async () => {
  const res = await runCreate([EXPENSIVE_MODEL, "--prompt", "кот на льду", "--yes"], {
    NULLUME_PROVIDER: "kie",
  });

  assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
  const job = readJob(res);
  assert.strictEqual(job.model, EXPENSIVE_MODEL);
  assert.strictEqual(job.taskId, "remote-task-1");
  assert.strictEqual(job.state, "pending");
  assert(res.fetchUrls.some((u) => u.includes("/jobs/createTask")), res.fetchUrls.join(","));
});

test("шлюз стоимости: дешёвая модель с точной ценой проходит без --yes", async () => {
  const res = await runCreate([CHEAP_MODEL, "--prompt", "кот"], { NULLUME_PROVIDER: "kie" });

  assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
  assert.strictEqual(readJob(res).model, CHEAP_MODEL);
  assert.match(res.stdout, /Оценка стоимости/);
});

test("шлюз стоимости: модель без известной цены требует --yes", async () => {
  const res = await runCreate([UNPRICED_MODEL, "--prompt", "кот"], { NULLUME_PROVIDER: "kie" });

  assert(res.error instanceof UsageError, `ожидался UsageError, получено: ${res.error}`);
  assert.strictEqual((res.error as UsageError).exitCode, 2);
  assert.deepStrictEqual(res.jobFiles, [], "задача не должна создаваться");
  assert.deepStrictEqual(res.fetchUrls, [], "запрос к API не должен уходить");
});

test("шлюз стоимости: модель без известной цены создаётся с --yes", async () => {
  const res = await runCreate([UNPRICED_MODEL, "--prompt", "кот", "--yes"], {
    NULLUME_PROVIDER: "kie",
  });

  assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
  assert.strictEqual(readJob(res).model, UNPRICED_MODEL);
});

test("--set: типы значений попадают в input задачи как есть", async () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-set-"));
  const jsonFile = path.join(tmpdir, "cfg.json");
  fs.writeFileSync(jsonFile, JSON.stringify({ nested: { a: 1 }, list: [1, 2] }));

  try {
    const res = await runCreate(
      [
        "mock/image",
        "--yes",
        "--prompt",
        "кот",
        "--set",
        "steps=20",
        "--set",
        "ratio=1.5",
        "--set",
        "hd=true",
        "--set",
        "draft=false",
        "--set",
        "label=hello world",
        "--set",
        `cfg=@${jsonFile}`,
      ],
      { NULLUME_PROVIDER: "mock" }
    );

    assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
    const job = readJob(res);
    assert.strictEqual(job.input.steps, 20);
    assert.strictEqual(job.input.ratio, 1.5);
    assert.strictEqual(job.input.hd, true);
    assert.strictEqual(job.input.draft, false);
    assert.strictEqual(job.input.label, "hello world");
    assert.deepStrictEqual(job.input.cfg, { nested: { a: 1 }, list: [1, 2] });
    assert.strictEqual(job.input.prompt, "кот");
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
});

test("--set: последнее повторное значение ключа побеждает", async () => {
  const res = await runCreate(
    ["mock/image", "--yes", "--prompt", "кот", "--set", "steps=10", "--set", "steps=30"],
    { NULLUME_PROVIDER: "mock" }
  );

  assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
  assert.strictEqual(readJob(res).input.steps, 30);
});

test("--set: отсутствующий файл за @ даёт ошибку использования и задача не создаётся", async () => {
  const res = await runCreate(
    ["mock/image", "--yes", "--prompt", "кот", "--set", "cfg=@/nonexistent/nope.json"],
    { NULLUME_PROVIDER: "mock" }
  );

  assert(res.error instanceof UsageError, `ожидался UsageError, получено: ${res.error}`);
  assert.strictEqual((res.error as UsageError).exitCode, 2);
  assert.deepStrictEqual(res.jobFiles, []);
});

test("--set: отрицательные числа и экспонента остаются строками", async () => {
  const res = await runCreate(
    ["mock/image", "--yes", "--prompt", "кот", "--set", "seed=-5", "--set", "scale=1e3"],
    { NULLUME_PROVIDER: "mock" }
  );

  assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
  const job = readJob(res);
  assert.strictEqual(job.input.seed, "-5");
  assert.strictEqual(job.input.scale, "1e3");
});

const IMAGE_MODEL = IMAGE_MODEL_ID;
const imageModelInfo = catalogModels.find((m) => m.id === IMAGE_MODEL_ID)!;
const IMAGE_FIELD = imageModelInfo.meta!.imageField!;
const IMAGE_IS_LIST = Boolean(imageModelInfo.meta!.imageList);

/** Значение, которое модель ждёт в своём поле картинки: строка или список */
function imageValue(job: { input: Record<string, unknown> }): unknown {
  const value = job.input[IMAGE_FIELD];
  return IMAGE_IS_LIST && Array.isArray(value) ? value[0] : value;
}

function writePngInCwd(name: string): string {
  const file = path.join(process.cwd(), name);
  fs.writeFileSync(
    file,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    )
  );
  return file;
}

test("--image: png в рабочей директории загружается и попадает в input", async () => {
  const file = writePngInCwd("nullume-upload-test.png");
  try {
    const res = await runCreate(
      [IMAGE_MODEL, "--prompt", "кот", "--yes", "--image", file],
      { NULLUME_PROVIDER: "kie" }
    );

    assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
    const job = readJob(res);
    assert.strictEqual(imageValue(job), "https://cdn.example.com/uploaded.png");
    assert(res.fetchUrls.some((u) => u.includes("file-stream-upload")), res.fetchUrls.join(","));
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("--image: файл с .env в имени отклоняется, задача не создаётся", async () => {
  const file = writePngInCwd(".env.nullume-upload-test");
  try {
    const res = await runCreate(
      [IMAGE_MODEL, "--prompt", "кот", "--yes", "--image", file],
      { NULLUME_PROVIDER: "kie" }
    );

    assert(res.error instanceof Error, "ожидался отказ загрузки");
    assert.match((res.error as Error).message, /denied pattern/);
    assert.deepStrictEqual(res.jobFiles, []);
    assert.deepStrictEqual(res.fetchUrls, [], "файл не должен уходить наружу");
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("--image: http-URL передаётся как есть, без загрузки", async () => {
  const res = await runCreate(
    [IMAGE_MODEL, "--prompt", "кот", "--yes", "--image", "https://example.com/a.png"],
    { NULLUME_PROVIDER: "kie" }
  );

  assert.strictEqual(res.error, undefined, `неожиданная ошибка: ${res.error}`);
  assert.strictEqual(imageValue(readJob(res)), "https://example.com/a.png");
  assert(!res.fetchUrls.some((u) => u.includes("file-stream-upload")));
});

test("шлюз стоимости: отдельный процесс CLI завершается кодом 2", async () => {
  const { spawn } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-exit-"));

  const code: number = await new Promise((resolve, reject) => {
    const proc = spawn(
      "npx",
      ["tsx", path.join(projectRoot, "src/cli/index.ts"), "generate", "create", EXPENSIVE_MODEL, "--prompt", "кот"],
      {
        cwd: projectRoot,
        env: { ...process.env, NULLUME_PROVIDER: "kie", KIE_API_KEY: "test-key", NULLUME_HOME: home },
      }
    );
    proc.on("error", reject);
    proc.on("close", (c) => resolve(c ?? 0));
  });

  try {
    assert.strictEqual(code, 2, "дорогая генерация без --yes должна давать exit 2");
    const jobsDir = path.join(home, "jobs");
    const files = fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : [];
    assert.deepStrictEqual(files, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
