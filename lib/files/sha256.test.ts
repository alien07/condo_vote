import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex, sha256HexSync } from "@/lib/files/sha256";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("sha256", () => {
  it("matches the known values", () => {
    expect(sha256HexSync(bytes(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256HexSync(bytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches node crypto across block boundaries", () => {
    for (const length of [55, 56, 63, 64, 65, 1000]) {
      const input = new Uint8Array(length).map((_, index) => (index * 31) % 256);

      expect(sha256HexSync(input)).toBe(createHash("sha256").update(input).digest("hex"));
    }
  });

  it("gives the same answer through crypto.subtle", async () => {
    const input = bytes("condoVotes document");

    expect(await sha256Hex(input.buffer as ArrayBuffer)).toBe(sha256HexSync(input));
  });
});
