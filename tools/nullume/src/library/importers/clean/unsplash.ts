import { RateLimiter } from "../../../core/net.js";
import { getImporterSetting } from "../../../core/config.js";
import { ConfigError, ProviderError, UsageError } from "../../../core/errors.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface UnsplashTag {
  title: string;
  type?: string;
}

interface UnsplashUser {
  id: string;
  username: string;
  name: string;
  first_name: string;
  last_name?: string;
  email?: string;
  portfolio_url?: string;
  bio?: string;
  location?: string;
  total_likes?: number;
  total_photos?: number;
  total_collections?: number;
  instagram_username?: string;
  twitter_username?: string;
  links?: {
    self?: string;
    html?: string;
    photos?: string;
    likes?: string;
    portfolio?: string;
    following?: string;
    followers?: string;
  };
}

interface UnsplashPhoto {
  id: string;
  created_at: string;
  updated_at: string;
  width: number;
  height: number;
  color: string;
  blur_hash?: string;
  description?: string;
  alt_description?: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    self: string;
    html: string;
    download: string;
    download_location: string;
  };
  likes: number;
  liked_by_user?: boolean;
  current_user_collections?: Array<unknown>;
  sponsorship?: {
    impression_urls: string[];
    tagline: string;
    tagline_url: string;
  };
  topic_submissions?: Record<string, unknown>;
  user: UnsplashUser;
  tags?: UnsplashTag[];
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

const unsplashLimiter = new RateLimiter(50, 60 * 60 * 1000); // 50 requests per hour

export const unsplash: Importer = {
  id: "unsplash",
  kind: "clean",
  supportsQuery: true,
  title: "Unsplash",
  description:
    "Бесплатная стоковая фотография от сообщества Unsplash. " +
    "Требует Access Key. Получить на https://unsplash.com/oauth/applications",

  async configure(config, env) {
    const key = getImporterSetting(config, "unsplash", "key", "UNSPLASH_ACCESS_KEY");
    if (!key) {
      throw new ConfigError(
        "Access Key Unsplash не найден. " +
        "Получи на https://unsplash.com/oauth/applications и установи UNSPLASH_ACCESS_KEY или " +
        "добавь в ~/.nullume/config.json: { \"importers\": { \"unsplash\": { \"key\": \"YOUR_KEY\" } } }"
      );
    }
  },

  async *run(opts: ImportRunOptions) {
    const { query, limit, fetchImpl, signal, log, config } = opts;

    if (!query) {
      throw new UsageError("Unsplash требует --query для поиска фотографий");
    }

    const key = getImporterSetting(config, "unsplash", "key", "UNSPLASH_ACCESS_KEY");
    if (!key) {
      throw new ConfigError("Access Key Unsplash не найден");
    }

    let page = 1;
    let collected = 0;
    const perPage = 30;

    while (collected < limit) {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

      try {
        const response = await importerFetchJson<UnsplashSearchResponse>(url, {
          fetchImpl,
          limiter: unsplashLimiter,
          headers: {
            Authorization: `Client-ID ${key}`,
            "Accept-Version": "v1",
          },
        });

        if (!response.results || response.results.length === 0) {
          break;
        }

        for (const photo of response.results) {
          if (collected >= limit) break;

          try {
            const candidate: RefCandidate = {
              url: photo.urls.regular,
              pageUrl: photo.links.html,
              author: photo.user.name,
              license: "Unsplash License",
              source: "unsplash",
              sourceRef: photo.id,
              tags: (photo.tags || []).map((t) => t.title),
              meta: {
                downloadLocation: photo.links.download_location,
                color: photo.color,
                description: photo.description,
                width: photo.width,
                height: photo.height,
              },
            };

            yield candidate;
            collected++;
          } catch (e) {
            log(`Ошибка при обработке фото ${photo.id}: ${(e as Error).message}`);
          }
        }

        if (response.results.length < perPage) {
          break;
        }

        page++;
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.includes("HTTP 401") || e.message.includes("HTTP 403")) {
            throw new ProviderError(`Ошибка аутентификации Unsplash: неверный Access Key или доступ запрещён`);
          }
          if (e.message.includes("HTTP 429")) {
            throw new ProviderError(`Лимит запросов Unsplash (50/час) превышен. Повтори через час.`);
          }
        }
        throw e;
      }
    }
  },
};
