/**
 * Style Descriptor schema and validation for taste library families
 */

import { z } from "zod";
import { UsageError } from "../../core/errors.js";

/**
 * Contrast ratio between two hex colors (WCAG formula)
 * Returns ratio where 1:1 is identical, 21:1 is max contrast
 */
export function contrastRatio(hexA: string, hexB: string): number {
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

/**
 * Palette entry with required hex, role, and ratio
 */
const PaletteEntrySchema = z.object({
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .transform((h) => h.toLowerCase()),
  role: z.enum(["bg", "surface", "text", "accent", "accent-ink", "muted", "line"]),
  ratio: z.number().min(0).max(1),
  contrastOn: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .transform((h) => h.toLowerCase())
    .optional(),
});

/**
 * Typography configuration
 */
const TypographySchema = z.object({
  display: z.string().min(1, "Display font required"),
  body: z.string().min(1, "Body font required"),
  scale: z.array(z.number().positive()).min(1, "At least one scale value required"),
  weightDisplay: z.number().min(100).max(900),
  tracking: z.number(), // in em units, can be negative
  caseAccent: z.enum(["none", "caps-labels", "all-caps"]),
});

/**
 * Spacing configuration
 */
const SpacingSchema = z.object({
  base: z.number().positive(),
  rhythm: z.array(z.number().positive()).min(1),
  density: z.enum(["airy", "balanced", "dense"]),
});

/**
 * Radii configuration
 */
const RadiiSchema = z.object({
  small: z.number().nonnegative(),
  large: z.number().nonnegative(),
  pattern: z.enum(["uniform", "pill-vs-square", "sharp"]),
});

/**
 * Motion configuration with WCAG-compliant easing
 */
const MotionSchema = z.object({
  duration: z.tuple([z.number().positive(), z.number().positive()]).refine(
    ([min, max]) => min <= max,
    "Duration min must be <= max"
  ),
  easing: z
    .string()
    .refine((e) => !e.includes("bounce") && !e.includes("elastic"), "easing cannot contain bounce or elastic"),
  character: z.enum(["static", "calm", "snappy", "expressive"]),
});

/**
 * Design dials (0..1 scale)
 */
const DialsSchema = z.object({
  visualDensity: z.number().min(0).max(1),
  designVariance: z.number().min(0).max(1),
  decorLevel: z.number().min(0).max(1),
  symmetry: z.number().min(0).max(1),
});

/**
 * Main style descriptor schema
 */
export const StyleDescriptorSchema = z
  .object({
    name: z.string().min(1, "Name required").max(200),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
      .min(1)
      .max(100),
    summary: z.string().max(300, "Summary must be ≤ 300 characters"),
    palette: z.array(PaletteEntrySchema).min(2, "Palette requires at least 2 colors"),
    type: TypographySchema,
    spacing: SpacingSchema,
    radii: RadiiSchema,
    shadows: z.enum(["none", "flat", "soft", "hard"]),
    motion: MotionSchema,
    dials: DialsSchema,
    decor: z.array(z.string()).min(0),
    dominant_pattern: z.string().min(1, "Dominant pattern required"),
    divergences: z.array(z.string()).min(0),
    prompt_fragment: z.string().max(600, "Prompt fragment must be ≤ 600 characters"),
    negative_fragment: z.string().max(400, "Negative fragment must be ≤ 400 characters"),
    exemplars: z
      .array(z.string().uuid())
      .min(1, "At least 1 exemplar required")
      .max(8, "Max 8 exemplars"),
    antiRefCheck: z.array(z.string()).min(0),
  })
  .refine(
    (d) => {
      // Validate contrast between bg and text roles
      const bgEntry = d.palette.find((p) => p.role === "bg");
      const textEntry = d.palette.find((p) => p.role === "text");

      if (bgEntry && textEntry) {
        const ratio = contrastRatio(bgEntry.hex, textEntry.hex);
        return ratio >= 4.5;
      }
      return true;
    },
    {
      message: "Contrast between bg and text must be ≥ 4.5:1",
      path: ["palette"],
    }
  );

export type StyleDescriptor = z.infer<typeof StyleDescriptorSchema>;

/**
 * Validate a descriptor from JSON with readable error messages
 */
export function validateDescriptor(json: unknown): StyleDescriptor {
  const result = StyleDescriptorSchema.safeParse(json);

  if (!result.success) {
    const messages = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `${path || "root"}: ${issue.message}`;
    });
    throw new UsageError(`Invalid descriptor:\n${messages.join("\n")}`);
  }

  return result.data;
}

/**
 * Convert descriptor to prompt fragments
 */
export function descriptorToPrompt(d: StyleDescriptor): { prompt: string; negative: string } {
  const prompt = `${d.prompt_fragment}\n\nПалитра: ${d.palette.map((p) => `${p.role} ${p.hex}`).join(", ")}. Шрифт: ${d.type.display}/${d.type.body}. Интенсивность движения: ${d.motion.character}.`;

  return {
    prompt,
    negative: d.negative_fragment,
  };
}

/**
 * Example descriptor template (valid, ready to be edited by Claude)
 */
export const DESCRIPTOR_TEMPLATE: StyleDescriptor = {
  name: "Example Style",
  slug: "example-style",
  summary: "A clean and minimal design system with balanced proportions.",
  palette: [
    { hex: "#ffffff", role: "bg", ratio: 1.0 },
    { hex: "#f5f5f5", role: "surface", ratio: 0.8 },
    { hex: "#000000", role: "text", ratio: 0.95 },
    { hex: "#0066cc", role: "accent", ratio: 0.7 },
    { hex: "#0052a3", role: "accent-ink", ratio: 0.65 },
    { hex: "#999999", role: "muted", ratio: 0.4 },
    { hex: "#cccccc", role: "line", ratio: 0.3 },
  ],
  type: {
    display: "Playfair Display",
    body: "Inter",
    scale: [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25],
    weightDisplay: 600,
    tracking: -0.02,
    caseAccent: "none",
  },
  spacing: {
    base: 16,
    rhythm: [4, 8, 12, 16, 24, 32, 48, 64],
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
  decor: ["geometric-accents"],
  dominant_pattern: "card-grid with subtle shadows",
  divergences: ["radius on buttons differs from cards"],
  prompt_fragment:
    "Clean minimal design with professional typography, balanced spacing, and soft shadows. Focus on clarity and hierarchy.",
  negative_fragment: "AI-slop, gradients, neon colors, bouncy animations, excessive decoration.",
  exemplars: ["550e8400-e29b-41d4-a716-446655440000"],
  antiRefCheck: ["no-purple-blue-gradient", "contrast-check-passed"],
};
