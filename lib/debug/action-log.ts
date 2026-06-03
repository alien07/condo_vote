type DebugDetails = Record<string, string | number | boolean | null | undefined>;

export function debugAction(event: string, details: DebugDetails = {}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.debug(`[condoVotes:debug] ${JSON.stringify({
    event,
    ...details,
  })}`);
}
