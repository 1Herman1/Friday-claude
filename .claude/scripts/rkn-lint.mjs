#!/usr/bin/env node
// Детерминированный детектор нарушений правовой обвязки (152-ФЗ, 149-ФЗ, реклама).
// Без LLM, без внешних зависимостей. Образец — design-lint.mjs.
//
// Три слоя проверок, потому что построчного мало: половина РКН-находок —
// это ОТСУТСТВИЕ чего-либо в файле или во всём проекте.
//   RULES      — построчные
//   FILE_RULES — на содержимое одного файла целиком
//   REPO_RULES — на весь набор файлов
//
// Что этот скрипт НЕ проверяет: техническую безопасность (CORS, заголовки,
// rate limit, инъекции) — это зона security-* агентов.
import fs from "node:fs";
import path from "node:path";
import { codeRoots } from "./lib/projects.mjs";

const CODE = [".tsx", ".ts", ".jsx", ".astro", ".html"];

// ---------------------------------------------------------------- построчные

const RULES = [
  {
    name: "pd-consent-implied",
    ext: [".tsx", ".jsx", ".astro", ".html"],
    test: /(соглаша[а-яё]*|да[её]т[а-яё]* согласие)[^<]{0,120}(обработк|персональн)/i,
    hint: "подразумеваемое согласие на обработку ПД — нужно отдельное активное действие пользователя",
    level: "ERROR",
  },
  {
    name: "consent-glued-to-offer",
    ext: [".tsx", ".jsx", ".astro", ".html"],
    // Если в строке уже есть «обработка/персональные», её ловит pd-consent-implied
    // уровнем выше — не дублируем находку.
    test: (line) =>
      /(Нажимая|Продолжая|Оформляя заказ|Регистрируясь)[^<]{0,80}соглаша/i.test(line) &&
      !/обработк|персональн/i.test(line),
    hint: "согласие склеено с офертой — согласие на ПД оформляется отдельным документом и отдельной галочкой",
    level: "WARNING",
  },
  {
    name: "analytics-no-consent",
    ext: CODE,
    test: /mc\.yandex|metrika\.yandex|\bym\(|\bgtag\(|googletagmanager|\b_tmr\b|VK\.Retargeting|\bfbq\(|top-?mail-?ru/,
    hint: "счётчик аналитики: запускать только после согласия и описать в политике",
    level: "ERROR",
  },
  {
    name: "foreign-cdn-asset",
    ext: CODE,
    test: /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/,
    hint: "зарубежный CDN передаёт IP посетителя за рубеж — хостить локально",
    level: "ERROR",
  },
  {
    name: "foreign-pd-processor",
    ext: [".ts", ".tsx", ".jsx"],
    test: /sendgrid|mailgun|\btwilio\b|firebase|amplitude|hotjar|mixpanel|posthog|supabase|vercel\.app/i,
    hint: "зарубежный обработчик ПД — трансграничная передача, нужно отдельное уведомление РКН",
    level: "ERROR",
  },
  {
    name: "pd-in-logs",
    ext: [".ts", ".tsx", ".jsx"],
    test: /console\.(log|info|warn)\([^)]*(phone|email|password|otp|passport|address)/i,
    hint: "персональные данные в логах — логи становятся местом обработки ПД, маскировать",
    level: "ERROR",
  },
  {
    name: "pd-in-localstorage",
    ext: [".ts", ".tsx", ".jsx"],
    test: /localStorage\.setItem\([^)]*(phone|email|\bname\b|address|fio|passport)/i,
    hint: "ПД в localStorage — хранение вне контура оператора, без срока удаления",
    level: "WARNING",
  },
  {
    name: "prechecked-consent",
    ext: [".tsx", ".jsx", ".astro"],
    // Транзакционные уведомления (статус заказа) предустановленными быть могут —
    // они часть исполнения договора. Ловим только правовые галочки по ключевым
    // словам, иначе правило завалит служебные чекбоксы админки.
    test: (line) =>
      /(defaultChecked|checked)\s*[:=]\s*\{?true\}?/.test(line) &&
      /соглас|персональн|рассылк|реклам|оферт|политик/i.test(line),
    hint: "преотмеченный чекбокс согласия недопустим — согласие даётся активным действием",
    level: "ERROR",
  },
  {
    name: "marketing-in-pd-consent",
    ext: [".tsx", ".jsx", ".astro"],
    test: (line) =>
      /соглас/i.test(line) &&
      /рассылк|реклам|промо|акци/i.test(line) &&
      /обработк|персональн/i.test(line),
    hint: "согласие на рекламу нельзя объединять с согласием на обработку ПД — две отдельные галочки",
    level: "ERROR",
  },
  {
    name: "ad-without-erid",
    ext: [".tsx", ".jsx", ".astro"],
    test: (line) =>
      /баннер|banner|promoBlock|реклам/i.test(line) && /href=["']https?:\/\//.test(line),
    hint: "внешний рекламный блок: нужны пометка «Реклама», сведения о рекламодателе и идентификатор erid",
    level: "WARNING",
  },
  {
    name: "biometry-upload",
    ext: [".tsx", ".jsx", ".astro"],
    test: (line) =>
      /accept=["']image\//.test(line) && /selfie|face|passport|паспорт/i.test(line),
    hint: "биометрия или скан документа — отдельное согласие и повышенные требования к хранению",
    level: "ERROR",
  },
];

// ------------------------------------------------------------------ файловые

const FILE_RULES = [
  {
    name: "form-without-policy-link",
    ext: [".tsx", ".jsx", ".astro", ".html"],
    test: (content) =>
      /type=["'](tel|email)["']|name=["'](phone|email|fio)["']/.test(content) &&
      !/privacy|политик|персональн/i.test(content),
    hint: "форма собирает ПД, но рядом нет ссылки на политику обработки",
    level: "ERROR",
  },
  {
    name: "privacy-missing-required-block",
    ext: [".tsx", ".jsx", ".astro", ".html"],
    only: /Privacy/i,
    test: (content) =>
      !/152-ФЗ/i.test(content) ||
      !/Роскомнадзор/i.test(content) ||
      !/цел[ьияей]|для каких целей|зачем мы/i.test(content) ||
      !/срок|в течение \d+\s*(дн|месяц|год)/i.test(content) ||
      !/отзыв[а-яё]*\s+соглас|отозв[а-яё]*\s+соглас/i.test(content),
    hint: "в политике не хватает обязательного блока: цели, сроки хранения, отзыв согласия или порядок жалобы в РКН",
    level: "WARNING",
  },
];

// ------------------------------------------------------------- репо-уровневые

const REPO_RULES = [
  {
    name: "no-consent-component",
    test: (files) => {
      const hasBanner = files.some((f) =>
        /CookieBanner|ConsentBanner|cookie-consent|согласие на cookie/i.test(f.content)
      );
      if (hasBanner) return false;
      const usesCookieOrAnalytics = files.some(
        (f) =>
          /mc\.yandex|googletagmanager|\bgtag\(|\b_tmr\b/.test(f.content) ||
          /файлы cookie|используем cookie|использует cookie/i.test(f.content)
      );
      return usesCookieOrAnalytics;
    },
    hint: "заявлено использование cookie или аналитики, но механизма согласия нет",
    level: "ERROR",
  },
  {
    name: "no-pd-deletion-path",
    test: (files) =>
      !files.some((f) =>
        /deleteAccount|account\/delete|anonymize|обезлич|удалить аккаунт/i.test(f.content)
      ),
    hint: "нет реализованного удаления или обезличивания данных по запросу субъекта",
    level: "WARNING",
  },
];

// ----------------------------------------------------------------- сбор файлов

// Корни и точки входа выводятся из реестра проектов. Прежний жёсткий список
// приходилось дописывать руками при каждом новом проекте — а забытая строка
// означала, что правовые проверки по нему просто не запускались.
const ROOTS = codeRoots();

const EXTRA_FILES = ROOTS.flatMap((r) => [
  path.join(r, "index.html"),
  path.join(r, "client", "index.html"),
]).filter((f) => fs.existsSync(f));

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".astro", ".git"]);

function walkDir(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...walkDir(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectFiles(args) {
  if (args.length > 0) return args.filter((f) => fs.existsSync(f));

  const files = new Set();
  for (const root of ROOTS) for (const f of walkDir(root, CODE)) files.add(f);
  for (const f of EXTRA_FILES) if (fs.existsSync(f)) files.add(f);
  return [...files];
}

function extOf(filePath) {
  return CODE.find((e) => filePath.endsWith(e)) || path.extname(filePath);
}

function applies(rule, filePath) {
  if (rule.ext && !rule.ext.includes(extOf(filePath))) return false;
  if (rule.only && !rule.only.test(path.basename(filePath))) return false;
  return true;
}

function run(rule, value) {
  return typeof rule.test === "function" ? rule.test(value) : rule.test.test(value);
}

function main() {
  const args = process.argv.slice(2);
  const partial = args.length > 0;
  const paths = collectFiles(args);

  const findings = [];
  const loaded = [];

  for (const filePath of paths) {
    let content;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    loaded.push({ path: filePath, content });

    content.split("\n").forEach((line, idx) => {
      for (const rule of RULES) {
        if (!applies(rule, filePath)) continue;
        if (run(rule, line)) {
          findings.push({ file: filePath, line: idx + 1, hint: rule.hint, level: rule.level });
        }
      }
    });

    for (const rule of FILE_RULES) {
      if (!applies(rule, filePath)) continue;
      if (rule.test(content, filePath)) {
        findings.push({ file: filePath, line: 1, hint: rule.hint, level: rule.level });
      }
    }
  }

  // Репо-правила осмысленны только на полном проходе: при разборе одного файла
  // «нигде нет X» ничего не значит.
  if (!partial) {
    for (const rule of REPO_RULES) {
      if (rule.test(loaded)) {
        findings.push({ file: "<репозиторий>", line: 0, hint: rule.hint, level: rule.level });
      }
    }
  }

  const filesWithFindings = new Set();
  for (const f of findings) {
    console.log(`${f.file}:${f.line} — ${f.hint} [${f.level}]`);
    filesWithFindings.add(f.file);
  }

  console.log("");
  if (findings.length === 0) {
    console.log("Проблем не обнаружено.");
  } else {
    console.log(`${findings.length} проблем в ${filesWithFindings.size} файлах`);
    console.log("");
    console.log("Это инженерный чек-лист, а не юридическое заключение.");
    console.log("Полный контекст: docs/core/rkn-compliance.md");
  }

  process.exit(0);
}

main();
