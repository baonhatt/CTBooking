export function buildAuditPayload(data: unknown): string | undefined {
  if (data === null || data === undefined) return undefined;

  try {
    return JSON.stringify(data);
  } catch {
    return undefined;
  }
}
