"use client";

import { useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { FileSearch } from "lucide-react";
import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { sha256Hex } from "@/lib/files/sha256";

// "Choose file to calculate" (documents review 2026-11-19): reads a file on
// this device and fills its name, type, size and SHA-256. The file input has
// no name, so the file is never sent: the system keeps only the location.

const inputClass =
  "min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal";
const fieldClass = "grid min-w-0 gap-1 text-sm font-medium";

type Values = {
  original_filename: string;
  mime_type: string;
  file_size_bytes: string;
  checksum_sha256: string;
};

export function FileCheckFields({
  defaults,
  errors,
  fieldProps,
}: {
  defaults: Values;
  errors: Partial<Record<keyof Values, ReactNode>>;
  fieldProps: (name: keyof Values) => Record<string, string | undefined>;
}) {
  const { s } = useStaffText();
  const fileRef = useRef<HTMLInputElement>(null);
  const fields = useRef<Partial<Record<keyof Values, HTMLInputElement | null>>>({});
  const [status, setStatus] = useState<{ kind: "busy" | "done" | "error"; name?: string } | null>(null);

  async function calculate(file: File) {
    setStatus({ kind: "busy" });

    try {
      const checksum = await sha256Hex(await file.arrayBuffer());
      const next: Values = {
        original_filename: file.name,
        mime_type: file.type,
        file_size_bytes: String(file.size),
        checksum_sha256: checksum,
      };

      (Object.keys(next) as Array<keyof Values>).forEach((key) => {
        const input = fields.current[key];

        if (input) {
          input.value = next[key];
        }
      });
      setStatus({ kind: "done", name: file.name });
    } catch {
      setStatus({ kind: "error" });
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  const input = (name: keyof Values, label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={fieldClass}>
      {label}
      <input
        {...fieldProps(name)}
        {...extra}
        className={inputClass}
        defaultValue={defaults[name]}
        name={name}
        ref={(element) => {
          fields.current[name] = element;
        }}
      />
      {errors[name]}
    </label>
  );

  return (
    <div className="grid gap-3">
      <p className="text-xs text-[var(--muted)]">{s.documents.checkHelp}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)]"
          disabled={status?.kind === "busy"}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          <FileSearch aria-hidden size={16} />
          {status?.kind === "busy" ? s.documents.calculating : s.documents.chooseFile}
        </button>
        {/* No name: the file stays on this device. */}
        <input
          aria-label={s.documents.chooseFile}
          className="sr-only"
          data-file-calculator
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];

            if (file) {
              void calculate(file);
            }
          }}
          ref={fileRef}
          tabIndex={-1}
          type="file"
        />
        <span aria-live="polite" className="text-xs text-[var(--muted)]">
          {status?.kind === "done"
            ? fill(s.documents.calculated, { name: status.name ?? "" })
            : status?.kind === "error"
              ? s.documents.calculateFailed
              : null}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {input("original_filename", s.documents.filename, { autoComplete: "off" })}
        {input("mime_type", s.documents.mime, { autoComplete: "off" })}
        {input("file_size_bytes", s.documents.size, { min: 0, type: "number", inputMode: "numeric" })}
        {input("checksum_sha256", s.documents.checksum, {
          autoComplete: "off",
          placeholder: s.documents.checksumPlaceholder,
          spellCheck: false,
        })}
      </div>
    </div>
  );
}
