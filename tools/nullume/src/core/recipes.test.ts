import { test } from "node:test";
import assert from "node:assert";
import { listRecipes, getRecipe, planRecipe, runRecipe, type RecipePlan, type RecipeRunDeps } from "./recipes.js";
import type { Provider } from "./providers/types.js";
import type { Job } from "./jobs/model.js";
import { loadPresets } from "./presets.js";
import { loadCatalog } from "./catalog.js";

test("listRecipes returns array of 6 recipes", async () => {
  const recipes = await listRecipes();
  assert(Array.isArray(recipes), "Should return array");
  assert.strictEqual(recipes.length, 6, "Should have 6 recipes");

  const expectedIds = ["product-card", "hero-banner", "social-trio", "before-after", "landing-hero", "product-video"];
  const actualIds = recipes.map((r) => r.id);

  for (const id of expectedIds) {
    assert(actualIds.includes(id), `Should have recipe ${id}`);
  }
});

test("listRecipes items have required fields", async () => {
  const recipes = await listRecipes();
  for (const recipe of recipes) {
    assert(recipe.id, `Recipe should have id`);
    assert(recipe.title, `Recipe ${recipe.id} should have title`);
    assert(recipe.goal, `Recipe ${recipe.id} should have goal`);
    assert(recipe.steps_count > 0, `Recipe ${recipe.id} should have steps`);
  }
});

test("getRecipe returns specific recipe by id", async () => {
  const recipe = await getRecipe("product-card");
  assert(recipe, "Should find product-card recipe");
  assert.strictEqual(recipe.id, "product-card");
  assert(recipe.title, "Recipe should have title");
  assert(recipe.steps.length >= 3, "product-card should have at least 3 steps");
});

test("getRecipe returns null for non-existent recipe", async () => {
  const recipe = await getRecipe("non-existent-xyz");
  assert.strictEqual(recipe, null);
});

test("all recipe steps reference valid presets", async () => {
  const presets = await loadPresets();
  const presetIds = new Set(presets.map((p) => p.id));
  const recipes = await listRecipes();

  for (const recipeItem of recipes) {
    const recipe = await getRecipe(recipeItem.id);
    assert(recipe, `Recipe ${recipeItem.id} should load`);

    for (const step of recipe.steps) {
      assert(
        presetIds.has(step.preset),
        `Recipe ${recipe.id} step ${step.id}: preset ${step.preset} not found`
      );
    }
  }
});

test("steps with 'from' reference previous step of same recipe", async () => {
  const recipes = await listRecipes();

  for (const recipeItem of recipes) {
    const recipe = await getRecipe(recipeItem.id);
    assert(recipe);

    const stepIds = new Set(recipe.steps.map((s) => s.id));

    for (let i = 0; i < recipe.steps.length; i++) {
      const step = recipe.steps[i];
      if (step.from) {
        // Check that 'from' references a previous step
        const prevStepIds = new Set(recipe.steps.slice(0, i).map((s) => s.id));
        assert(
          prevStepIds.has(step.from),
          `Recipe ${recipe.id} step ${step.id}: 'from' should reference previous step, got ${step.from}`
        );
      }
    }
  }
});

test("steps with 'from' use presets with image field", async () => {
  // Models that support image input: image-edit, image-to-video, etc.
  const imageInputPresets = new Set([
    "image-edit",
    "image-to-video",
  ]);

  const recipes = await listRecipes();

  for (const recipeItem of recipes) {
    const recipe = await getRecipe(recipeItem.id);
    assert(recipe);

    for (const step of recipe.steps) {
      if (step.from) {
        assert(
          imageInputPresets.has(step.preset),
          `Recipe ${recipe.id} step ${step.id}: preset '${step.preset}' does not support image input`
        );
      }
    }
  }
});

test("recipe prompts contain {subject} placeholder (except backgrounds and edits)", async () => {
  const recipes = await listRecipes();
  const backgroundSteps = new Set(["background"]); // Steps that don't use subject

  for (const recipeItem of recipes) {
    const recipe = await getRecipe(recipeItem.id);
    assert(recipe);

    for (const step of recipe.steps) {
      // Skip steps that are edits (have 'from') or background/context
      if (!step.from && !backgroundSteps.has(step.id)) {
        assert(
          step.prompt.includes("{subject}"),
          `Recipe ${recipe.id} step ${step.id}: prompt should contain {subject}`
        );
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* План: провайдер подменён, сети и ключа не нужно                      */
/* ------------------------------------------------------------------ */

function fakeProvider(source = "pricing-api", credits = 4): Provider {
  return {
    name: "fake",
    model: async (id: string) => ({ id }) as never,
    estimate: async () => ({ creditsMin: credits, creditsMax: credits, source }) as never,
  } as unknown as Provider;
}

test("planRecipe: несуществующий рецепт — null", async () => {
  const plan = await planRecipe("non-existent", { subject: "x", catalog: await loadCatalog(), provider: fakeProvider() });
  assert.strictEqual(plan, null);
});

test("planRecipe: {subject} подставлен во все шаги, сумма = сумме шагов", async () => {
  const plan = await planRecipe("product-card", { subject: "ceramic vase", catalog: await loadCatalog(), provider: fakeProvider("pricing-api", 4) });
  assert.ok(plan);
  for (const step of plan.steps) {
    assert.ok(!step.prompt.includes("{subject}"), `${step.id}: плейсхолдер остался`);
    assert.ok(step.prompt.includes("ceramic vase"), `${step.id}: предмета нет в промпте`);
  }
  assert.strictEqual(plan.total_credits, 4 * plan.steps.length);
});

test("planRecipe: input шага ложится поверх input пресета", async () => {
  const presets = await loadPresets();
  const recipe = await getRecipe("hero-banner");
  const plan = await planRecipe("hero-banner", { subject: "x", catalog: await loadCatalog(), provider: fakeProvider() });
  assert.ok(recipe && plan);
  for (const step of recipe.steps) {
    const preset = presets.find((p) => p.id === step.preset)!;
    const planned = plan.steps.find((s) => s.id === step.id)!;
    assert.deepStrictEqual(planned.input, { ...preset.input, ...step.input });
  }
});

test("planRecipe: подтверждённая цена pricing-api не блокирует запуск", async () => {
  const plan = await planRecipe("product-card", { subject: "x", catalog: await loadCatalog(), provider: fakeProvider("pricing-api") });
  assert.strictEqual(plan!.has_unconfirmed_price, false, "иначе ни один рецепт не запустится на настоящем kie");
});

test("planRecipe: догадка (fuzzy) и неизвестная цена помечаются", async () => {
  for (const source of ["fuzzy", "unknown"]) {
    const plan = await planRecipe("product-card", { subject: "x", catalog: await loadCatalog(), provider: fakeProvider(source) });
    assert.strictEqual(plan!.has_unconfirmed_price, true, source);
  }
});

/* ------------------------------------------------------------------ */
/* Исполнение: задачи подменены — ни одного обращения к провайдеру       */
/* ------------------------------------------------------------------ */

function planOf(steps: Array<{ id: string; from?: string; credits?: number }>, extra: Partial<RecipePlan> = {}): RecipePlan {
  const planned = steps.map((s) => ({
    id: s.id,
    model: "m",
    prompt: `p ${s.id}`,
    input: {},
    from: s.from,
    cost_credits: s.credits ?? 4,
    cost_usd: "0.02",
    cost_source: "pricing-api",
  }));
  return {
    recipe_id: "r",
    subject: "x",
    steps: planned,
    total_credits: planned.reduce((n, s) => n + s.cost_credits, 0),
    total_usd: "0.00",
    has_unconfirmed_price: false,
    ...extra,
  };
}

/** Подменённые задачи: id шага → исход. Запоминает, что и с какими картинками создавалось. */
function fakeJobs(outcome: Record<string, "done" | "failed" | "pending" | "throw">) {
  const created: Array<{ prompt: string; images?: string[] }> = [];
  const byJob = new Map<string, string>();
  const deps: RecipeRunDeps = {
    createJob: async (p) => {
      const stepId = p.prompt.replace(/^p /, "");
      if (outcome[stepId] === "throw") throw new Error(`не удалось создать ${stepId}`);
      created.push({ prompt: p.prompt, images: p.images });
      const id = `job-${stepId}`;
      byJob.set(id, stepId);
      return { id };
    },
    waitAll: async (ids) => {
      const job = (id: string): Job =>
        ({ id, localPaths: [`/out/${byJob.get(id)}.png`], failMsg: "упала на стороне kie" }) as unknown as Job;
      return {
        done: ids.filter((id) => outcome[byJob.get(id)!] === "done").map(job),
        failed: ids.filter((id) => outcome[byJob.get(id)!] === "failed").map(job),
        pending: ids.filter((id) => outcome[byJob.get(id)!] === "pending").map(job),
      };
    },
  };
  return { deps, created };
}

const noProvider = {} as Provider;

test("runRecipe: дороже потолка — не создано ни одной задачи", async () => {
  const { deps, created } = fakeJobs({ a: "done", b: "done" });
  await assert.rejects(
    () => runRecipe(planOf([{ id: "a" }, { id: "b" }]), { provider: noProvider, maxCredits: 7, deps }),
    /больше потолка 7/
  );
  assert.strictEqual(created.length, 0);
});

test("runRecipe: цена не подтверждена — не создано ни одной задачи", async () => {
  const { deps, created } = fakeJobs({ a: "done" });
  await assert.rejects(
    () => runRecipe(planOf([{ id: "a" }], { has_unconfirmed_price: true }), { provider: noProvider, maxCredits: 1000, deps }),
    /не подтверждена/
  );
  assert.strictEqual(created.length, 0);
});

test("runRecipe: зависимый шаг получает результат источника как картинку", async () => {
  const { deps, created } = fakeJobs({ frame: "done", video: "done" });
  const res = await runRecipe(planOf([{ id: "frame" }, { id: "video", from: "frame" }]), { provider: noProvider, maxCredits: 100, deps });
  const video = created.find((c) => c.prompt === "p video")!;
  assert.deepStrictEqual(video.images, ["/out/frame.png"]);
  assert.deepStrictEqual(res.steps.map((s) => s.state), ["done", "done"]);
});

test("runRecipe: источник упал — зависимый пропущен, независимые готовы", async () => {
  const { deps, created } = fakeJobs({ a: "done", before: "failed", after: "done" });
  const res = await runRecipe(
    planOf([{ id: "a" }, { id: "before" }, { id: "after", from: "before" }]),
    { provider: noProvider, maxCredits: 100, deps }
  );
  const byId = Object.fromEntries(res.steps.map((s) => [s.id, s]));
  assert.strictEqual(byId.a.state, "done");
  assert.strictEqual(byId.before.state, "failed");
  assert.strictEqual(byId.after.state, "skipped");
  assert.match(byId.after.skip_reason!, /before/);
  assert.ok(!created.some((c) => c.prompt === "p after"), "зависимый не создавался — деньги не потрачены");
});

test("runRecipe: не дождавшийся зависимый шаг остаётся в отчёте как pending", async () => {
  const { deps } = fakeJobs({ frame: "done", video: "pending" });
  const res = await runRecipe(planOf([{ id: "frame" }, { id: "video", from: "frame" }]), { provider: noProvider, maxCredits: 100, deps });
  const video = res.steps.find((s) => s.id === "video");
  assert.ok(video, "шаг не должен пропадать из отчёта");
  assert.strictEqual(video.state, "pending");
  assert.strictEqual(video.job_id, "job-video", "по id его можно забрать позже");
});

test("runRecipe: ошибка создания одной задачи не роняет остальные", async () => {
  const { deps } = fakeJobs({ a: "throw", b: "done" });
  const res = await runRecipe(planOf([{ id: "a" }, { id: "b" }]), { provider: noProvider, maxCredits: 100, deps });
  assert.deepStrictEqual(res.steps.map((s) => [s.id, s.state]), [["a", "failed"], ["b", "done"]]);
});

test("runRecipe: шаги в отчёте в порядке рецепта", async () => {
  const { deps } = fakeJobs({ x: "done", y: "done", z: "done" });
  const res = await runRecipe(planOf([{ id: "x" }, { id: "y", from: "x" }, { id: "z" }]), { provider: noProvider, maxCredits: 100, deps });
  assert.deepStrictEqual(res.steps.map((s) => s.id), ["x", "y", "z"]);
});
