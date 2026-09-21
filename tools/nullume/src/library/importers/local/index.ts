import { Importer } from "../types.js";
import { pinterestCookiesImporter } from "./pinterest-cookies.js";
import { xCookiesImporter } from "./x-cookies.js";
import { dribbbleImporter } from "./dribbble.js";

/**
 * Local-only импортёры: требуют гейт assertLocalOnlyAllowed()
 * Запускаются только в CLI с явным согласием пользователя
 */
export const localImporters: Importer[] = [
  pinterestCookiesImporter,
  xCookiesImporter,
  dribbbleImporter,
];
