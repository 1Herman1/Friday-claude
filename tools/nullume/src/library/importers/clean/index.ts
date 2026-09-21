import { Importer } from "../types.js";
import { rssImporter } from "./rss.js";
import { arenaImporter } from "./arena.js";
import { civitaiImporter } from "./civitai.js";
import { shotcafeImporter } from "./shotcafe.js";
import { eagleImporter } from "./eagle.js";
import { raindropImporter } from "./raindrop.js";
import { pinterestApiImporter } from "./pinterest-api.js";
import { pexels } from "./pexels.js";
import { pixabay } from "./pixabay.js";
import { unsplash } from "./unsplash.js";

/**
 * Clean импортёры: публичные API без ограничений
 */
export const cleanImporters: Importer[] = [
  rssImporter,
  arenaImporter,
  civitaiImporter,
  shotcafeImporter,
  eagleImporter,
  raindropImporter,
  pinterestApiImporter,
  pexels,
  pixabay,
  unsplash,
];
