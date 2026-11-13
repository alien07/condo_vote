/** "The Thai version prevails" note for English pages (D020, demo feedback
 * item 6a). Renders nothing when the text is empty (Thai pages). */
export function TranslationNote({ text, className = "mt-4" }: { text: string; className?: string }) {
  if (!text) {
    return null;
  }

  return (
    <p
      className={`${className} rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900`}
      data-testid="translation-note"
      role="note"
    >
      {text}
    </p>
  );
}
