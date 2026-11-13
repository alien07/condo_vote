import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mockTranslate,
  NO_DEMO_TRANSLATION,
  translateToEnglish,
  translationProvider,
  withGlossary,
} from "@/lib/translation";

describe("translation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the demo provider without an Azure key", () => {
    vi.stubEnv("TRANSLATION_PROVIDER", "");
    vi.stubEnv("AZURE_TRANSLATOR_KEY", "");
    expect(translationProvider()).toBe("mock");
  });

  it("answers demo text and marks unknown text for the admin", async () => {
    expect(mockTranslate("เห็นด้วย")).toBe("Approve");
    expect(mockTranslate("ข้อความใหม่")).toBe(`${NO_DEMO_TRANSLATION} ข้อความใหม่`);
    expect(await translateToEnglish(["งบการเงิน", ""])).toEqual(["Financial statements", ""]);
  });

  it("marks glossary terms for Azure's dictionary", () => {
    expect(withGlossary("แก้ไขข้อบังคับนิติบุคคลอาคารชุด")).toContain(
      '<mstrans:dictionary translation="condominium by-laws">ข้อบังคับนิติบุคคลอาคารชุด</mstrans:dictionary>',
    );
  });
});
