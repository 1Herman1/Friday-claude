import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCookieFile,
  redactSession,
  SessionFileSchema,
} from "./sessions.js";

test("parseCookieFile: формат Netscape cookies.txt", () => {
  const text = `#HttpOnly_.pinterest.com	TRUE	/	TRUE	1735689600	auth_token	my_token_value
.pinterest.com	TRUE	/	FALSE	0	c_user	12345
`;

  const cookies = parseCookieFile(text);
  assert.deepEqual(cookies, {
    auth_token: "my_token_value",
    c_user: "12345",
  });
});

test("parseCookieFile: простой формат k=v; k2=v2", () => {
  const text = `
auth_token=my_token_value; c_user=12345; extra=data
name2=value2
`;

  const cookies = parseCookieFile(text);
  assert.ok(cookies.auth_token === "my_token_value");
  assert.ok(cookies.c_user === "12345");
  assert.ok(cookies.extra === "data");
  assert.ok(cookies.name2 === "value2");
});

test("redactSession: заменить значения на ***", () => {
  const session = {
    cookies: { auth_token: "secret123", c_user: "12345" },
    token: "bearer_token_secret",
    createdAt: "2026-09-21T10:00:00Z",
    note: "test session",
  };

  const redacted = redactSession(session);

  assert.deepEqual(redacted.cookies, {
    auth_token: "***",
    c_user: "***",
  });
  assert.equal(redacted.token, "***");
  assert.equal(redacted.createdAt, "2026-09-21T10:00:00Z");
  assert.equal(redacted.note, "test session");
});


test("SessionFileSchema валидация", () => {
  const valid = {
    cookies: { token: "123" },
    createdAt: "2026-09-21T00:00:00Z",
  };

  const result = SessionFileSchema.safeParse(valid);
  assert.ok(result.success);

  const invalid = {
    createdAt: "not a date",
  };

  const result2 = SessionFileSchema.safeParse(invalid);
  assert.ok(!result2.success);
});
