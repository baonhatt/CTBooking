import { describe, it, expect, beforeEach } from 'vitest';
import { branch_contact_details, refreshEmailBrandFromBranches, resetEmailBrandCache } from './email-brand-source';
import { configureEmailBrand, setBranchBrandFallback, getEmailBrand } from './email-layout';

/** A database stand-in that returns the given rows for the one query the loader makes. */
function fake_db(rows: any[], counter = { calls: 0 }) {
  const query: any = {
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: async () => {
      counter.calls += 1;
      return rows;
    }
  };
  return { select: () => query, counter };
}

const BRANCHES_TABLE: any = {
  address: 'address',
  phone: 'phone',
  email: 'email',
  settings: 'settings',
  is_active: 'is_active',
  deleted_at: 'deleted_at',
  is_default: 'is_default',
  id: 'id'
};

beforeEach(() => {
  resetEmailBrandCache();
  setBranchBrandFallback({});
  configureEmailBrand({});
});

describe('branch_contact_details', () => {
  it('prefers the hotline in the branch settings over its phone number', () => {
    const details = branch_contact_details({ phone: '028 111', settings: JSON.stringify({ hotline: '1900 6868' }), email: 'q1@c.test', address: '1 A' });
    expect(details).toEqual({ hotline: '1900 6868', supportEmail: 'q1@c.test', companyAddress: '1 A' });
  });

  it('falls back to the phone when there is no hotline, and survives broken settings', () => {
    expect(branch_contact_details({ phone: '028 111', settings: '{oops' }).hotline).toBe('028 111');
    expect(branch_contact_details({}).hotline).toBe('');
  });
});

describe('refreshEmailBrandFromBranches', () => {
  it('puts the default branch details in the mail footer when the env does not set them', async () => {
    const db = fake_db([{ address: '1 Đường Phim', phone: '028 111', email: 'q1@c.test', settings: JSON.stringify({ hotline: '1900 6868' }) }]);
    await refreshEmailBrandFromBranches(db, BRANCHES_TABLE);

    const brand = configureEmailBrand({});
    expect(brand).toMatchObject({ hotline: '1900 6868', supportEmail: 'q1@c.test', companyAddress: '1 Đường Phim' });
  });

  it('lets an env setting win over the branch', async () => {
    const db = fake_db([{ address: '1 A', phone: '028 111', email: 'q1@c.test', settings: null }]);
    await refreshEmailBrandFromBranches(db, BRANCHES_TABLE);

    const brand = configureEmailBrand({ SUPPORT_HOTLINE: '1800 0000' });
    expect(brand.hotline).toBe('1800 0000');
    expect(brand.supportEmail).toBe('q1@c.test');
  });

  it('asks the database only once per few minutes', async () => {
    const db = fake_db([{ address: '1 A', phone: '1', email: '', settings: null }]);
    await refreshEmailBrandFromBranches(db, BRANCHES_TABLE, 1_000_000);
    await refreshEmailBrandFromBranches(db, BRANCHES_TABLE, 1_000_000 + 60_000);
    expect(db.counter.calls).toBe(1);

    await refreshEmailBrandFromBranches(db, BRANCHES_TABLE, 1_000_000 + 6 * 60_000);
    expect(db.counter.calls).toBe(2);
  });

  it('keeps the previous details when the database fails', async () => {
    setBranchBrandFallback({ hotline: '1900 1111' });
    const broken: any = {
      select: () => {
        throw new Error('d1 down');
      }
    };
    await refreshEmailBrandFromBranches(broken, BRANCHES_TABLE);

    expect(configureEmailBrand({}).hotline).toBe('1900 1111');
    expect(getEmailBrand().hotline).toBe('1900 1111');
  });
});
