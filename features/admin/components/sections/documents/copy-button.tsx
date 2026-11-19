"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies a value (the full SHA-256) to the clipboard; says "Copied" for a moment. */
export function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      aria-label={label}
      className="tap-target inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-xs font-medium text-[var(--primary)]"
      data-copy-value={value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // No clipboard (plain http on the LAN): select the text instead.
          const area = document.createElement("textarea");

          area.value = value;
          document.body.append(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }

        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      title={label}
      type="button"
    >
      {copied ? <Check aria-hidden size={12} /> : <Copy aria-hidden size={12} />}
      <span aria-live="polite">{copied ? copiedLabel : null}</span>
    </button>
  );
}
