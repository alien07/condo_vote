"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";

type FeedbackTone = "success" | "error" | "warning" | "info";

const toneConfig: Record<
  FeedbackTone,
  {
    icon: typeof CheckCircle2;
    live: "assertive" | "polite";
    style: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    live: "polite",
    style: "border-green-200 bg-green-50 text-green-800",
  },
  error: {
    icon: XCircle,
    live: "assertive",
    style: "border-red-200 bg-red-50 text-red-700",
  },
  warning: {
    icon: TriangleAlert,
    live: "assertive",
    style: "border-amber-200 bg-amber-50 text-amber-800",
  },
  info: {
    icon: Info,
    live: "polite",
    style: "border-sky-200 bg-sky-50 text-sky-800",
  },
};

function parseTone(value: string | null): FeedbackTone | null {
  if (
    value === "success" ||
    value === "error" ||
    value === "warning" ||
    value === "info"
  ) {
    return value;
  }

  return null;
}

function parseMessage(value: string | null) {
  const text = (value ?? "").trim();

  if (!text) {
    return null;
  }

  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

export function AppFeedbackBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tone = parseTone(searchParams.get("feedback"));
  const message = parseMessage(searchParams.get("message"));
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const bannerKey = `${tone ?? ""}:${message ?? ""}`;
  const config = tone ? toneConfig[tone] : null;
  const Icon = config?.icon;
  const closeHref = useMemo(() => {
    const params = new URLSearchParams(searchParams);

    params.delete("feedback");
    params.delete("message");

    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!tone || !message || tone === "error" || tone === "warning") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDismissedKey(bannerKey);
      router.replace(closeHref, { scroll: false });
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [bannerKey, closeHref, message, router, tone]);

  if (!tone || !message || !config || !Icon || dismissedKey === bannerKey) {
    return null;
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 md:px-6">
      <div
        aria-live={config.live}
        className={[
          "mx-auto flex max-w-6xl items-start gap-3 rounded-md border px-3 py-2 text-sm",
          config.style,
        ].join(" ")}
        role={tone === "error" || tone === "warning" ? "alert" : "status"}
      >
        <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        <p className="min-w-0 flex-1">{message}</p>
        <button
          aria-label="Dismiss message"
          className="shrink-0 rounded p-1 hover:bg-black/5"
          onClick={() => {
            setDismissedKey(bannerKey);
            router.replace(closeHref, { scroll: false });
          }}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
