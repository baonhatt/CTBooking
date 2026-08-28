import { and, eq, isNull, or, sql, SQL } from 'drizzle-orm';

/** null = all branches; [] = not configured; [1,2] = specific branches */
export type ParsedBranchIds = number[] | null;

export function parseBranchIds(raw: string | null | undefined): ParsedBranchIds {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (parsed.length === 0) return [];
    return parsed.map((v) => Number(v)).filter((id) => !Number.isNaN(id) && id > 0);
  } catch {
    return null;
  }
}

export function serializeBranchIds(ids: number[] | null | undefined): string | null {
  if (ids === null || ids === undefined) return null;
  if (ids.length === 0) return '[]';
  return JSON.stringify(ids);
}

export type BranchIdsDisplayStatus = 'all' | 'specific' | 'unset';

export function getBranchIdsDisplayStatus(raw: string | null | undefined): BranchIdsDisplayStatus {
  const parsed = parseBranchIds(raw);
  if (parsed === null) return 'all';
  if (parsed.length === 0) return 'unset';
  return 'specific';
}

/** Sync legacy branch_id column from branch_ids for backward compatibility */
export function legacyBranchIdFromBranchIds(ids: number[] | null | undefined): number | null {
  if (ids === null || ids === undefined) return null;
  if (ids.length === 0) return null;
  return ids[0];
}

export function resolveBranchIdsInput(
  branch_ids: number[] | null | undefined,
  branch_id?: number | null
): { branch_ids?: string | null; branch_id?: number | null } {
  if (branch_ids !== undefined) {
    const serialized = serializeBranchIds(branch_ids);
    return {
      branch_ids: serialized,
      branch_id: legacyBranchIdFromBranchIds(branch_ids)
    };
  }
  if (branch_id !== undefined) {
    if (branch_id === null) {
      return { branch_ids: null, branch_id: null };
    }
    return {
      branch_ids: JSON.stringify([branch_id]),
      branch_id
    };
  }
  return {};
}

export function matchesBranchFilter(
  recordBranchIds: string | null | undefined,
  recordBranchId: number | null | undefined,
  filterBranchId: number
): boolean {
  const parsed = parseBranchIds(recordBranchIds ?? null);
  if (parsed === null) return true;
  if (parsed.length === 0) return false;
  if (parsed.includes(filterBranchId)) return true;
  if ((recordBranchIds === null || recordBranchIds === undefined) && recordBranchId === filterBranchId) {
    return true;
  }
  return false;
}

export function staffCanAccessBranchIds(
  recordBranchIds: string | null | undefined,
  staffBranchIds: number[] | undefined,
  isSuperAdmin: boolean | undefined
): boolean {
  if (isSuperAdmin) return true;
  if (!staffBranchIds || staffBranchIds.length === 0) return false;
  const parsed = parseBranchIds(recordBranchIds ?? null);
  if (parsed === null) return true;
  if (parsed.length === 0) return false;
  return parsed.some((id) => staffBranchIds.includes(id));
}

/** SQL: record visible when filtering public/admin list by a single branch */
export function sqlBranchIdsMatchFilter(
  branchIdsColumn: unknown,
  branchIdColumn: unknown,
  filterBranchId: number
): SQL {
  return or(
    isNull(branchIdsColumn as any),
    sql`EXISTS (SELECT 1 FROM json_each(${branchIdsColumn}) WHERE CAST(value AS INTEGER) = ${filterBranchId})`,
    and(isNull(branchIdsColumn as any), eq(branchIdColumn as any, filterBranchId))
  )!;
}

/** SQL: staff can see records targeting all branches or overlapping assigned branches */
export function sqlBranchIdsStaffAccessFilter(branchIdsColumn: unknown, staffBranchIds: number[]): SQL {
  if (!staffBranchIds.length) {
    return sql`1 = 0`;
  }
  const idList = sql.join(
    staffBranchIds.map((id) => sql`${id}`),
    sql`, `
  );
  return or(
    isNull(branchIdsColumn as any),
    sql`EXISTS (SELECT 1 FROM json_each(${branchIdsColumn}) WHERE CAST(value AS INTEGER) IN (${idList}))`
  )!;
}

export function enrichWithParsedBranchIds<T extends { branch_ids?: string | null }>(item: T) {
  return {
    ...item,
    branch_ids: parseBranchIds(item.branch_ids ?? null)
  };
}

export function enrichItemsWithParsedBranchIds<T extends { branch_ids?: string | null }>(items: T[]) {
  return items.map(enrichWithParsedBranchIds);
}
