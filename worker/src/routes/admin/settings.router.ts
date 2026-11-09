import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';



import { getAdminSettingsImpl, updateAdminSettingsImpl } from '../../../../server/routes/admin/settings';
type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const settingsRouter = new Hono<{ Bindings: any; Variables: Variables }>();

settingsRouter.get('/api/admin/settings', requireStaffAuth, requirePermission('settings', 'view'), async (c) => {
  try {
    const r = await getAdminSettingsImpl(c.env.SETTINGS_KV);

    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Internal error') }, 500);
  }
});

settingsRouter.post('/api/admin/settings', requireStaffAuth, requirePermission('settings', 'manage'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });
    const r = await updateAdminSettingsImpl(c.env.SETTINGS_KV, body, {
      db,
      auditLogs: schema.auditLogs,
      staff: { id: c.get('staffId'), email: c.get('staffEmail'), fullname: c.get('staffFullname') }
    });

    return c.json(r);
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    return c.json({ message: String(err?.message || 'Internal error') }, status as any);
  }
});


export default settingsRouter;
