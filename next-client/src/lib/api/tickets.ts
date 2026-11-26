import { request } from '@/lib/api/http';

// The admin ticket fetchers lived here but were never used by this site; the admin app has its own.

export async function getActiveTickets(branchId?: number, options?: { signal?: AbortSignal }) {
  let url = `/api/tickets-active`;
  if (branchId !== undefined && branchId !== null) {
    url += `?branch_id=${branchId}`;
  }
  return request<{ items: any[] }>(url, {
    signal: options?.signal
  });
}
