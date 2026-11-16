"use client";

import { useStaffText } from "@/lib/i18n/staff/client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

type AdminCrudDrawerProps = {
  children: React.ReactNode;
  closeHref: string;
  lockScroll?: boolean;
  summary?: string[];
  title: string;
};

// Wide or normal drawer, remembered in this browser for every drawer
// (2026-11-17). Storage can be missing or blocked; the drawer then stays
// normal width and the button still works for this page.
const WIDE_KEY = "condovotes.drawer.wide";
const WIDE_EVENT = "condovotes:drawer-wide";
let wideFallback = false;

function readWide() {
  try {
    return window.localStorage.getItem(WIDE_KEY) === "1";
  } catch {
    return wideFallback;
  }
}

function writeWide(value: boolean) {
  wideFallback = value;

  try {
    window.localStorage.setItem(WIDE_KEY, value ? "1" : "0");
  } catch {
    // Keep the in-memory value only.
  }

  window.dispatchEvent(new Event(WIDE_EVENT));
}

function subscribeWide(onChange: () => void) {
  window.addEventListener(WIDE_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(WIDE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function AdminCrudDrawer({
  children,
  closeHref,
  lockScroll = true,
  summary,
  title,
}: AdminCrudDrawerProps) {
  const { s } = useStaffText();
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);

  useEffect(() => {
    if (!lockScroll) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [lockScroll]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end overflow-hidden bg-black/10">
      <aside
        aria-label={title}
        className={[
          "flex h-full w-full max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl transition-[max-width] duration-200 motion-reduce:transition-none",
          // Wide keeps a strip of the page visible, so it is still clear
          // which list the drawer belongs to.
          wide ? "sm:max-w-[90vw]" : "sm:max-w-xl",
        ].join(" ")}
        role="complementary"
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {summary?.length ? (
                <dl className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                  {summary.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </dl>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Phones already show the drawer full width. */}
              <button
                aria-label={wide ? s.common.shrinkDrawer : s.common.expandDrawer}
                aria-pressed={wide}
                className="hidden rounded-md border border-[var(--border)] p-2 sm:inline-flex"
                onClick={() => writeWide(!wide)}
                title={wide ? s.common.shrinkDrawer : s.common.expandDrawer}
                type="button"
              >
                {wide ? <Minimize2 aria-hidden="true" size={18} /> : <Maximize2 aria-hidden="true" size={18} />}
              </button>
              <Link
                aria-label={s.common.closeDrawer}
                className="rounded-md border border-[var(--border)] p-2"
                href={closeHref}
              >
                <X size={18} />
              </Link>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
