import { test } from "node:test";
import assert from "node:assert";
import {
  NullumeError,
  UsageError,
  ConfigError,
  ProviderError,
  TaskNotFound,
  NetworkError,
} from "./errors.js";

test("NullumeError has default exitCode", () => {
  const err = new NullumeError("test", 1);
  assert.strictEqual(err.exitCode, 1);
  assert.strictEqual(err.message, "test");
});

test("UsageError has exitCode 2", () => {
  const err = new UsageError("usage");
  assert.strictEqual(err.exitCode, 2);
});

test("ConfigError has exitCode 1", () => {
  const err = new ConfigError("config");
  assert.strictEqual(err.exitCode, 1);
});

test("ProviderError stores code", () => {
  const err = new ProviderError("msg", 401);
  assert.strictEqual(err.code, 401);
});

test("TaskNotFound is a ProviderError", () => {
  const err = new TaskNotFound("task");
  assert(err instanceof ProviderError);
  assert.strictEqual(err.name, "TaskNotFound");
});
