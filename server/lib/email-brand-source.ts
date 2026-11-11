// ============================================================
// CINESPHERE - Where the mail footer gets its contact details
//
// The hotline, support email and address in a mail footer come from, in this order:
//   1. the worker env (SUPPORT_HOTLINE, SUPPORT_EMAIL, COMPANY_ADDRESS), if set;
//   2. the default branch in "Quản lý chi nhánh" (hotline from its settings, else its phone; its email; its address);
//   3. nothing: the footer then leaves that line out.
// The default branch is read at most once every few minutes per worker instance.
// ============================================================

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { setBranchBrandFallback, type BranchBrandFallback } from './email-layout';

/** Minutes the default branch's details are reused before the database is asked again */
const BRANCH_BRAND_CACHE_MINUTES = 5;

let loaded_at_ms = 0;

/** The hotline a branch publishes: the one in its settings, else its phone number. */
export function branch_contact_details(branch: {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  settings?: string | null;
}): BranchBrandFallback {
  let settingsHotline = '';
  if (branch.settings) {
    try {
      settingsHotline = String(JSON.parse(branch.settings)?.hotline || '').trim();
    } catch {}
  }
  return {
    hotline: settingsHotline || String(branch.phone || '').trim(),
    supportEmail: String(branch.email || '').trim(),
    companyAddress: String(branch.address || '').trim()
  };
}

/**
 * Loads the default branch's contact details into the mail brand settings.
 * Safe to call on every request: it hits the database only when the cached copy is older than a few minutes,
 * and a database error leaves the previous details in place.
 */
export async function refreshEmailBrandFromBranches(db: any, branchesTable: any, nowMs: number = Date.now()): Promise<void> {
  if (nowMs - loaded_at_ms < BRANCH_BRAND_CACHE_MINUTES * 60 * 1000) return;
  loaded_at_ms = nowMs;

  try {
    // The default branch first; if none is marked, the oldest active one
    const rows = await db
      .select({
        address: branchesTable.address,
        phone: branchesTable.phone,
        email: branchesTable.email,
        settings: branchesTable.settings
      })
      .from(branchesTable)
      .where(and(eq(branchesTable.is_active, true), isNull(branchesTable.deleted_at)))
      .orderBy(desc(branchesTable.is_default), asc(branchesTable.id))
      .limit(1);

    if (rows.length > 0) setBranchBrandFallback(branch_contact_details(rows[0]));
  } catch (error) {
    console.warn('[EmailBrand] Could not read the default branch:', (error as any)?.message || error);
  }
}

/** For tests: forget the cached copy. */
export function resetEmailBrandCache(): void {
  loaded_at_ms = 0;
}
