"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Position = { top: number; left: number; width: number; above: boolean };

const TIP_WIDTH = 280;
const GAP = 6;

/** Where the tip goes for a button; null when the button is off screen. */
function computePosition(button: HTMLElement | null): Position | null {
  const rect = button?.getBoundingClientRect();

  if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
    return null;
  }

  const width = Math.min(TIP_WIDTH, window.innerWidth - 16);
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 8,
  );
  const above = rect.bottom + 140 > window.innerHeight && rect.top > 160;

  return { top: above ? rect.top - GAP : rect.bottom + GAP, left, width, above };
}

// Small "i" after a term. Tap or click pins the explanation; a mouse hover or
// keyboard focus shows it too. Esc or a click elsewhere closes it; it follows
// the button when the page scrolls and closes once the button leaves the screen.
// Fixed positioning, so tables with overflow do not clip it. Hidden in print:
// printed pages show the same text as notes (GlossaryNotes).
export function InfoTip({
  about,
  term,
  text,
  extra,
}: {
  about: string;
  term: string;
  text: string;
  /** More content under the explanation, e.g. who approved (item 11). */
  extra?: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const open = (pinned || hovered) && position !== null;

  function place() {
    setPosition(computePosition(buttonRef.current));
  }

  useEffect(() => {
    if (!pinned && !hovered) {
      return;
    }

    function close() {
      setPinned(false);
      setHovered(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!buttonRef.current?.contains(target) && !tipRef.current?.contains(target)) {
        close();
      }
    }

    // Follow the button; close once it is off screen.
    function follow() {
      const next = computePosition(buttonRef.current);

      if (next) {
        setPosition(next);
      } else {
        close();
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [pinned, hovered]);

  return (
    <>
      <button
        aria-describedby={open ? id : undefined}
        aria-expanded={pinned}
        aria-label={`${about}: ${term}`}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-[var(--muted)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] print:hidden"
        onBlur={() => setHovered(false)}
        onClick={() => {
          // Hover or focus may have opened it already; a click pins it.
          if (pinned) {
            setPinned(false);
            setHovered(false);
          } else {
            place();
            setPinned(true);
          }
        }}
        onFocus={() => {
          place();
          setHovered(true);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            place();
            setHovered(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            setHovered(false);
          }
        }}
        ref={buttonRef}
        type="button"
      >
        <Info aria-hidden size={14} />
      </button>
      {open ? (
        <span
          className="fixed z-50 block rounded-md bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg print:hidden"
          id={id}
          ref={tipRef}
          role="tooltip"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            transform: position.above ? "translateY(-100%)" : undefined,
          }}
        >
          <span className="block font-semibold">{term}</span>
          {text}
          {extra ? <span className="mt-2 block border-t border-white/20 pt-2">{extra}</span> : null}
        </span>
      ) : null}
    </>
  );
}
