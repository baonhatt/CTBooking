import { describe, it, expect, vi } from 'vitest';
import * as schema from '../../../shared/schema';
import { copyShowtimesImpl } from './showtimes';

const tables: any = {
  showtimes: (schema as any).showtimes,
  auditLogs: (schema as any).auditLogs,
  movies: (schema as any).movies
};
const staff = { id: 5, email: 'staff@example.com', fullname: 'Staff' };

const slot = (movieId: number, start: string, end: string, branch = 1) => ({ id: movieId * 100, branch_id: branch, movie_id: movieId, start_time: start, end_time: end });

/**
 * Fake database. select() answers by table: the source schedule (branch 1), the old schedule of the target (branch 2) and
 * the movies. delete() and insert() only build a statement; db.batch() runs them, so a failing batch changes nothing.
 */
function makeDb(options: { source: any[]; target?: any[]; movies?: any[]; failBatch?: boolean }) {
  const audit: any[] = [];
  const ran: Array<{ kind: string; values?: any }> = [];
  let selectsOnShowtimes = 0;

  const chain = (rows: any[]): any => {
    const object: any = { from: () => object, where: () => object, orderBy: () => object };
    object.then = (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject);
    return object;
  };

  const db: any = {
    select: () => ({
      from: (table: any) => {
        if (table === tables.movies) return chain(options.movies || []);
        selectsOnShowtimes += 1;
        // the first read of showtimes is the source, the second the target
        return chain(selectsOnShowtimes === 1 ? options.source : options.target || []);
      }
    }),
    delete: () => ({ where: () => ({ kind: 'delete' }) }),
    insert: (table: any) => ({
      values: (values: any) => {
        if (table === tables.auditLogs) {
          audit.push(values);
          return Promise.resolve();
        }
        return { kind: 'insert', values };
      }
    }),
    batch: vi.fn(async (statements: any[]) => {
      if (options.failBatch) throw new Error('batch failed');
      ran.push(...statements);
    })
  };
  return { db, audit, ran };
}

const movie = (id: number, overrides: Record<string, unknown> = {}) => ({ id, branch_ids: null, branch_id: null, ...overrides });

describe('copyShowtimesImpl', () => {
  it('replaces the target schedule with the source one in ONE batch: the delete first, then the inserts', async () => {
    const { db, ran } = makeDb({
      source: [slot(1, '09:00', '11:00'), slot(2, '12:00', '14:00')],
      target: [slot(1, '08:00', '10:00', 2)],
      movies: [movie(1), movie(2)]
    });

    const result: any = await copyShowtimesImpl(db, tables, { from_branch_id: 1, to_branch_id: 2 }, null, staff);

    expect(result).toMatchObject({ status: 'success', copied: 2, skipped: 0, replaced: 1 });
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(ran.map((statement) => statement.kind)).toEqual(['delete', 'insert', 'insert']);
    expect(ran[1].values).toMatchObject({ branch_id: 2, movie_id: 1, start_time: '09:00', end_time: '11:00' });
  });

  it('copies only movies that can be shown at the target branch, and says how many it skipped', async () => {
    const { db, ran } = makeDb({
      source: [slot(1, '09:00', '11:00'), slot(2, '12:00', '14:00'), slot(3, '15:00', '17:00'), slot(4, '18:00', '20:00')],
      movies: [
        movie(1),
        movie(2, { branch_ids: '[1]' }), // only branch 1
        movie(3, { branch_ids: '[1,2]' }), // both
        movie(5) // movie 4 is hidden or deleted: it is not in the list at all
      ]
    });

    const result: any = await copyShowtimesImpl(db, tables, { from_branch_id: 1, to_branch_id: 2 }, null, staff);

    expect(result).toMatchObject({ copied: 2, skipped: 2 });
    expect(ran.filter((statement) => statement.kind === 'insert').map((statement) => statement.values.movie_id)).toEqual([1, 3]);
  });

  it('removes nothing when no slot can be copied', async () => {
    const { db } = makeDb({ source: [slot(2, '12:00', '14:00')], target: [slot(1, '08:00', '10:00', 2)], movies: [movie(2, { branch_ids: '[1]' })] });

    const result: any = await copyShowtimesImpl(db, tables, { from_branch_id: 1, to_branch_id: 2 }, null, staff);

    expect(result.status).toBe('error');
    expect(result.statusCode).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('a failing batch leaves the old schedule alone: nothing ran', async () => {
    const { db, ran } = makeDb({ source: [slot(1, '09:00', '11:00')], movies: [movie(1)], failBatch: true });

    await expect(copyShowtimesImpl(db, tables, { from_branch_id: 1, to_branch_id: 2 }, null, staff)).rejects.toThrow('batch failed');

    expect(ran).toHaveLength(0);
  });

  it('the audit line keeps the schedule that was replaced and the number skipped', async () => {
    const { db, audit } = makeDb({
      source: [slot(1, '09:00', '11:00'), slot(2, '12:00', '14:00')],
      target: [slot(1, '08:00', '10:00', 2), slot(1, '10:30', '12:30', 2)],
      movies: [movie(1)]
    });

    await copyShowtimesImpl(db, tables, { from_branch_id: 1, to_branch_id: 2 }, null, staff);

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'copy', entityType: 'showtimes', staffId: 5 });
    expect(JSON.parse(audit[0].oldValues)).toHaveLength(2);
    expect(JSON.parse(audit[0].oldValues)[0].start_time).toBe('08:00');
  });

  it('refuses a missing branch, the same branch twice, a branch outside the staff scope and an empty source', async () => {
    const empty = makeDb({ source: [] });
    expect(((await copyShowtimesImpl(empty.db, tables, { from_branch_id: 0, to_branch_id: 2 }, null, staff)) as any).statusCode).toBe(400);
    expect(((await copyShowtimesImpl(empty.db, tables, { from_branch_id: 2, to_branch_id: 2 }, null, staff)) as any).statusCode).toBe(400);
    await expect(copyShowtimesImpl(empty.db, tables, { from_branch_id: 1, to_branch_id: 3 }, [1, 2], staff)).rejects.toMatchObject({ statusCode: 403 });
    expect(((await copyShowtimesImpl(empty.db, tables, { from_branch_id: 1, to_branch_id: 2 }, null, staff)) as any).statusCode).toBe(400);
    expect(empty.db.batch).not.toHaveBeenCalled();
  });
});
