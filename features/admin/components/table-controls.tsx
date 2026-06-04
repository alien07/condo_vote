"use client";

import { useRouter } from "next/navigation";

type PerPageSelectProps = {
  label: string;
  options?: number[];
  value: number;
  urlByValue: Record<string, string>;
};

export function PerPageSelect({
  label,
  options = [10, 25, 50, 100],
  value,
  urlByValue,
}: PerPageSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
      {label}
      <select
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
        onChange={(event) => {
          const nextUrl = urlByValue[event.currentTarget.value];

          if (nextUrl) {
            router.replace(nextUrl, { scroll: false });
          }
        }}
        value={String(value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
