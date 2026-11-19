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
  /** With allowCustom: "Use “{text}”". */
  useTyped?: string;
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
  allowCustom = false,
  maxResults = 20,
  onChange,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  name: string;
  options: SearchSelectOption[];
  defaultValue?: string;
  text: SearchSelectText;
  autoFocus?: boolean;
  /** Also accept typed text that is not in the list (the value is the text). */
  allowCustom?: boolean;
  maxResults?: number;
  /** Called with the new value when a row is picked, and with "" when the
   * choice is cleared. */
  onChange?: (value: string) => void;
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

  const typed = query.trim();
  const customRow: SearchSelectOption | null =
    allowCustom && typed && !options.some((option) => normalize(option.label) === normalize(typed))
      ? { value: typed, label: typed }
      : null;
  const shown = [...matches.slice(0, maxResults), ...(customRow ? [customRow] : [])];
  const selected =
    options.find((option) => option.value === value) ??
    (allowCustom && value ? { value, label: value } : undefined);

  function choose(option: SearchSelectOption) {
    if (option.disabled) {
      return;
    }

    setValue(option.value);
    setQuery("");
    setOpen(false);
    onChange?.(option.value);
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
            // Free text counts as the answer when the box is left.
            if (allowCustom && typed) {
              setValue(typed);
            }

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
              onChange?.("");
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
              key={option === customRow ? `custom:${option.value}` : option.value}
              onMouseDown={(event) => {
                // Keep focus in the box until the row is chosen.
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              <span className="block text-sm font-medium">
                {option === customRow && text.useTyped
                  ? text.useTyped.replace("{text}", option.label)
                  : option.label}
              </span>
              {option.hint ? (
                <span className="block text-xs text-[var(--muted)]">{option.hint}</span>
              ) : null}
            </li>
          ))}
          {shown.length === 0 && !customRow ? (
            <li className="px-3 py-2 text-sm text-[var(--muted)]" role="presentation">
              {text.noResults}
            </li>
          ) : null}
          {matches.length > maxResults ? (
            <li className="px-3 py-2 text-xs text-[var(--muted)]" role="presentation">
              {text.more.replace("{count}", String(matches.length - maxResults))}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/** The element to focus for a field with an error: a SearchSelect's search
 * box when there is one, otherwise the form control with that name. */
export function invalidFieldElement(form: HTMLFormElement | null | undefined, name: string) {
  const box = form?.querySelector<HTMLElement>(`[data-focus-for="${CSS.escape(name)}"]`);

  if (box) {
    return box;
  }

  const field = form?.elements.namedItem(name);
  return field instanceof RadioNodeList
    ? (field[0] as HTMLElement | undefined) ?? null
    : field instanceof HTMLElement
      ? field
      : null;
}

type PersonLike = { email: string; full_name: string | null; id: string };

/** People (accounts): name first, email as the hint, both searchable. */
export function profileSearchOptions(profiles: PersonLike[]): SearchSelectOption[] {
  return profiles.map((profile) => ({
    value: profile.id,
    label: profile.full_name ?? profile.email,
    hint: profile.full_name ? profile.email : undefined,
    keywords: profile.email,
  }));
}

type RoomLike = { active: boolean | null; id: string; room_number: string; building?: string | null };

/** Active rooms by number; the building helps when numbers repeat. */
export function roomSearchOptions(rooms: RoomLike[]): SearchSelectOption[] {
  return rooms
    .filter((room) => room.active)
    .map((room) => ({ value: room.id, label: room.room_number, hint: room.building ?? undefined }));
}

type OwnerLike = { active: boolean | null; full_name: string; id: string; email?: string | null; phone?: string | null };

/** Active owners of record by name; email and phone as the hint. */
export function ownerSearchOptions(owners: OwnerLike[]): SearchSelectOption[] {
  return owners
    .filter((owner) => owner.active)
    .map((owner) => ({
      value: owner.id,
      label: owner.full_name,
      hint: [owner.email, owner.phone].filter(Boolean).join(" · ") || undefined,
    }));
}
