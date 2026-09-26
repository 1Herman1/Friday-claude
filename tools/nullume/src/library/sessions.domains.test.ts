import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseCookieFileForDomains, writeSession, readSession } from "./sessions.js";

// Выгрузка cookies.txt из браузера: сессии всех сайтов владельца в одном файле
const BROWSER_EXPORT = [
  "# Netscape HTTP Cookie File",
  ".pinterest.com\tTRUE\t/\tTRUE\t1893456000\t_pinterest_sess\tpin_sess",
  "#HttpOnly_www.pinterest.com\tFALSE\t/\tTRUE\t1893456000\tcsrftoken\tpin_csrf",
  ".mybank.ru\tTRUE\t/\tTRUE\t1893456000\tsession_id\tbank_sess",
  "github.com\tFALSE\t/\tTRUE\t1893456000\tuser_session\tgh_sess",
  // Домен-обманка: оканчивается на pinterest.com, но не вложен в него
  "evilpinterest.com\tFALSE\t/\tTRUE\t1893456000\tcsrftoken\tfake_csrf",
].join("\n");

test("parseCookieFileForDomains: из выгрузки браузера остаются только cookie нужного домена", () => {
  const { cookies, dropped } = parseCookieFileForDomains(BROWSER_EXPORT, ["pinterest.com"]);
  assert.deepEqual(cookies, { _pinterest_sess: "pin_sess", csrftoken: "pin_csrf" });
  assert.equal(dropped, 3);
});

test("parseCookieFileForDomains: домен-обманка не подменяет csrftoken", () => {
  const { cookies } = parseCookieFileForDomains(BROWSER_EXPORT, ["pinterest.com"]);
  assert.equal(cookies.csrftoken, "pin_csrf");
});

test("parseCookieFileForDomains: строка name=value принимается целиком", () => {
  const { cookies, dropped } = parseCookieFileForDomains("_pinterest_sess=abc; csrftoken=def", ["pinterest.com"]);
  assert.deepEqual(cookies, { _pinterest_sess: "abc", csrftoken: "def" });
  assert.equal(dropped, 0);
});

test("writeSession: файл с cookie читает только владелец (0600)", async () => {
  const old = process.env.NULLUME_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-sess-"));
  process.env.NULLUME_HOME = home;
  try {
    await writeSession("pinterest-cookies", {
      cookies: { _pinterest_sess: "secret" },
      createdAt: new Date().toISOString(),
    });
    const file = path.join(home, "sessions", "pinterest-cookies.json");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal((await readSession("pinterest-cookies")).cookies?._pinterest_sess, "secret");
  } finally {
    if (old === undefined) delete process.env.NULLUME_HOME;
    else process.env.NULLUME_HOME = old;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
