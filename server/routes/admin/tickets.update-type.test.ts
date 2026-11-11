import { describe, it, expect, vi } from 'vitest';
import * as schema from '../../../shared/schema';
import { updateTicketPackageImpl } from './tickets';

const tables: any = {
  ticket_packages: (schema as any).ticket_packages,
  movies: (schema as any).movies,
  auditLogs: (schema as any).auditLogs
};

/** Fake database holding one ticket package; records what update().set() receives. */
function makeDb(row: any) {
  const writes: any[] = [];
  const db: any = {
    query: { ticket_packages: { findFirst: vi.fn(async () => row) } },
    update: () => ({
      set: (values: any) => ({
        where: () => {
          writes.push(values);
          return { returning: async () => [{ ...row, ...values }] };
        }
      })
    })
  };
  return { db, writes };
}

describe('updateTicketPackageImpl: package type is immutable', () => {
  it('rejects a different type with 400', async () => {
    const { db, writes } = makeDb({ id: 3, name: 'Vé đôi', type: 'movie', branch_ids: null });
    await expect(updateTicketPackageImpl(db, tables, 3, { type: 'vr' }, {})).rejects.toMatchObject({
      statusCode: 400,
      message: 'Không thể đổi loại gói vé sau khi tạo'
    });
    expect(writes).toHaveLength(0);
  });

  it('rejects movie sent for a VR package', async () => {
    const { db } = makeDb({ id: 4, name: 'VR', type: 'vr', branch_ids: null });
    await expect(updateTicketPackageImpl(db, tables, 4, { type: 'movie' }, {})).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('accepts the same type and never writes type', async () => {
    const { db, writes } = makeDb({ id: 4, name: 'VR', type: 'vr', branch_ids: null });
    await updateTicketPackageImpl(db, tables, 4, { type: 'vr', name: 'VR 2' }, {});
    expect(writes).toHaveLength(1);
    expect(writes[0].name).toBe('VR 2');
    expect('type' in writes[0]).toBe(false);
  });

  it('accepts update without type', async () => {
    const { db, writes } = makeDb({ id: 3, name: 'Vé', type: null, branch_ids: null });
    await updateTicketPackageImpl(db, tables, 3, { name: 'Vé mới' }, {});
    expect(writes[0].name).toBe('Vé mới');
  });
});
