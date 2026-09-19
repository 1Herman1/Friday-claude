import { test } from "node:test";
import assert from "node:assert";
import { extractInputSchema, deriveModelMeta } from "./schema.js";

test("extractInputSchema parses basic schema", () => {
  const markdown = `
    input:
      properties:
        prompt:
          type: string
          description: "The prompt"
        aspect_ratio:
          type: string
          enum:
            - "1:1"
            - "2:3"
      required:
        - prompt
`;
  const fields = extractInputSchema(markdown);
  assert.strictEqual(fields.length, 2);
  assert.strictEqual(fields[0].name, "prompt");
  assert.strictEqual(fields[0].type, "string");
  assert.strictEqual(fields[0].required, true);
  assert.strictEqual(fields[1].name, "aspect_ratio");
  assert.deepStrictEqual(fields[1].enum, ["1:1", "2:3"]);
});

test("deriveModelMeta identifies promptField", () => {
  const fields = [
    {
      name: "prompt",
      type: "string",
      required: true,
      description: null,
      enum: [],
      default: null,
      constraints: {},
    },
  ];
  const meta = deriveModelMeta(fields);
  assert.strictEqual(meta.promptField, "prompt");
  assert(meta.required.includes("prompt"));
});

test("deriveModelMeta identifies imageField", () => {
  const fields = [
    {
      name: "image_urls",
      type: "array",
      required: true,
      description: null,
      enum: [],
      default: null,
      constraints: { items: "string" },
    },
  ];
  const meta = deriveModelMeta(fields);
  assert.strictEqual(meta.imageField, "image_urls");
  assert.strictEqual(meta.imageList, true);
});

test("deriveModelMeta handles defaults", () => {
  const fields = [
    {
      name: "aspect_ratio",
      type: "string",
      required: true,
      description: null,
      enum: [],
      default: "1:1",
      constraints: {},
    },
  ];
  const meta = deriveModelMeta(fields);
  assert.strictEqual(meta.defaults.aspect_ratio, "1:1");
});
