// Fills "{name}" placeholders in dictionary text. Staff dictionaries hold
// plain strings (no functions) so they can be passed to client components.
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
