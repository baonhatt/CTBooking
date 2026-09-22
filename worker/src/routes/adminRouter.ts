import { Hono } from 'hono';

type Variables = {
  staffId?: number;
  staffEmail?: string;
  staffFullname?: string;
  isSuperAdmin?: boolean;
  staffPermissions?: Array<{ module: string; action: string }>;
  staffBranchIds?: number[];
};

export const adminRouter = new Hono<{ Bindings: any; Variables: Variables }>();

// ── Sub-routers ────────────────────────────────────────────────
import authRouter from './admin/auth.router';
import dashboardRouter from './admin/dashboard.router';
import moviesRouter from './admin/movies.router';
import showtimesRouter from './admin/showtimes.router';
import ticketsRouter from './admin/tickets.router';
import branchesRouter from './admin/branches.router';
import staffRouter from './admin/staff.router';
import rolesRouter from './admin/roles.router';
import vouchersRouter from './admin/vouchers.router';
import postsRouter from './admin/posts.router';
import toysRouter from './admin/toys.router';
import logsRouter from './admin/logs.router';
import paymentsRouter from './admin/payments.router';
import settingsRouter from './admin/settings.router';
import sitemediaRouter from './admin/site-media.router';

adminRouter.route('/', authRouter);
adminRouter.route('/', dashboardRouter);
adminRouter.route('/', moviesRouter);
adminRouter.route('/', showtimesRouter);
adminRouter.route('/', ticketsRouter);
adminRouter.route('/', branchesRouter);
adminRouter.route('/', staffRouter);
adminRouter.route('/', rolesRouter);
adminRouter.route('/', vouchersRouter);
adminRouter.route('/', postsRouter);
adminRouter.route('/', toysRouter);
adminRouter.route('/', logsRouter);
adminRouter.route('/', paymentsRouter);
adminRouter.route('/', settingsRouter);
adminRouter.route('/', sitemediaRouter);

export default adminRouter;
