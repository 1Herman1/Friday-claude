import { test } from "node:test";
import assert from "node:assert";
import { createJobTask } from "./run.js";
import { MemoryStore } from "../../library/store/memory.js";
import type { Provider } from "../providers/types.js";
import type { StyleDescriptor } from "../../library/families/descriptor.js";

const DESCRIPTOR_TEMPLATE: StyleDescriptor = {
  name: "Test Style",
  slug: "test-style",
  summary: "A test style",
  palette: [
    { hex: "#ffffff", role: "bg", ratio: 1.0 },
    { hex: "#000000", role: "text", ratio: 0.95 },
  ],
  type: {
    display: "Playfair Display",
    body: "Inter",
    scale: [1],
    weightDisplay: 600,
    tracking: -0.02,
    caseAccent: "none",
  },
  spacing: {
    base: 16,
    rhythm: [4, 8, 16],
    density: "balanced",
  },
  radii: {
    small: 4,
    large: 12,
    pattern: "uniform",
  },
  shadows: "soft",
  motion: {
    duration: [150, 300],
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    character: "calm",
  },
  dials: {
    visualDensity: 0.5,
    designVariance: 0.4,
    decorLevel: 0.3,
    symmetry: 0.7,
  },
  decor: [],
  dominant_pattern: "minimal",
  divergences: [],
  prompt_fragment: "Minimal design with clean typography",
  negative_fragment: "Busy, loud, over-decorated",
  exemplars: ["00000000-0000-0000-0000-000000000001"],
  antiRefCheck: [],
};

// Mock provider that collects what would be generated
class MockProvider implements Provider {
  name = "mock";
  lastInput: Record<string, unknown> | null = null;

  async balance() {
    return { total: 0, used: 0 };
  }

  async models() {
    return [];
  }

  async model(id: string) {
    return {
      id,
      category: "image" as const,
      api: "jobs" as const,
      fields: {
        prompt: { type: "string", required: true },
        negative_prompt: { type: "string" },
      },
      meta: {
        promptField: "prompt",
        required: ["prompt"],
        defaults: {},
      },
      schemaSource: "seed" as const,
      source: "vendored" as const,
    };
  }

  async estimate(model: string, input: Record<string, unknown>) {
    return {
      creditsMin: 10,
      creditsMax: 20,
      usdMin: 0.1,
      usdMax: 0.2,
      approximate: false,
      source: "vendored" as const,
    };
  }

  async create(model: string, input: Record<string, unknown>) {
    this.lastInput = input;
    return { taskId: "test-task", api: "jobs" };
  }

  async status(ref: string) {
    return {
      state: "pending" as const,
      urls: [],
      raw: {},
    };
  }

  async upload(filePath: string) {
    return `https://example.com/${filePath}`;
  }
}

test("createJobTask: with style, fills job.styleFamily", async () => {
  const store = new MemoryStore();

  // Create reference
  const ref = store.insertReference({
    sha256: "abc123",
    source: "test",
    sourceRef: "ref1",
    originalPath: "/tmp/image.png",
    previewPath: "/tmp/preview.png",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  });

  // Create approved family
  const family = store.createFamily({
    name: "Test Style",
    slug: "test-style",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  // Add exemplar
  store.setMembers(family.id, [
    { familyId: family.id, refId: ref.id, distance: 0, isExemplar: true },
  ]);

  const provider = new MockProvider();

  const job = await createJobTask(provider, {
    model: "test-model",
    prompt: "Generate an image",
    style: "test-style",
    libraryStore: store,
  });

  assert.strictEqual(job.styleFamily, "test-style");
});

test("createJobTask: without style, no styleFamily set", async () => {
  const provider = new MockProvider();

  const job = await createJobTask(provider, {
    model: "test-model",
    prompt: "Generate an image",
  });

  assert.strictEqual(job.styleFamily, undefined);
});

test("createJobTask: style prompt applied to input", async () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Test Style",
    slug: "test-style",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  store.setMembers(family.id, []);

  const provider = new MockProvider();

  const job = await createJobTask(provider, {
    model: "test-model",
    prompt: "Base prompt",
    style: "test-style",
    libraryStore: store,
  });

  // Check that input has combined prompt
  const inputPrompt = job.input.prompt as string;
  assert(inputPrompt.includes("Base prompt"));
  assert(inputPrompt.includes("Minimal design with clean typography"));
});

test("createJobTask: user input takes priority over style", async () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Test Style",
    slug: "test-style",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  store.setMembers(family.id, []);

  const provider = new MockProvider();

  const job = await createJobTask(provider, {
    model: "test-model",
    prompt: "Should be ignored",
    input: { prompt: "User override" },
    style: "test-style",
    libraryStore: store,
  });

  // User input should be in final output unchanged
  assert.strictEqual(job.input.prompt, "User override");
});

test("createJobTask: style negative applied when field exists", async () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Test Style",
    slug: "test-style",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  store.setMembers(family.id, []);

  const provider = new MockProvider();

  const job = await createJobTask(provider, {
    model: "test-model",
    prompt: "Generate",
    style: "test-style",
    libraryStore: store,
  });

  // negative_prompt should be filled from descriptor
  assert.strictEqual(job.input.negative_prompt, "Busy, loud, over-decorated");
});
