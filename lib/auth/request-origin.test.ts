import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestOrigin } from "@/lib/auth/request-origin";

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("getRequestOrigin", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps a phone on the LAN address it used", () => {
    expect(
      getRequestOrigin(headers({ host: "192.168.1.79:3000" }), "http://localhost:3000/auth/callback"),
    ).toBe("http://192.168.1.79:3000");
  });

  it("does not follow a public host header when running locally", () => {
    expect(
      getRequestOrigin(headers({ host: "evil.example.com" }), "http://localhost:3000/auth/callback"),
    ).toBe("http://localhost:3000");
  });

  it("never returns 0.0.0.0", () => {
    expect(
      getRequestOrigin(headers({ host: "0.0.0.0:3000" }), "http://localhost:3000/x"),
    ).toBe("http://localhost:3000");
  });

  it("trusts the configured site behind a proxy", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vote.example.com");
    expect(
      getRequestOrigin(
        headers({ "x-forwarded-host": "vote.example.com", "x-forwarded-proto": "https" }),
        "http://localhost:3000/auth/callback",
      ),
    ).toBe("https://vote.example.com");
  });

  it("ignores LAN hosts on a hosted deployment", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    expect(
      getRequestOrigin(headers({ host: "192.168.1.5:3000" }), "https://vote.example.com/auth/callback"),
    ).toBe("https://vote.example.com");
  });
});
