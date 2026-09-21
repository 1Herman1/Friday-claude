import { z } from "zod";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "../gate.js";
import { readSession } from "../../sessions.js";
import { UsageError, ProviderError } from "../../../core/errors.js";
import { sleep } from "../http.js";
import { getPackageDataDir } from "../../../core/paths.js";
import fs from "node:fs";
import path from "node:path";

type XCollection = "bookmarks" | "likes";

/**
 * Схема для хранения GraphQL operationId
 */
const XGraphQLConfigSchema = z.object({
  Bookmarks: z.string(),
  Likes: z.string(),
});

type XGraphQLConfig = z.infer<typeof XGraphQLConfigSchema>;

/**
 * Базовая схема ответа X GraphQL (упрощённая)
 */
const XGraphQLResponseSchema = z.object({
  data: z
    .object({
      user: z
        .object({
          result: z
            .object({
              timeline_v2: z
                .object({
                  timeline: z
                    .object({
                      instructions: z.array(
                        z.object({
                          entries: z
                            .array(
                              z.object({
                                content: z
                                  .object({
                                    entryType: z.string(),
                                    itemContent: z
                                      .object({
                                        tweet_results: z
                                          .object({
                                            result: z
                                              .object({
                                                legacy: z.object({
                                                  id_str: z.string(),
                                                  screen_name: z.string().optional(),
                                                  user: z
                                                    .object({
                                                      screen_name: z.string().optional(),
                                                    })
                                                    .optional(),
                                                  extended_entities: z
                                                    .object({
                                                      media: z
                                                        .array(
                                                          z.object({
                                                            type: z.string(),
                                                            media_url_https: z.string().optional(),
                                                          })
                                                        )
                                                        .optional(),
                                                    })
                                                    .optional(),
                                                }),
                                              })
                                              .optional(),
                                          })
                                          .optional(),
                                      })
                                      .optional(),
                                  })
                                  .optional(),
                              })
                            )
                            .optional(),
                        })
                      ),
                    })
                    .optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * X импортёр через закладки/лайки
 */
export const xCookiesImporter: Importer = {
  id: "x-cookies",
  kind: "local-only",
  title: "X (закладки и лайки)",
  description: `Импорт закладок и лайков из X (Twitter).
Требует: ~/.nullume/sessions/x.json с auth_token cookie и acknowledgedRiskyImporters=true`,

  async configure(config, env) {
    assertLocalOnlyAllowed(config, env);

    // Попытаться прочитать сессию
    try {
      await readSession("x");
    } catch (e) {
      throw new UsageError(
        `X сессия не найдена.\n` +
          `Создайте ~/.nullume/sessions/x.json с cookies:

{
  "cookies": {
    "auth_token": "<your_auth_token>"
  },
  "createdAt": "2026-09-21T00:00:00Z",
  "note": "Получите auth_token из DevTools"
}

Получение ct0 токена:
1. Откройте DevTools
2. Выполните в консоли: document.cookie.split('; ').find(c => c.startsWith('ct0=')).split('=')[1]\n${LOCAL_ONLY_WARNING}`
      );
    }
  },

  async *run(opts) {
    assertLocalOnlyAllowed(opts.config, opts.env);
    opts.log("LOCAL_ONLY_WARNING: X API платный ($0.005 за запрос)");

    const collection: XCollection = (opts.collection as XCollection) || "bookmarks";
    if (collection !== "bookmarks" && collection !== "likes") {
      throw new UsageError(
        `Неизвестная коллекция: ${collection}. ` +
        `Используйте 'bookmarks' или 'likes'`
      );
    }

    const session = await readSession("x");

    if (!session.cookies || !session.cookies.auth_token) {
      throw new UsageError(
        `X сессия не содержит auth_token. ` +
        `Обновите ~/.nullume/sessions/x.json`
      );
    }

    // Загрузить GraphQL operationId из data/x-graphql.json
    let graphqlConfig: XGraphQLConfig;
    try {
      const configPath = path.join(getPackageDataDir(), "x-graphql.json");
      const configContent = await fs.promises.readFile(configPath, "utf-8");
      const parsed = JSON.parse(configContent);
      graphqlConfig = XGraphQLConfigSchema.parse(parsed);

      if (!graphqlConfig[collection === "bookmarks" ? "Bookmarks" : "Likes"]) {
        throw new UsageError(
          `GraphQL operationId для ${collection} не задана в data/x-graphql.json. ` +
          `Найдите operationId в DevTools (Network → GraphQL запросы) и обновите файл.`
        );
      }
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new UsageError(
        `Не удалось загрузить data/x-graphql.json: ${(e as Error).message}. ` +
        `Обновите GraphQL operationId в файле.`
      );
    }

    const operationId = graphqlConfig[collection === "bookmarks" ? "Bookmarks" : "Likes"];
    const fetchImpl = opts.fetchImpl ?? fetch;
    let cursor = undefined;
    let pageNum = 0;
    let candidateCount = 0;

    opts.log(`X_QUERY_START collection="${collection}"`);

    while (true) {
      if (pageNum > 0) {
        const delay = opts.env.NULLUME_NO_DELAY === "1" ? 0 : 1500;
        if (delay > 0) await sleep(delay);
      }

      opts.log(`X_QUERY collection="${collection}" page=${pageNum + 1} cost=$0.005`);

      // Построить GraphQL запрос
      const variables = {
        count: 100,
        cursor,
        includePromotedContent: false,
      };

      const payload = {
        operationId,
        variables,
        features: {},
      };

      // Выполнить запрос
      const resp = await fetchImpl("https://x.com/i/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: Object.entries(session.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; "),
          "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWiKaBjejBBDXtg",
        },
        body: JSON.stringify(payload),
      });

      // Обработить статусы
      if (resp.status === 403 || resp.status === 429) {
        throw new ProviderError(
          `X ограничил доступ (${resp.status}). Подожди и повтори; продолжение грозит блокировкой аккаунта.`,
          resp.status
        );
      }

      if (!resp.ok) {
        throw new ProviderError(`HTTP ${resp.status} при запросе к X`, resp.status);
      }

      // Распарсить ответ
      let data: any;
      try {
        data = await resp.json();
      } catch (e) {
        throw new ProviderError(`Не удалось распарсить ответ X: ${(e as Error).message}`);
      }

      // Валидировать (базовая проверка)
      try {
        data = XGraphQLResponseSchema.parse(data);
      } catch (e) {
        throw new ProviderError(`Формат ответа X изменился: ${(e as Error).message}`);
      }

      // Обработать твиты
      const instructions = data.data?.user?.result?.timeline_v2?.timeline?.instructions ?? [];
      let tweetsCount = 0;

      for (const instruction of instructions) {
        const entries = instruction.entries || [];
        for (const entry of entries) {
          if (opts.signal?.aborted) break;

          const tweet = entry.content?.itemContent?.tweet_results?.result?.legacy;
          if (!tweet) continue;

          tweetsCount++;

          // Найти медиа
          const media = tweet.extended_entities?.media ?? [];

          for (let idx = 0; idx < media.length; idx++) {
            const m = media[idx];

            // Только фотографии
            if (m.type !== "photo" && m.type !== "animated_gif") continue;

            if (!m.media_url_https) continue;

            const imageUrl = m.media_url_https;
            if (m.type === "photo") {
              // Добавить ?name=large для photo
              const urlWithSize = !imageUrl.includes("?") ? `${imageUrl}?name=large` : imageUrl;

              const candidate: RefCandidate = {
                url: urlWithSize,
                pageUrl: `https://x.com/${tweet.user?.screen_name || tweet.screen_name}/status/${tweet.id_str}`,
                author: tweet.user?.screen_name || tweet.screen_name,
                license: "x-public",
                source: "x-cookies",
                sourceRef: `${tweet.id_str}:${idx}`,
                meta: {},
                tags: [],
              };

              yield candidate;
              candidateCount++;

              if (opts.limit > 0 && candidateCount >= opts.limit) {
                opts.log(`X_LIMIT_REACHED limit=${opts.limit}`);
                return;
              }
            }
          }
        }
      }

      if (tweetsCount === 0) {
        opts.log(`X_DONE collection="${collection}" total=0`);
        break;
      }

      // Пагинация через cursor (если поддерживается)
      // Для упрощения: в этой версии одна страница
      break;
    }
  },
};
