export function buildAuditPayload(data: any, entityType?: 'staff' | 'normal', extra?: Record<string, any>): string | undefined {
  if (data === null || data === undefined) return undefined;

  let payload = data;
  if (entityType === 'staff') {
    const { password, ...rest } = data;
    payload = rest;
  }
  
  if (extra) {
    payload = { ...payload, ...extra };
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return undefined;
  }
}
