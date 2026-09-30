// Собирает data/higgsfield-styles.json из авторских описаний 33 фильтров.
// Общие поля (типографика, отступы, моторика) — по группе; уникальные
// (палитра, промпт, негатив, паттерн, настроение) — у каждого стиля свои.
// Запуск: tsx scripts/build-higgsfield-styles.mts — валидирует каждый
// дескриптор по StyleDescriptorSchema с фиктивным образцом.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StyleDescriptorSchema } from "../src/library/families/descriptor.js";

type Group = "art" | "color-light" | "texture";

interface StyleSpec {
  slug: string;
  name: string;
  group: Group;
  bg: string;
  text: string;
  accent: string;
  surface?: string;
  shadows?: "none" | "flat" | "soft" | "hard";
  pattern: string;
  prompt: string;
  negative: string;
  mood: string[];
  decor?: string[];
  dials?: Partial<{ visualDensity: number; designVariance: number; decorLevel: number; symmetry: number }>;
}

const base: Record<Group, object> = {
  art: {
    type: { display: "Fraunces", body: "IBM Plex Sans", scale: [14, 16, 20, 28, 40, 56], weightDisplay: 600, tracking: 0, caseAccent: "none" },
    spacing: { base: 8, rhythm: [8, 16, 24, 48], density: "balanced" },
    radii: { small: 2, large: 8, pattern: "uniform" },
    motion: { duration: [200, 400], easing: "cubic-bezier(0.2, 0, 0, 1)", character: "calm" },
  },
  "color-light": {
    type: { display: "Space Grotesk", body: "Inter Tight", scale: [14, 16, 20, 28, 40, 64], weightDisplay: 500, tracking: 0.01, caseAccent: "caps-labels" },
    spacing: { base: 8, rhythm: [8, 16, 32, 64], density: "airy" },
    radii: { small: 0, large: 4, pattern: "sharp" },
    motion: { duration: [150, 350], easing: "cubic-bezier(0.4, 0, 0.2, 1)", character: "snappy" },
  },
  texture: {
    type: { display: "Syne", body: "Manrope", scale: [14, 16, 20, 28, 44, 72], weightDisplay: 700, tracking: -0.01, caseAccent: "none" },
    spacing: { base: 8, rhythm: [8, 16, 32, 56], density: "dense" },
    radii: { small: 4, large: 16, pattern: "pill-vs-square" },
    motion: { duration: [250, 600], easing: "cubic-bezier(0.16, 1, 0.3, 1)", character: "expressive" },
  },
};

const specs: StyleSpec[] = [
  // ——— art ———
  { slug: "sketch", name: "Sketch", group: "art", bg: "#f7f4ee", text: "#1f1d1a", accent: "#8a6d3b", pattern: "hand-drawn graphite linework on off-white paper, hatching for shade",
    prompt: "hand-drawn pencil sketch, textured graphite linework, cross-hatching for shadows, off-white paper grain, loose confident strokes, minimal color, illustration study",
    negative: "photorealistic, glossy, 3d render, neon, smooth gradients", mood: ["handmade", "quiet", "studious"], decor: ["hatching", "paper grain"] },
  { slug: "canvas", name: "Canvas", group: "art", bg: "#f2ead9", text: "#2b2419", accent: "#b5533c", pattern: "visible canvas weave with impasto paint strokes",
    prompt: "hand-painted artwork on textured canvas, visible weave, thick impasto brush strokes, warm earthy pigments, gallery painting look",
    negative: "digital vector, flat colors, photorealistic, neon", mood: ["warm", "tactile", "artisanal"], decor: ["canvas weave", "impasto"] },
  { slug: "hand-paint", name: "Hand paint", group: "art", bg: "#faf8f3", text: "#20211f", accent: "#2f6f9f", pattern: "loose freeform brushwork with visible drips and gaps",
    prompt: "freeform hand-painted brushwork, loose expressive strokes, visible bristle marks and paint drips, unfinished edges, gouache and acrylic feel",
    negative: "clean vector, photoreal, symmetrical, polished", mood: ["spontaneous", "expressive", "raw"], decor: ["drips", "bristle marks"] },
  { slug: "palette", name: "Palette", group: "art", bg: "#f5f1ea", text: "#23201c", accent: "#d9643a", surface: "#e8dfd0", pattern: "hand-painted color blocks composed like a painter's palette",
    prompt: "hand-painted color composition, bold pigment blocks arranged like a painter's palette, soft blended edges, rich saturated oils, painterly abstraction",
    negative: "photorealistic, neon, thin outlines, monochrome", mood: ["painterly", "rich", "composed"], dials: { decorLevel: 0.5 } },
  { slug: "akrill", name: "Akrill", group: "art", bg: "#ede9e1", text: "#1c1b19", accent: "#e04a2f", surface: "#dcd6c9", pattern: "layered opaque acrylic color blocks with hard edges",
    prompt: "layered acrylic color blocks, opaque flat pigments, hard painted edges, overlapping shapes, bold poster-like composition, matte finish",
    negative: "glossy, photorealistic, gradients, thin lines", mood: ["bold", "graphic", "confident"], dials: { visualDensity: 0.6 } },
  { slug: "comic", name: "Comic", group: "art", bg: "#fffdf5", text: "#111111", accent: "#e8352b", pattern: "black ink outlines with flat cel color and halftone dots",
    prompt: "graphic comic book illustration, bold black ink outlines, flat cel shading, halftone dot texture, limited primary palette, clean panel composition",
    negative: "photorealistic, soft painterly, 3d render, blur", mood: ["punchy", "graphic", "playful"], decor: ["halftone", "ink outline"] },
  { slug: "flash-comic", name: "Flash comic", group: "art", bg: "#fff8e6", text: "#0f0f0f", accent: "#ffb400", surface: "#ffe9b3", pattern: "high-energy comic panels with speed lines and burst shapes",
    prompt: "high-energy comic art, dynamic speed lines, action burst shapes, heavy ink, saturated pop colors, dramatic foreshortening, kinetic composition",
    negative: "calm, muted, photorealistic, soft focus", mood: ["energetic", "loud", "kinetic"], decor: ["speed lines", "bursts"], dials: { visualDensity: 0.8, decorLevel: 0.7 } },
  { slug: "vintage", name: "Vintage", group: "art", bg: "#efe6d2", text: "#2a2118", accent: "#8b5e34", surface: "#e2d6bd", pattern: "hand-inked engraving lines on aged paper",
    prompt: "vintage hand-inked illustration, engraving style fine lines, aged sepia paper, slight ink bleed, old print catalog aesthetic",
    negative: "neon, modern, photorealistic, glossy, saturated", mood: ["nostalgic", "crafted", "quiet"], decor: ["engraving lines", "aged paper"] },
  { slug: "magazine", name: "Magazine", group: "art", bg: "#f4f2ee", text: "#171717", accent: "#c8102e", pattern: "editorial print layout with strong grid and paper texture",
    prompt: "printed magazine editorial look, glossy print halftone, strong typographic grid, generous white space, fashion editorial photography styling, subtle paper texture",
    negative: "cluttered, neon, cartoon, low resolution", mood: ["editorial", "polished", "confident"], shadows: "flat", dials: { symmetry: 0.7 } },
  { slug: "paper", name: "Paper", group: "art", bg: "#f6f1e7", text: "#2b2924", accent: "#4f6f52", surface: "#e9e1d2", pattern: "handcrafted paper cut layers with soft fiber texture",
    prompt: "handcrafted paper texture, layered paper cut shapes, soft fiber grain, gentle shadows between layers, craft collage feel",
    negative: "glossy, digital gradients, neon, photoreal glass", mood: ["gentle", "crafted", "warm"], shadows: "soft", decor: ["paper fiber", "cut layers"] },
  { slug: "origami", name: "Origami", group: "art", bg: "#f9f9f7", text: "#1b1f24", accent: "#e0552b", surface: "#e6e8ec", pattern: "crisp folded-paper facets with sharp geometric planes",
    prompt: "origami style, crisp folded paper geometry, sharp planar facets, clean matte paper surfaces, precise angular shadows, minimal palette",
    negative: "organic curves, soft painterly, noise, clutter", mood: ["precise", "clean", "geometric"], shadows: "hard", dials: { symmetry: 0.8, decorLevel: 0.2 } },
  { slug: "marble", name: "Marble", group: "art", bg: "#f3f1ee", text: "#1f1e1d", accent: "#9c7c4a", surface: "#e4e0da", pattern: "sculpted white marble with fine veining and soft studio light",
    prompt: "sculpted marble visual style, polished white stone with fine grey veining, classical sculptural forms, soft museum lighting, timeless and monumental",
    negative: "neon, cartoon, plastic, busy background", mood: ["classical", "calm", "monumental"], shadows: "soft", dials: { decorLevel: 0.2, symmetry: 0.7 } },
  { slug: "modern", name: "Modern", group: "art", bg: "#ffffff", text: "#111318", accent: "#1f4fd8", surface: "#f1f3f6", pattern: "clean geometric minimalism with generous negative space",
    prompt: "clean geometric minimalism, simple primary shapes, generous negative space, flat even lighting, restrained two-tone palette, precise alignment",
    negative: "ornament, texture, grain, clutter, painterly", mood: ["minimal", "precise", "calm"], shadows: "none", dials: { visualDensity: 0.2, decorLevel: 0.05, symmetry: 0.8 } },
  // ——— color-light ———
  { slug: "noir", name: "Noir", group: "color-light", bg: "#0b0b0d", text: "#f2f0ea", accent: "#c9a961", surface: "#1c1c20", shadows: "hard", pattern: "single hard key light against deep black, subject carved out by contrast",
    prompt: "cinematic film-noir lighting, deep blacks, single hard key light from the side, high contrast chiaroscuro, subtle film grain, muted desaturated palette with a single warm highlight, moody and restrained",
    negative: "flat even lighting, pastel colors, cluttered background, cartoon, oversaturated, lens flare", mood: ["moody", "restrained", "cinematic", "mysterious"], decor: ["film grain", "long shadows"], dials: { visualDensity: 0.3, decorLevel: 0.2 } },
  { slug: "cold-vision", name: "Cold vision", group: "color-light", bg: "#070b12", text: "#e6f0ff", accent: "#3fd2ff", surface: "#111a28", shadows: "hard", pattern: "cold cyan neon rim light with deep blue shadows",
    prompt: "cold neon shadow lighting, cyan and steel-blue rim light, deep navy shadows, wet reflective surfaces, night-time clinical atmosphere",
    negative: "warm tones, daylight, pastel, cartoon", mood: ["cold", "clinical", "nocturnal"], decor: ["neon rim", "reflections"] },
  { slug: "ultraviolet", name: "Ultraviolet", group: "color-light", bg: "#0d0619", text: "#f3ecff", accent: "#b04dff", surface: "#1c0f33", shadows: "soft", pattern: "violet blacklight glow on dark ground",
    prompt: "neon ultraviolet glow, blacklight violet and magenta illumination, glowing edges on dark background, fluorescent highlights, nightclub luminescence",
    negative: "daylight, warm beige, muted, matte flat", mood: ["electric", "night", "glowing"], decor: ["uv glow"] },
  { slug: "two-color", name: "Two color", group: "color-light", bg: "#101010", text: "#fafafa", accent: "#ff3b1f", shadows: "none", pattern: "strict two-tone duotone with hard contrast and no midtones",
    prompt: "high-contrast two-tone duotone, strictly two colors, hard edged posterized shading, no midtones, bold graphic print look",
    negative: "full color, soft gradients, photorealistic shading, noise", mood: ["bold", "graphic", "stark"], dials: { decorLevel: 0.1, designVariance: 0.3 } },
  { slug: "overexposed", name: "Overexposed", group: "color-light", bg: "#fbfbf9", text: "#2a2a2a", accent: "#d19a4a", surface: "#f0efeb", shadows: "none", pattern: "blown-out highlights with washed pale tones",
    prompt: "extreme overexposure, blown-out white highlights, washed pale tones, soft halation, bright airy dreamlike light, minimal shadows",
    negative: "dark, high contrast shadows, saturated, night", mood: ["airy", "bright", "dreamy"], decor: ["halation"] },
  { slug: "ocean", name: "Ocean", group: "color-light", bg: "#05263a", text: "#e8f6fb", accent: "#3fc1c9", surface: "#0e3a52", shadows: "soft", pattern: "liquid sea-blue overlay with caustic light ripples",
    prompt: "liquid sea color overlay, deep teal and aquamarine tones, underwater caustic light ripples, soft flowing gradients, submerged calm atmosphere",
    negative: "warm orange, dry desert, harsh contrast, neon pink", mood: ["fluid", "calm", "deep"], decor: ["caustics", "ripples"] },
  { slug: "lava", name: "Lava", group: "color-light", bg: "#1a0705", text: "#fff1e6", accent: "#ff5a1f", surface: "#3a120a", shadows: "hard", pattern: "molten orange-red glow flowing over near-black",
    prompt: "liquid lava color motion, molten orange and red glow, flowing incandescent streaks over near-black, heat shimmer, dramatic warm light",
    negative: "cool blue, pastel, flat, daylight", mood: ["hot", "dramatic", "intense"], decor: ["molten glow"] },
  { slug: "toxic", name: "Toxic", group: "color-light", bg: "#0a0f06", text: "#effff0", accent: "#8cff1f", surface: "#16210e", shadows: "hard", pattern: "radioactive acid-green neon blast on dark ground",
    prompt: "radioactive neon color blast, acid green and toxic yellow glow, dark industrial background, hazard-sign energy, harsh luminous highlights",
    negative: "pastel, warm beige, soft natural light, muted", mood: ["aggressive", "electric", "hazard"], decor: ["neon glow"] },
  { slug: "acid", name: "Acid", group: "color-light", bg: "#120a1f", text: "#f8f2ff", accent: "#ff2bd6", surface: "#231340", shadows: "soft", pattern: "psychedelic neon distortion with chromatic aberration",
    prompt: "psychedelic neon color distortion, magenta cyan and lime, chromatic aberration, warped rainbow gradients, glitchy saturated trip visuals",
    negative: "muted, monochrome, realistic natural light, calm", mood: ["trippy", "loud", "saturated"], decor: ["chromatic aberration"], dials: { designVariance: 0.8, decorLevel: 0.7 } },
  { slug: "lsd", name: "LSD", group: "color-light", bg: "#1a0b2a", text: "#fbf3ff", accent: "#ffcc33", surface: "#2b1547", shadows: "soft", pattern: "swirling hallucinogenic color waves",
    prompt: "hallucinogenic color waves, swirling liquid rainbow gradients, melting shapes, kaleidoscopic symmetry, vivid saturated psychedelic poster",
    negative: "minimal, monochrome, sharp corporate, muted", mood: ["hallucinatory", "flowing", "vivid"], decor: ["swirls"], dials: { designVariance: 0.9, decorLevel: 0.8 } },
  { slug: "cannabis", name: "Cannabis", group: "color-light", bg: "#141a0f", text: "#f2f5e8", accent: "#9ccc4a", surface: "#22301a", shadows: "soft", pattern: "smoky psychedelic poster with hazy green glow",
    prompt: "smoky psychedelic poster look, hazy green and amber glow, soft drifting smoke layers, 70s poster print texture, relaxed lo-fi atmosphere",
    negative: "clinical, sharp, cold blue, corporate", mood: ["hazy", "relaxed", "retro"], decor: ["smoke", "print texture"] },
  { slug: "random-glow", name: "Random Glow", group: "color-light", bg: "#0e0e14", text: "#f4f4f8", accent: "#ff8a3d", surface: "#1a1a24", shadows: "soft", pattern: "scattered soft glow spots in random colors on dark ground",
    prompt: "scattered soft glow spots, random colored light leaks, bokeh orbs, dark background, gentle luminous haze",
    negative: "flat even light, daylight, matte, grayscale", mood: ["playful", "luminous", "night"], decor: ["bokeh", "light leaks"], dials: { designVariance: 0.7 } },
  // ——— texture ———
  { slug: "ink-riot", name: "Ink Riot", group: "texture", bg: "#f5f2ec", text: "#141414", accent: "#d92626", surface: "#e6e1d7", shadows: "flat", pattern: "stacked mixed-media collage with ink splatter and torn edges",
    prompt: "stacked mixed-media composition, ink splatter, torn paper edges, layered collage fragments, rough xerox textures, punk zine energy",
    negative: "clean minimal, polished, photorealistic, symmetrical", mood: ["chaotic", "raw", "punk"], decor: ["ink splatter", "torn edges"], dials: { visualDensity: 0.9, designVariance: 0.8, symmetry: 0.2 } },
  { slug: "fragments", name: "Fragments", group: "texture", bg: "#f1f1f3", text: "#17181c", accent: "#2f6bff", surface: "#dfe1e6", shadows: "flat", pattern: "layered abstract shards and offset fragments",
    prompt: "layered abstract visual fragments, offset shards and slices of the subject, translucent overlapping layers, deconstructed composition",
    negative: "single clean subject, painterly, warm vintage", mood: ["deconstructed", "abstract", "layered"], dials: { designVariance: 0.8, symmetry: 0.3 } },
  { slug: "multiverse", name: "Multiverse", group: "texture", bg: "#0c0c14", text: "#f2f2f8", accent: "#ff4fa3", surface: "#1a1a2c", shadows: "soft", pattern: "colliding overlapping realities with duplicated ghost layers",
    prompt: "layered reality collision, duplicated ghost copies of the subject offset in space, overlapping translucent worlds, dimensional glitch, cinematic dark background",
    negative: "single clean subject, flat vector, pastel", mood: ["surreal", "layered", "cinematic"], decor: ["ghost layers"], dials: { designVariance: 0.8 } },
  { slug: "broken-mirror", name: "Broken mirror", group: "texture", bg: "#111114", text: "#f5f5f7", accent: "#9fd3ff", surface: "#1f1f26", shadows: "hard", pattern: "shattered glass shards reflecting fragments of the subject",
    prompt: "broken mirror reflection, shattered glass shards, fragmented reflections of the subject, sharp glass edges catching light, dark background",
    negative: "soft painterly, warm paper, cartoon, intact smooth surface", mood: ["sharp", "fractured", "dramatic"], decor: ["glass shards"] },
  { slug: "bubbles", name: "Bubbles", group: "texture", bg: "#eef6fb", text: "#1c2a33", accent: "#ff7eb6", surface: "#dbeaf3", shadows: "soft", pattern: "dreamy soap bubbles with iridescent film",
    prompt: "dreamy soap bubble texture, iridescent thin-film rainbows, floating translucent spheres, soft pastel light, airy weightless mood",
    negative: "dark, harsh contrast, grunge, matte flat", mood: ["dreamy", "light", "iridescent"], decor: ["iridescence"] },
  { slug: "particles", name: "Particles", group: "texture", bg: "#08080c", text: "#f4f4f8", accent: "#ffd166", surface: "#15151d", shadows: "soft", pattern: "luminous particles drifting through dark space",
    prompt: "luminous particles in motion, glowing dust and sparks drifting through dark space, depth of field bokeh, subtle motion trails",
    negative: "flat daylight, paper texture, cartoon", mood: ["magical", "quiet", "cosmic"], decor: ["sparks", "dust"] },
  { slug: "windows", name: "Windows", group: "texture", bg: "#e9ecef", text: "#141a22", accent: "#0a6cff", surface: "#ffffff", shadows: "flat", pattern: "overlapping retro OS interface windows framing the subject",
    prompt: "overlapping digital interface windows, retro operating system frames and dialog boxes framing the subject, pixel borders, desktop screenshot aesthetic",
    negative: "painterly, natural photo, organic textures", mood: ["digital", "retro", "meta"], decor: ["ui windows", "pixel borders"], dials: { visualDensity: 0.8 } },
  { slug: "tracking", name: "Tracking", group: "texture", bg: "#0b0f14", text: "#eaf2ff", accent: "#39ff88", surface: "#151c25", shadows: "none", pattern: "dynamic tracking lines and data markers around the subject",
    prompt: "dynamic object tracking overlay, thin green vector lines and corner markers around the subject, motion-tracking data points, HUD readouts, dark technical background",
    negative: "painterly, warm paper, soft bokeh", mood: ["technical", "precise", "surveillance"], decor: ["hud lines", "markers"] },
];

const dialsDefault = { visualDensity: 0.5, designVariance: 0.5, decorLevel: 0.4, symmetry: 0.5 };

const styles = specs.map((s) => {
  const palette = [
    { hex: s.bg, role: "bg", ratio: 0.55 },
    { hex: s.text, role: "text", ratio: 0.2, contrastOn: s.bg },
    { hex: s.accent, role: "accent", ratio: 0.1 },
    ...(s.surface ? [{ hex: s.surface, role: "surface", ratio: 0.15 }] : []),
  ];
  const descriptor = {
    summary: `Словарный стиль по фильтру «${s.name}» из каталога Higgsfield (${s.group}).`,
    palette,
    ...base[s.group],
    shadows: s.shadows ?? "soft",
    dials: { ...dialsDefault, ...(s.dials ?? {}) },
    decor: s.decor ?? [],
    dominant_pattern: s.pattern,
    divergences: [],
    prompt_fragment: s.prompt,
    negative_fragment: s.negative,
    mood: s.mood,
    antiRefCheck: ["no purple-blue gradient", "no generic stock look"],
  };
  // Проверка по полной схеме — с фиктивным образцом, его подставит lib style apply.
  const full = { name: `Higgsfield · ${s.name}`, slug: `higgsfield-${s.slug}`, ...descriptor, exemplars: ["00000000-0000-4000-8000-000000000000"] };
  const parsed = StyleDescriptorSchema.safeParse(full);
  if (!parsed.success) {
    throw new Error(`${s.slug}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return { slug: `higgsfield-${s.slug}`, name: `Higgsfield · ${s.name}`, tag: `hf:${s.slug}`, descriptor };
});

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "higgsfield-styles.json");
fs.writeFileSync(out, JSON.stringify({ generatedBy: "scripts/build-higgsfield-styles.mts", styles }, null, 2) + "\n");
console.log(`✓ ${styles.length} стилей → ${path.relative(process.cwd(), out)}`);
