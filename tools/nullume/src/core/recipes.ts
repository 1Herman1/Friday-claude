import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelInfo } from "./providers/types.js";
import type { Provider } from "./providers/types.js";
import { getPreset, resolvePreset } from "./presets.js";
import { createJobTask } from "./jobs/run.js";
import { waitJobs, type WaitJobsResult } from "./jobs/wait.js";
import { getDownloadsDir } from "./paths.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "../..", "data");

export interface RecipeStep {
  id: string;
  preset: string;
  prompt: string;
  input?: Record<string, unknown>;
  from?: string;
}

export interface Recipe {
  id: string;
  /** Имя, по которому владелец вызывает рецепт: «Витрина», «Афиша»… */
  codename: string;
  /** На всех кадрах один и тот же предмет — значит, шаги строятся из первого */
  sameSubject?: boolean;
  title: string;
  goal: string;
  steps: RecipeStep[];
  notes: string;
}

export interface RecipeListItem {
  id: string;
  codename: string;
  title: string;
  goal: string;
  steps_count: number;
}

export const UNCONFIRMED_PRICE_SOURCES: ReadonlySet<string> = new Set(["fuzzy", "unknown"]);

export interface PlannedStep {
  id: string;
  model: string;
  prompt: string;
  input: Record<string, unknown>;
  from?: string;
  cost_credits: number;
  cost_usd: string;
  cost_source: string;
}

export interface RecipePlan {
  recipe_id: string;
  subject: string;
  style?: string;
  steps: PlannedStep[];
  total_credits: number;
  total_usd: string;
  has_unconfirmed_price: boolean;
}

export interface RecipeStepResult {
  id: string;
  state: "done" | "failed" | "pending" | "skipped";
  job_id?: string;
  local_paths: string[];
  /** Адреса у провайдера: локальный путь пропадает вместе с машиной, где шёл прогон */
  result_urls?: string[];
  error?: string;
  skip_reason?: string;
}

export interface RecipeRunResult {
  recipe_id: string;
  subject: string;
  steps: RecipeStepResult[];
  total_cost_usd: string;
  total_cost_credits: number;
}

async function loadRecipes(): Promise<Recipe[]> {
  // Битый файл рецептов — ошибка, а не пустой список: иначе рецепты молча исчезают
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, "recipes.json"), "utf-8"));
  return data.recipes ?? [];
}

export async function listRecipes(): Promise<RecipeListItem[]> {
  const recipes = await loadRecipes();
  return recipes.map((r) => ({
    id: r.id,
    codename: r.codename,
    title: r.title,
    goal: r.goal,
    steps_count: r.steps.length,
  }));
}

/** Рецепт по id или по имени («Витрина», «витрина»), без учёта регистра */
export async function getRecipe(idOrName: string): Promise<Recipe | null> {
  const key = idOrName.trim().toLowerCase();
  const recipes = await loadRecipes();
  return recipes.find((r) => r.id === key || r.codename.toLowerCase() === key) ?? null;
}

export async function planRecipe(
  id: string,
  options: {
    subject: string;
    /** Что меняется или уточняется — подставляется в {details}; обязателен, если рецепт его ждёт */
    details?: string;
    style?: string;
    catalog: ModelInfo[];
    provider: Provider;
  }
): Promise<RecipePlan | null> {
  const { subject, details, style, catalog, provider } = options;
  const recipe = await getRecipe(id);
  if (!recipe) return null;

  if (recipe.steps.some((s) => s.prompt.includes("{details}")) && !details?.trim()) {
    throw new Error(
      `Рецепту «${recipe.codename}» нужно указать, что меняется (details) — иначе модель придумает изменение сама`
    );
  }

  const usdPerCredit = 0.005; // Standard rate

  const plannedSteps: PlannedStep[] = [];
  let hasUnconfirmedPrice = false;
  let totalCredits = 0;

  for (const step of recipe.steps) {
    const preset = await getPreset(step.preset);
    if (!preset) {
      throw new Error(`Preset ${step.preset} not found for step ${step.id}`);
    }

    const resolved = await resolvePreset(step.preset, catalog);
    if (!resolved) {
      throw new Error(`Failed to resolve preset ${step.preset}`);
    }

    const modelInfo = await provider.model(resolved.resolvedModel);

    // Substitute {subject} in prompt
    const prompt = step.prompt.replaceAll("{subject}", subject).replaceAll("{details}", details ?? "");

    // Merge input: preset defaults + step overrides
    const input = { ...preset.input, ...step.input };

    // Estimate cost
    const estimate = await provider.estimate(resolved.resolvedModel, { prompt, input });
    if (!estimate) {
      throw new Error(`Failed to estimate cost for model ${resolved.resolvedModel}`);
    }

    const costCredits = estimate.creditsMax || estimate.creditsMin || 0;
    const costUsd = (costCredits * usdPerCredit).toFixed(2);

    // То же правило, что у живой проверки: подтверждена цена из pricing-api
    // и из снимка каталога; догадка (fuzzy) и неизвестность — нет.
    if (UNCONFIRMED_PRICE_SOURCES.has(estimate.source)) {
      hasUnconfirmedPrice = true;
    }

    plannedSteps.push({
      id: step.id,
      model: resolved.resolvedModel,
      prompt,
      input,
      from: step.from,
      cost_credits: costCredits,
      cost_usd: costUsd,
      cost_source: estimate.source,
    });

    totalCredits += costCredits;
  }

  const totalUsd = (totalCredits * usdPerCredit).toFixed(2);

  return {
    recipe_id: recipe.id,
    subject,
    style,
    steps: plannedSteps,
    total_credits: totalCredits,
    total_usd: totalUsd,
    has_unconfirmed_price: hasUnconfirmedPrice,
  };
}

/** Создание и ожидание задач подставляемы — так исполнение проверяется без провайдера и без трат */
export interface RecipeRunDeps {
  createJob: (params: {
    model: string;
    prompt: string;
    input: Record<string, unknown>;
    images?: string[];
    style?: string;
  }) => Promise<{ id: string }>;
  waitAll: (jobIds: string[]) => Promise<WaitJobsResult>;
}

export async function runRecipe(
  plan: RecipePlan,
  options: {
    provider: Provider;
    style?: string;
    maxCredits: number;
    timeoutSec?: number;
    deps?: RecipeRunDeps;
  }
): Promise<RecipeRunResult> {
  const { provider, maxCredits, style } = options;

  // Проверки до создания первой задачи: после — деньги уже потрачены
  if (plan.has_unconfirmed_price) {
    throw new Error(
      `Цена рецепта не подтверждена каталогом (источник fuzzy/unknown), оценка $${plan.total_usd}. ` +
        `Запуск отменён — ни одна задача не создана.`
    );
  }
  if (plan.total_credits > maxCredits) {
    throw new Error(
      `Рецепт стоит ${plan.total_credits} кредитов ($${plan.total_usd}) — больше потолка ${maxCredits}. ` +
        `Запуск отменён — ни одна задача не создана.`
    );
  }

  const deps: RecipeRunDeps = options.deps ?? {
    createJob: (p) => createJobTask(provider, p),
    waitAll: (ids) => waitJobs(provider, ids, { timeoutSec: options.timeoutSec ?? 600 }),
  };

  const results = new Map<string, RecipeStepResult>();

  const launch = async (step: PlannedStep, images?: string[]): Promise<string | undefined> => {
    try {
      const job = await deps.createJob({ model: step.model, prompt: step.prompt, input: step.input, images, style });
      results.set(step.id, { id: step.id, state: "pending", job_id: job.id, local_paths: [] });
      return job.id;
    } catch (error) {
      results.set(step.id, {
        id: step.id,
        state: "failed",
        local_paths: [],
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  };

  // Незавершённая к таймауту задача остаётся pending: у kie она продолжает
  // работать и её можно забрать позже через get_job — терять её из отчёта нельзя.
  const settle = async (jobIds: string[]) => {
    if (jobIds.length === 0) return;
    const waited = await deps.waitAll(jobIds);
    for (const r of results.values()) {
      if (r.state !== "pending" || !r.job_id) continue;
      const done = waited.done.find((j) => j.id === r.job_id);
      const failed = waited.failed.find((j) => j.id === r.job_id);
      if (done) {
        r.state = "done";
        r.local_paths = done.localPaths ?? [];
        r.result_urls = done.resultUrls ?? [];
      } else if (failed) {
        r.state = "failed";
        r.error = failed.failMsg || "задача завершилась ошибкой";
      } else if (waited.errors?.[r.job_id]) {
        r.error = waited.errors[r.job_id];
      }
    }
  };

  // Шаги без источника — сразу и пачкой
  const launched = await Promise.all(plan.steps.filter((s) => !s.from).map((step) => launch(step)));
  await settle(launched.filter((id): id is string => id !== undefined));

  // Шаги от результата другого шага — по порядку рецепта, когда источник готов
  for (const step of plan.steps.filter((s) => s.from)) {
    const source = results.get(step.from!);
    const skip = (reason: string) =>
      results.set(step.id, { id: step.id, state: "skipped", local_paths: [], skip_reason: reason });

    if (!source) {
      skip(`шаг-источник ${step.from} не запускался`);
    } else if (source.state !== "done") {
      skip(`шаг-источник ${step.from} не готов (${source.state})`);
    } else if (source.local_paths.length === 0) {
      skip(`у шага-источника ${step.from} нет скачанного результата`);
    } else {
      const id = await launch(step, [source.local_paths[0]]);
      if (id) await settle([id]);
    }
  }

  return {
    recipe_id: plan.recipe_id,
    subject: plan.subject,
    // Порядок как в рецепте, а не в порядке завершения
    steps: plan.steps.map((s) => results.get(s.id)!).filter(Boolean),
    total_cost_usd: plan.total_usd,
    total_cost_credits: plan.total_credits,
  };
}
