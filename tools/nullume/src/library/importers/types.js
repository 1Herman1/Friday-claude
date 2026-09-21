"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefCandidateSchema = void 0;
var zod_1 = require("zod");
/**
 * Кандидат на добавление в библиотеку: изображение с метаданными
 */
exports.RefCandidateSchema = zod_1.z
    .object({
    /** Прямая ссылка на изображение (https только) */
    url: zod_1.z.string().url().optional(),
    /** Локальный путь к файлу (если скачано) */
    filePath: zod_1.z.string().optional(),
    /** URL страницы источника (где найдено изображение) */
    pageUrl: zod_1.z.string().url().optional(),
    /** Автор/создатель */
    author: zod_1.z.string().optional(),
    /** Лицензия использования */
    license: zod_1.z.string().optional(),
    /** ID источника (например 'unsplash', 'pinterest') */
    source: zod_1.z.string(),
    /** Уникальный ID в источнике */
    sourceRef: zod_1.z.string(),
    /** Дополнительные метаданные */
    meta: zod_1.z.record(zod_1.z.unknown()).default({}),
    /** Палитра цветов с долей */
    palette: zod_1.z.array(zod_1.z.object({
        /** RGB цвет [0-255, 0-255, 0-255] */
        color: zod_1.z.tuple([
            zod_1.z.number().min(0).max(255),
            zod_1.z.number().min(0).max(255),
            zod_1.z.number().min(0).max(255),
        ]),
        /** Доля цвета в изображении [0-1] */
        ratio: zod_1.z.number().min(0).max(1),
    })).optional(),
    /** Теги/ключевые слова */
    tags: zod_1.z.array(zod_1.z.string()).default([]),
})
    .refine(function (data) { return !!(data.url || data.filePath); });
