import { test } from "node:test";
import assert from "node:assert";
import { MemoryStore } from "../store/memory.js";
import { resolveStyle, applyStyle } from "./resolve.js";
import { UsageError } from "../../core/errors.js";
import type { Family } from "../store/types.js";
import type { StyleDescriptor } from "../families/descriptor.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

test("resolveStyle: approved family with descriptor", async () => {
  const store = new MemoryStore();

  // Create temporary preview file
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-"));
  const previewPath = path.join(tempDir, "preview.png");
  fs.writeFileSync(previewPath, "mock image data");

  try {
    // Create a reference for exemplar
    const ref = store.insertReference({
      sha256: "abc123",
      source: "test",
      sourceRef: "ref1",
      originalPath: path.join(tempDir, "image.png"),
      previewPath,
      width: 100,
      height: 100,
      bytes: 1000,
      meta: {},
      status: "active",
    });

    // Create approved family with descriptor
    const family = store.createFamily({
      name: "Test Style",
      slug: "test-style",
      status: "approved",
      descriptor: DESCRIPTOR_TEMPLATE,
      proposedBy: "owner",
    });

    // Add exemplar member
    store.setMembers(family.id, [
      { familyId: family.id, refId: ref.id, distance: 0, isExemplar: true },
    ]);

    const resolved = await resolveStyle("test-style", store);
    assert.strictEqual(resolved.family.slug, "test-style");
    assert.strictEqual(resolved.descriptor.name, "Test Style");
    assert.strictEqual(resolved.exemplarPaths.length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true });
  }
});

test("resolveStyle: proposed family throws UsageError", async () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Test Style",
    slug: "test-style",
    status: "proposed",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "cluster",
  });

  try {
    await resolveStyle("test-style", store);
    assert.fail("Should throw UsageError");
  } catch (err) {
    assert(err instanceof UsageError);
    assert(err.message.includes("not approved"));
  }
});

test("resolveStyle: family without descriptor throws error", async () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Test Style",
    slug: "test-style",
    status: "approved",
    proposedBy: "owner",
    // No descriptor
  });

  try {
    await resolveStyle("test-style", store);
    assert.fail("Should throw UsageError");
  } catch (err) {
    assert(err instanceof UsageError);
    assert(err.message.includes("no descriptor"));
  }
});

test("applyStyle: prompt fragment appended when not in input", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const result = applyStyle({
    prompt: "Generate an image",
    images: [],
    input: {},
    modelMeta: {
      promptField: "prompt",
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: [],
    },
  });

  assert(result.applied.includes("prompt_fragment"));
  assert(result.prompt.includes("Minimal design with clean typography"));
});

test("applyStyle: user prompt in input not modified", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const userPrompt = "My custom prompt";
  const result = applyStyle({
    prompt: "Default prompt",
    images: [],
    input: { prompt: userPrompt }, // User override
    modelMeta: {
      promptField: "prompt",
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: [],
    },
  });

  // Input prompt should not be changed
  assert.strictEqual(result.input.prompt, userPrompt);
  // Applied should NOT include prompt_fragment (user override takes priority)
  assert(!result.applied.includes("prompt_fragment"));
});

test("applyStyle: negative fragment applied when field exists and not in input", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const result = applyStyle({
    prompt: "Generate",
    images: [],
    input: {},
    modelMeta: {
      promptField: "prompt",
      required: [],
      defaults: {},
    },
    fields: {
      negative_prompt: { type: "string" },
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: [],
    },
  });

  assert(result.applied.includes("negative_fragment"));
  assert.strictEqual(result.input.negative_prompt, "Busy, loud, over-decorated");
});

test("applyStyle: negative not applied if user provided it", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const userNegative = "My negative prompt";
  const result = applyStyle({
    prompt: "Generate",
    images: [],
    input: { negative_prompt: userNegative },
    modelMeta: {
      promptField: "prompt",
      required: [],
      defaults: {},
    },
    fields: {
      negative_prompt: { type: "string" },
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: [],
    },
  });

  assert(!result.applied.includes("negative_fragment"));
  assert.strictEqual(result.input.negative_prompt, userNegative);
});

test("applyStyle: exemplars not added when images provided", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const result = applyStyle({
    prompt: "Generate",
    images: ["user-image.png"],
    input: {},
    modelMeta: {
      promptField: "prompt",
      imageField: "image",
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: ["/preview1.png", "/preview2.png"],
    },
  });

  assert.strictEqual(result.images.length, 1);
  assert.strictEqual(result.images[0], "user-image.png");
  assert(!result.applied.includes("exemplars"));
});

test("applyStyle: exemplars limited to 3 when imageList true", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const result = applyStyle({
    prompt: "Generate",
    images: [],
    input: {},
    modelMeta: {
      promptField: "prompt",
      imageField: "images",
      imageList: true,
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: ["/p1.png", "/p2.png", "/p3.png", "/p4.png", "/p5.png"],
    },
  });

  assert.strictEqual(result.images.length, 3);
  assert(result.applied.includes("exemplars(3)"));
});

test("applyStyle: exemplars limited to 1 when imageList false", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const result = applyStyle({
    prompt: "Generate",
    images: [],
    input: {},
    modelMeta: {
      promptField: "prompt",
      imageField: "image",
      imageList: false,
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: ["/p1.png", "/p2.png", "/p3.png"],
    },
  });

  assert.strictEqual(result.images.length, 1);
  assert(result.applied.includes("exemplars(1)"));
});

test("applyStyle: palette description added to prompt", () => {
  const store = new MemoryStore();
  const descriptor: StyleDescriptor = {
    ...DESCRIPTOR_TEMPLATE,
    palette: [
      { hex: "#ffffff", role: "bg", ratio: 1.0 },
      { hex: "#000000", role: "text", ratio: 0.95 },
      { hex: "#ff0000", role: "accent", ratio: 0.7 },
      { hex: "#00ff00", role: "surface", ratio: 0.8 },
    ],
  };

  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor,
    proposedBy: "owner",
  });

  const result = applyStyle({
    prompt: "Generate",
    images: [],
    input: {},
    modelMeta: {
      promptField: "prompt",
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor,
      exemplarPaths: [],
    },
  });

  assert(result.prompt.includes("Colour palette:"));
  assert(result.prompt.includes("white background"));
  assert(result.prompt.includes("red accents"));
});

test("applyStyle: returns new objects without mutation", () => {
  const store = new MemoryStore();
  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved",
    descriptor: DESCRIPTOR_TEMPLATE,
    proposedBy: "owner",
  });

  const originalInput = { someKey: "someValue" };
  const originalImages = ["img.png"];
  const originalPrompt = "Original";

  const result = applyStyle({
    prompt: originalPrompt,
    images: originalImages,
    input: originalInput,
    modelMeta: {
      promptField: "prompt",
      required: [],
      defaults: {},
    },
    resolved: {
      family,
      descriptor: DESCRIPTOR_TEMPLATE,
      exemplarPaths: [],
    },
  });

  // Originals should not be mutated
  assert.strictEqual(originalInput.someKey, "someValue");
  assert.strictEqual(originalImages.length, 1);
  assert.strictEqual(originalPrompt, "Original");
});
