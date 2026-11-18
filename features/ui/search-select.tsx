"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchSelectOption = {
  value: string;
  label: string;
  /** Second line that helps pick the right row (floor, current owner, email). */
  hint?: string;
  /** Extra text that matches a search but is not shown. */
  keywords?: string;
  disabled?: boolean;
};

export type SearchSelectText = {
  placeholder: string;
  noResults: string;
  /** "{count} more. Type to narrow the list." */
  more: string;
  clear: string;
};

// Letters and digits only, lower case: "A-108" matches "a108" and "a 108".
function normalize(value: string) {
  return value.normalize("NFC").toLowerCase().replace(/[\s\-_.,()/:·]+/g, "");
}

/**
 * Type-to-search replacement for a long `<select>` (UI standard rule 8).
 * Submits through a hidden input with `name`, so server actions and form
 * resets work as before. The visible box carries `data-focus-for={name}`
 * so "focus the first field with an error" can reach it.
 */
export function SearchSelect({
  name,
  options,
  defaultValue = "",
  text,
  autoFocus,
  maxResults = 20,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  name: string;
  options: SearchSelectOption[];
  defaultValue?: string;
  text: SearchSelectText;
  autoFocus?: boolean;
  maxResults?: number;
  "aria-describedby"?: string;
  "aria-invalid"?: "true";
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultRef = useRef(defaultValue);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // A new server state (for example after a failed save) brings a new default.
  const [shownDefault, setShownDefault] = useState(defaultValue);

  if (shownDefault !== defaultValue) {
    setShownDefault(defaultValue);
    setValue(defaultValue);
  }

  useEffect(() => {
    defaultRef.current = defaultValue;
  }, [defaultValue]);

  // "Clear form" and React's reset after an action go back to the default.
  useEffect(() => {
    const form = inputRef.current?.form;

    if (!form) {
      return;
    }

    const onReset = () => {
      setValue(defaultRef.current);
      setQuery("");
      setOpen(false);
    };

    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const indexed = useMemo(
    () =>
      options.map((option) => ({
        option,
        haystack: normalize(`${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`),
      })),
    [options],
  );

  const matches = useMemo(() => {
    const words = query.split(/\s+/).map(normalize).filter(Boolean);
    return words.length === 0
      ? indexed.map((entry) => entry.option)
      : indexed
          .filter((entry) => words.every((word) => entry.haystack.includes(word)))
          .map((entry) => entry.option);
  }, [indexed, query]);

  const shown = matches.slice(0, maxResults);
  const selected = options.find((option) => option.value === value);

  function choose(option: SearchSelectOption) {
    if (option.disabled) {
      return;
    }

    setValue(option.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), Math.max(shown.length - 1, 0)));
    } else if (event.key === "Enter" && open) {
      // Pick the highlighted row instead of submitting the form.
      event.preventDefault();
      const option = shown[active];

      if (option) {
        choose(option);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={value} />
      <div className="relative">
        <input
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-invalid={invalid}
          autoComplete="off"
          autoFocus={autoFocus}
          className="min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-11 text-sm font-normal"
          data-focus-for={name}
          onBlur={() => {
            setQuery("");
            setOpen(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          // Opens on click or typing, not on focus: an autofocused box must
          // not cover the next field when a drawer opens.
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selected ? selected.label : text.placeholder}
          ref={inputRef}
          role="combobox"
          type="text"
          value={open ? query : (selected?.label ?? "")}
        />
        {selected ? (
          <button
            aria-label={text.clear}
            className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center text-lg text-[var(--muted)]"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 font-normal shadow-lg"
          id={listId}
          role="listbox"
        >
          {shown.map((option, index) => (
            <li
              aria-disabled={option.disabled || undefined}
              aria-selected={option.value === value}
              className={`min-h-11 cursor-pointer px-3 py-2 [overflow-wrap:anywhere] ${
                index === active ? "bg-[var(--primary)]/10" : ""
              } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              data-label={option.label}
              id={`${listId}-${index}`}
              key={option.value}
              onMouseDown={(event) => {
                // Keep focus in the box until the row is chosen.
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              <span className="block text-sm font-medium">{option.label}</span>
              {option.hint ? (
                <span className="block text-xs text-[var(--muted)]">{option.hint}</span>
              ) : null}
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--muted)]" role="presentation">
              {text.noResults}
            </li>
          ) : null}
          {matches.length > shown.length ? (
            <li className="px-3 py-2 text-xs text-[var(--muted)]" role="presentation">
              {text.more.replace("{count}", String(matches.length - shown.length))}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
