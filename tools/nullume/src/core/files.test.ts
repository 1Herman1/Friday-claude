import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertUploadable } from "./files.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function tmpRoot(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nullume-files-")));
}

test("assertUploadable: png внутри разрешённого корня проходит", async () => {
  const root = tmpRoot();
  try {
    const file = path.join(root, "pic.png");
    fs.writeFileSync(file, PNG);
    const real = await assertUploadable(file, [root]);
    assert.strictEqual(real, file);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("assertUploadable: .env отклоняется как запрещённый шаблон пути", async () => {
  const root = tmpRoot();
  try {
    const file = path.join(root, ".env");
    fs.writeFileSync(file, PNG);
    await assert.rejects(() => assertUploadable(file, [root]), /denied pattern/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("assertUploadable: файл вне разрешённых корней отклоняется", async () => {
  const root = tmpRoot();
  const outside = tmpRoot();
  try {
    const file = path.join(outside, "pic.png");
    fs.writeFileSync(file, PNG);
    await assert.rejects(() => assertUploadable(file, [root]), /not in allowed directories/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("assertUploadable: произвольный текстовый файл отклоняется по magic bytes", async () => {
  const root = tmpRoot();
  try {
    const file = path.join(root, "secret.png");
    fs.writeFileSync(file, "SECRET_TOKEN=abc\n");
    await assert.rejects(() => assertUploadable(file, [root]), /type not allowed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("assertUploadable: несуществующий файл отклоняется", async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(() => assertUploadable(path.join(root, "nope.png"), [root]));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test(
  "assertUploadable: симлинк из разрешённого корня на файл снаружи должен отклоняться",
    async () => {
    const root = tmpRoot();
    const outside = tmpRoot();
    try {
      const target = path.join(outside, "private.png");
      fs.writeFileSync(target, PNG);
      const link = path.join(root, "link.png");
      fs.symlinkSync(target, link);
      await assert.rejects(() => assertUploadable(link, [root]), /not in allowed directories/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  }
);
