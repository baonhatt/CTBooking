import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { createTicketPackageImpl, updateTicketPackageImpl, deleteTicketPackageImpl, toggleTicketStatusImpl } from './tickets';

const tables: any = {
  ticket_packages: (schema as any).ticket_packages,
  movies: (schema as any).movies,
  auditLogs: (schema as any).auditLogs,
  bookings: (schema as any).bookings
};

/** In-memory database holding one ticket package (offered at every branch); reads the saved row back. */
function makeDb(row: Record<string, unknown>) {
  const { db, raw } = makeSqliteDb(['ticket_packages', 'package_branches', 'package_movies', 'movies', 'branches', 'bookings', 'auditLogs']);
  insertRows(raw, 'ticket_packages', [
    { price: 100000, all_branches: 1, movie_scope: 'all_at_branch', is_active: 1, created_at: 'x', updated_at: 'x', ...row }
  ]);
  const saved = () => raw.prepare('SELECT * FROM ticket_packages WHERE id = ?').get(Number(row.id)) as any;
  return { db, saved };
}

describe('updateTicketPackageImpl: package type is immutable', () => {
  it('rejects a different type with 400', async () => {
    const { db, saved } = makeDb({ id: 3, name: 'Vé đôi', type: 'movie' });
    await expect(updateTicketPackageImpl(db, tables, 3, { type: 'vr' }, {})).rejects.toMatchObject({
      statusCode: 400,
      message: 'Không thể đổi loại gói vé sau khi tạo'
    });
    expect(saved()).toMatchObject({ name: 'Vé đôi', type: 'movie', updated_at: 'x' });
  });

  it('rejects movie sent for a VR package', async () => {
    const { db } = makeDb({ id: 4, name: 'VR', type: 'vr' });
    await expect(updateTicketPackageImpl(db, tables, 4, { type: 'movie' }, {})).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('accepts the same type and never writes type', async () => {
    const { db, saved } = makeDb({ id: 4, name: 'VR', type: 'vr' });
    const result: any = await updateTicketPackageImpl(db, tables, 4, { type: 'vr', name: 'VR 2' }, {});
    expect(saved()).toMatchObject({ name: 'VR 2', type: 'vr' });
    expect(result).toMatchObject({ id: 4, name: 'VR 2', type: 'vr' });
  });

  it('accepts update without type', async () => {
    const { db, saved } = makeDb({ id: 3, name: 'Vé', type: null });
    await updateTicketPackageImpl(db, tables, 3, { name: 'Vé mới' }, {});
    expect(saved()).toMatchObject({ name: 'Vé mới', type: null });
  });
});

describe('a movie package of selected movies needs at least one movie', () => {
  const scope = { all_branches: true };

  it('create: refused with 400, nothing saved', async () => {
    const { db } = makeDb({ id: 1, name: 'Có sẵn', type: 'movie' });
    await expect(
      createTicketPackageImpl(db, tables, { name: 'Gói rỗng', price: 1000, type: 'movie', ...scope, movie_scope: 'selected', movie_ids: [] }, {})
    ).rejects.toMatchObject({ statusCode: 400 });
    const rows = await db.select().from((schema as any).ticket_packages);
    expect(rows).toHaveLength(1);
  });

  it('full edit: refused with 400, the package keeps its movies', async () => {
    const { db, saved } = makeDb({ id: 3, name: 'Vé', type: 'movie' });
    await expect(
      updateTicketPackageImpl(db, tables, 3, { name: 'Vé', ...scope, movie_scope: 'selected', movie_ids: [] }, {})
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(saved()).toMatchObject({ movie_scope: 'all_at_branch', updated_at: 'x' });
  });

  it('VR packages have no movies and are not checked', async () => {
    const { db, saved } = makeDb({ id: 4, name: 'VR', type: 'vr' });
    await updateTicketPackageImpl(db, tables, 4, { name: 'VR 2', ...scope, movie_scope: 'selected', movie_ids: [] }, {});
    expect(saved()).toMatchObject({ name: 'VR 2' });
    const created: any = await createTicketPackageImpl(db, tables, { name: 'VR mới', price: 1000, type: 'vr', ...scope }, {});
    expect(created.item).toMatchObject({ name: 'VR mới', type: 'vr' });
  });
});

describe('a package of no branch (all_branches = 0, no link rows)', () => {
  const noBranch = { id: 5, name: 'Chưa gán', type: 'movie', all_branches: 0 };

  it('branch staff cannot update, toggle or delete it (403) and nothing changes', async () => {
    const { db, saved } = makeDb(noBranch);
    await expect(updateTicketPackageImpl(db, tables, 5, { name: 'X' }, {}, undefined, [1])).rejects.toMatchObject({ statusCode: 403 });
    await expect(toggleTicketStatusImpl(db, tables, 5, {}, undefined, [1])).rejects.toMatchObject({ statusCode: 403 });
    await expect(deleteTicketPackageImpl(db, tables, 5, {}, undefined, [1])).rejects.toMatchObject({ statusCode: 403 });
    expect(saved()).toMatchObject({ name: 'Chưa gán', is_active: 1, deleted_at: null, updated_at: 'x' });
  });

  it('the Super Admin can', async () => {
    const { db, saved } = makeDb(noBranch);
    await updateTicketPackageImpl(db, tables, 5, { name: 'X' }, {}, undefined, null);
    expect(saved()).toMatchObject({ name: 'X', all_branches: 0 });
    await toggleTicketStatusImpl(db, tables, 5, {}, undefined, null);
    expect(saved().is_active).toBe(0);
    await deleteTicketPackageImpl(db, tables, 5, {}, undefined, null);
    expect(saved().deleted_at).not.toBeNull();
  });
});
