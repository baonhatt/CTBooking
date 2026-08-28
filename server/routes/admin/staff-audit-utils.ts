export function buildStaffAuditPayload(staff: any, extra?: Record<string, any>) {
  if (!staff) return undefined;

  const { password, ...rest } = staff;
  const payload = extra ? { ...rest, ...extra } : rest;

  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({});
  }
}
