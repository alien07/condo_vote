import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script without type declarations
import { buildSchemaDoc, schemaDocPath } from "../../scripts/gen-schema-doc.mjs";

describe("docs/schema.md", () => {
  it("matches the database types (run `npm run docs:schema` if this fails)", () => {
    const current = readFileSync(schemaDocPath, "utf8").replace(/\r\n/g, "\n");

    expect(current).toBe(buildSchemaDoc());
  });
});
