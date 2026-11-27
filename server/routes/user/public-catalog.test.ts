import { describe, it, expect } from 'vitest';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import * as schema from '../../../shared/schema';
import {
  listPublicBranches,
  getPublicDefaultBranch,
  getPublicBranchPaymentInfo,
  paymentSettingsOnly,
  getPublicMovieDetail,
  listPublicSiteMedia,
  toPublicTicketPackage,
  toPublicVrPackage
} from './public-catalog';

const dialect = new SQLiteSyncDialect();
const sqlText = (condition: any) => dialect.sqlToQuery(condition).sql;

/** A fake drizzle db for select().from().where()[.orderBy()|.limit()] that records the columns and the filter. */
function selectDb(rows: any[]) {
  const seen: { columns?: Record<string, unknown>; where?: any } = {};
  const result: any = Promise.resolve(rows);
  result.orderBy = async () => rows;
  result.limit = async () => rows;
  const db: any = {
    select: (columns: Record<string, unknown>) => {
      seen.columns = columns;
      return { from: () => ({ where: (where: any) => ((seen.where = where), result) }) };
    }
  };
  return { db, seen };
}

const tables = {
  branches: schema.branches,
  movies: schema.movies,
  site_media: schema.site_media
};

describe('public branches', () => {
  it('the list selects only the public fields of active, open, not deleted branches', async () => {
    const { db, seen } = selectDb([{ id: 1 }]);

    expect(await listPublicBranches(db, tables)).toEqual([{ id: 1 }]);
    expect(Object.keys(seen.columns || {}).sort()).toEqual(
      ['address', 'banner_images', 'email', 'id', 'name', 'phone', 'settings'].sort()
    );
    const where = sqlText(seen.where);
    expect(where).toContain('"is_active"');
    expect(where).toContain('"is_open"');
    expect(where).toContain('"deleted_at" is null');
  });

  it('the default branch has the same fields, and null when there is none', async () => {
    const { db, seen } = selectDb([]);

    expect(await getPublicDefaultBranch(db, tables)).toBeNull();
    expect(Object.keys(seen.columns || {})).toContain('settings');
    expect(sqlText(seen.where)).toContain('"is_default"');
  });

  it('the payment info keeps only the bank account of the settings', async () => {
    const settings = JSON.stringify({
      hotline: '0900',
      payment_config: { bank_code: 'VCB', account_number: '123', account_name: 'CINE' }
    });
    const { db, seen } = selectDb([{ id: 2, name: 'B', settings }]);

    const branch = await getPublicBranchPaymentInfo(db, tables, 2);

    expect(Object.keys(seen.columns || {}).sort()).toEqual(['id', 'name', 'settings']);
    expect(branch).toEqual({
      id: 2,
      name: 'B',
      settings: JSON.stringify({ payment_config: { bank_code: 'VCB', account_number: '123', account_name: 'CINE' } })
    });
  });

  it('the payment info of a bad id does not query', async () => {
    const db: any = {
      select: () => {
        throw new Error('should not run');
      }
    };
    expect(await getPublicBranchPaymentInfo(db, tables, Number('abc'))).toBeNull();
  });

  it('settings without a bank account, or broken settings, give null', () => {
    expect(paymentSettingsOnly(JSON.stringify({ hotline: '0900' }))).toBeNull();
    expect(paymentSettingsOnly('{broken')).toBeNull();
    expect(paymentSettingsOnly(null)).toBeNull();
  });
});

describe('public movie detail', () => {
  it('reads only an active, not deleted movie, with named columns and the genres as a list', async () => {
    let query: any = null;
    const db: any = {
      query: {
        movies: {
          findFirst: async (options: any) => {
            query = options;
            return { id: 3, title: 'Phim', genres: '[{"name":"Hành động"}]', rating: 8 };
          }
        }
      }
    };

    const movie = await getPublicMovieDetail(db, tables, 3);

    expect(movie).toEqual({ id: 3, title: 'Phim', genres: [{ name: 'Hành động' }], rating: 8 });
    expect(Object.keys(query.columns).sort()).toEqual(
      ['cover_image', 'description', 'duration_min', 'genres', 'id', 'rating', 'release_date', 'title'].sort()
    );
    const where = sqlText(query.where);
    expect(where).toContain('"is_active"');
    expect(where).toContain('"deleted_at" is null');
  });

  it('a missing movie gives null', async () => {
    const db: any = { query: { movies: { findFirst: async () => undefined } } };
    expect(await getPublicMovieDetail(db, tables, 3)).toBeNull();
  });
});

describe('public site media', () => {
  it('always filters active, not deleted and offered at the branch, and selects only what the home page reads', async () => {
    const { db, seen } = selectDb([]);

    await listPublicSiteMedia(db, tables, { section: 'hero_section', branch_id: 2 });

    expect(Object.keys(seen.columns || {}).sort()).toEqual(['description', 'id', 'section', 'title', 'type', 'url']);
    const where = sqlText(seen.where);
    expect(where).toContain('"is_active"');
    expect(where).toContain('"deleted_at" is null');
    expect(where).toContain('"section"');
    // Media of every branch, or linked to the asked branch
    expect(where).toContain('"all_branches" = 1');
    expect(where).toContain('"site_media_branches"');
  });
});

describe('package trimming', () => {
  it('a ticket package keeps what the price section and the booking page read', () => {
    const trimmed = toPublicTicketPackage({
      id: 1,
      name: 'Vé',
      price: 1,
      is_member_only: false,
      code: 'X',
      created_at: 'c',
      movies: [{ id: 3, title: 'P', cover_image: 'p.jpg', duration_min: 90, description: 'long text', all_branches: 1 }]
    });

    expect(trimmed).not.toHaveProperty('is_member_only');
    expect(trimmed).not.toHaveProperty('code');
    expect(trimmed.movies[0]).not.toHaveProperty('description');
    // The movies are already those of the asked branch: no branch scope is sent
    expect(trimmed.movies[0]).not.toHaveProperty('all_branches');
    expect(trimmed.movies[0]).toEqual({ id: 3, title: 'P', cover_image: 'p.jpg', duration_min: 90 });
  });

  it('a VR package keeps what the VR section reads', () => {
    const trimmed = toPublicVrPackage({ id: 5, name: 'VR', is_member_only: true, branch_ids_parsed: [1], max_players: 4 });

    expect(trimmed).not.toHaveProperty('is_member_only');
    expect(trimmed).not.toHaveProperty('branch_ids_parsed');
    expect(trimmed.max_players).toBe(4);
  });
});
