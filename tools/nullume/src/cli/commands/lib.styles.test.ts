import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateDescriptor } from "../../library/families/descriptor.js";
import { getPackageDataDir } from "../../core/paths.js";

test("styles: all 8 base style files are valid", () => {
  const dataDir = getPackageDataDir();
  const stylesDir = path.join(dataDir, "styles");

  assert.ok(fs.existsSync(stylesDir), `Styles directory not found: ${stylesDir}`);

  const files = fs.readdirSync(stylesDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  // Should have exactly 8 styles
  assert.equal(jsonFiles.length, 8, `Expected 8 style files, found ${jsonFiles.length}`);

  const expectedSlugs = [
    "swiss-grid",
    "editorial",
    "quiet-luxury",
    "clinical",
    "warm-organic",
    "japandi",
    "neo-brutalist",
    "playful-soft",
  ];

  for (const slug of expectedSlugs) {
    const filePath = path.join(stylesDir, `${slug}.json`);
    assert.ok(fs.existsSync(filePath), `Style file not found: ${slug}.json`);

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Validate descriptor
    const descriptor = validateDescriptor(data.descriptor);

    // Check required fields
    assert.ok(descriptor.name, `${slug}: name required`);
    assert.ok(descriptor.slug, `${slug}: slug required`);
    assert.equal(descriptor.slug, slug, `${slug}: slug mismatch`);
    assert.ok(descriptor.palette, `${slug}: palette required`);
    assert.ok(descriptor.type, `${slug}: type required`);
    assert.ok(descriptor.mood, `${slug}: mood required`);
    assert.ok(Array.isArray(descriptor.mood), `${slug}: mood should be array`);

    // Check queries exist
    assert.ok(data.queries, `${slug}: queries required`);
    assert.ok(Array.isArray(data.queries), `${slug}: queries should be array`);
    assert.ok(data.queries.length >= 3, `${slug}: should have at least 3 queries`);
    assert.ok(data.queries.length <= 5, `${slug}: should have at most 5 queries`);

    // Check exemplars are empty (to be filled by collect command)
    assert.ok(Array.isArray(descriptor.exemplars), `${slug}: exemplars should be array`);
    assert.equal(descriptor.exemplars.length, 0, `${slug}: exemplars should be empty initially`);

    // Validate fonts are in approved list
    const approvedFonts = [
      "Rubik",
      "Nunito Sans",
      "Lexend",
      "Source Sans 3",
      "Nunito",
      "Inter",
      "Manrope",
      "Playfair Display",
      "Montserrat",
      "Open Sans",
      "Golos Text",
      "JetBrains Mono",
      "IBM Plex Sans",
    ];

    const displayFont = descriptor.type.display;
    const bodyFont = descriptor.type.body;

    assert.ok(
      approvedFonts.includes(displayFont),
      `${slug}: display font "${displayFont}" not in approved list`
    );
    assert.ok(approvedFonts.includes(bodyFont), `${slug}: body font "${bodyFont}" not in approved list`);

    // Check palette has required roles
    const roles = descriptor.palette.map((p) => p.role);
    assert.ok(roles.includes("bg"), `${slug}: palette must have 'bg' role`);
    assert.ok(roles.includes("text"), `${slug}: palette must have 'text' role`);

    // Validate contrast between bg and text is >= 4.5
    const bgColor = descriptor.palette.find((p) => p.role === "bg");
    const textColor = descriptor.palette.find((p) => p.role === "text");
    if (bgColor && textColor) {
      const ratio = contrastRatio(bgColor.hex, textColor.hex);
      assert.ok(ratio >= 4.5, `${slug}: contrast ratio ${ratio} must be >= 4.5`);
    }

    // Check no bounce or elastic in motion
    assert.ok(
      !descriptor.motion.easing.includes("bounce"),
      `${slug}: easing cannot contain 'bounce'`
    );
    assert.ok(
      !descriptor.motion.easing.includes("elastic"),
      `${slug}: easing cannot contain 'elastic'`
    );
  }
});

test("styles: query strings are descriptive", () => {
  const dataDir = getPackageDataDir();
  const stylesDir = path.join(dataDir, "styles");

  const files = fs.readdirSync(stylesDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(stylesDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const queries = data.queries || [];

    for (const query of queries) {
      assert.ok(query.length > 5, `Query too short: "${query}"`);
      assert.ok(query.length < 100, `Query too long: "${query}"`);

      // Should be mostly English (allow digits for years, years with s, etc)
      assert.ok(/^[a-z0-9\s\-,'.]+$/i.test(query), `Query contains invalid characters: "${query}"`);
    }
  }
});

/**
 * Contrast ratio between two hex colors (WCAG formula)
 */
function contrastRatio(hexA: string, hexB: string): number {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);

  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);

  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);

  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("styles: fonts from all 8 styles are in approved pairs", () => {
  const approvedFonts = [
    "Rubik",
    "Nunito Sans",
    "Lexend",
    "Source Sans 3",
    "Nunito",
    "Inter",
    "Manrope",
    "Playfair Display",
    "Montserrat",
    "Open Sans",
    "Golos Text",
    "JetBrains Mono",
    "IBM Plex Sans",
  ];

  const dataDir = getPackageDataDir();
  const stylesDir = path.join(dataDir, "styles");
  const files = fs.readdirSync(stylesDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(stylesDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const descriptor = data.descriptor;
    const slug = descriptor.slug;

    const displayFont = descriptor.type.display;
    const bodyFont = descriptor.type.body;

    assert.ok(
      approvedFonts.includes(displayFont),
      `${slug}: display font "${displayFont}" not in approved list`
    );
    assert.ok(
      approvedFonts.includes(bodyFont),
      `${slug}: body font "${bodyFont}" not in approved list`
    );
  }
});

test("resolve: palette color names are meaningful", async () => {
  const { applyStyle } = await import("../../library/style/resolve.js");
  const { MemoryStore } = await import("../../library/store/memory.js");

  const store = new MemoryStore();
  const descriptor = {
    name: "Test",
    slug: "test",
    summary: "Test",
    palette: [
      { hex: "#ffffff", role: "bg", ratio: 1.0 },
      { hex: "#000000", role: "text", ratio: 0.95 },
      { hex: "#d52b1e", role: "accent", ratio: 0.7 },
    ],
    type: {
      display: "Manrope",
      body: "Inter",
      scale: [1],
      weightDisplay: 600,
      tracking: -0.02,
      caseAccent: "none" as const,
    },
    spacing: {
      base: 16,
      rhythm: [4, 8, 16],
      density: "balanced" as const,
    },
    radii: {
      small: 4,
      large: 12,
      pattern: "uniform" as const,
    },
    shadows: "soft" as const,
    motion: {
      duration: [150, 300] as [number, number],
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      character: "calm" as const,
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
    prompt_fragment: "Minimal design",
    exemplars: ["00000000-0000-0000-0000-000000000000"],
    antiRefCheck: [],
  };

  const family = store.createFamily({
    name: "Test",
    slug: "test",
    status: "approved" as const,
    descriptor,
    proposedBy: "owner" as const,
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

  // Should include colour palette description
  assert.ok(result.prompt.includes("Colour palette:"));
  // Should have converted hex colors to names
  assert.ok(result.prompt.includes("white") || result.prompt.includes("background"));
  assert.ok(result.prompt.includes("red") || result.prompt.includes("accent"));
});

test("resolve: hexToColorName converts basic colors", async () => {
  const { applyStyle } = await import("../../library/style/resolve.js");
  const { MemoryStore } = await import("../../library/store/memory.js");

  const testCases = [
    { hex: "#ffffff", expectedName: "white" },
    { hex: "#000000", expectedName: "black" },
    { hex: "#ff0000", expectedName: "red" },
  ];

  const store = new MemoryStore();

  for (const { hex, expectedName } of testCases) {
    const descriptor = {
      name: "Test",
      slug: "test",
      summary: "Test",
      palette: [
        { hex: "#ffffff", role: "bg", ratio: 1.0 },
        { hex: "#000000", role: "text", ratio: 0.95 },
        { hex, role: "accent", ratio: 0.7 },
      ],
      type: {
        display: "Manrope",
        body: "Inter",
        scale: [1],
        weightDisplay: 600,
        tracking: -0.02,
        caseAccent: "none" as const,
      },
      spacing: {
        base: 16,
        rhythm: [4, 8, 16],
        density: "balanced" as const,
      },
      radii: {
        small: 4,
        large: 12,
        pattern: "uniform" as const,
      },
      shadows: "soft" as const,
      motion: {
        duration: [150, 300] as [number, number],
        easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        character: "calm" as const,
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
      prompt_fragment: "Test",
      exemplars: ["00000000-0000-0000-0000-000000000000"],
      antiRefCheck: [],
    };

    const family = store.createFamily({
      name: "Test",
      slug: `test-${hex}`,
      status: "approved" as const,
      descriptor,
      proposedBy: "owner" as const,
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

    assert.ok(
      result.prompt.includes(expectedName),
      `Expected "${expectedName}" for color ${hex}, got: ${result.prompt}`
    );
  }
});
