import { request } from './http';

// Admin API helpers for the staff, role and audit-log screens that need a second, detailed read.

/** Who created and who last changed a staff member: read when the staff detail opens (the list does not carry it). */
export async function getStaffTrackingApi(id: number) {
  return request<{
    status: string;
    staff: { id: number; created_by_staff_name: string | null; updated_by_staff_name: string | null };
  }>(`/api/admin/staff/${id}`);
}

/** The full values of one audit line (before / after / browser): read when the detail dialog opens. */
export async function getAuditLogDetailApi(id: number) {
  return request<{
    status: string;
    log: { id: number; oldValues: string | null; newValues: string | null; userAgent: string | null };
  }>(`/api/admin/audit-logs/${id}`);
}
