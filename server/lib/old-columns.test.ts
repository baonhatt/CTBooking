import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../../shared/schema';

// The branch data model moved from JSON text columns to link tables. These checks keep the old columns and the code
// that read them from coming back.

const ROOT = join(__dirname, '..', '..');

/** The JSON / legacy columns that were removed from the catalog tables. */
const REMOVED_COLUMNS = [
  'branch_id',
  'branch_ids',
  'combo',
  'applicable_ticket_package_ids',
  'excluded_ticket_package_ids',
  'applicable_user_ids'
];

/** Folders scanned for old-model code, and files that may keep the old names on purpose. */
const SCANNED_FOLDERS = ['server', join('worker', 'src'), 'shared', 'client', join('next-client', 'src')];
const SKIPPED_FILES = [join('client', 'lib', 'audit-diff.ts')]; // keeps labels for old audit log rows
const SKIPPED_FOLDERS = ['node_modules', 'scripts', '.next', 'dist'];

/** Text that only the old model used. */
const FORBIDDEN_TEXT = [
  'json_each(',
  'parseBranchIds',
  'lib/branch-ids',
  'applicable_ticket_package_ids',
  'excluded_ticket_package_ids',
  'applicable_user_ids',
  'branch_ids_parsed'
];

/** A ticket package's combo (bookings.combo, the order snapshot, stays allowed). */
const PACKAGE_COMBO = /\b(ticket_packages|pkg|pkgs|ticketPackage|packages)\.combo\b/;

function columnNames(table: any): string[] {
  return getTableConfig(table).columns.map((column: any) => column.name);
}

function sourceFiles(folder: string): string[] {
  const found: string[] = [];
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) {
        if (!SKIPPED_FOLDERS.includes(name)) walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
      if (SKIPPED_FILES.includes(relative(ROOT, full))) continue;
      found.push(full);
    }
  };
  walk(join(ROOT, folder));
  return found;
}

describe('the old branch columns are gone from the schema', () => {
  it.each(['movies', 'ticket_packages', 'vouchers', 'posts', 'site_media'])('%s has none of the removed columns', (tableName) => {
    const columns = columnNames((schema as any)[tableName]);
    expect(columns.filter((name) => REMOVED_COLUMNS.includes(name))).toEqual([]);
    expect(columns).toContain('all_branches');
  });

  it('bookings keeps the order snapshot (combo) and the check-in columns', () => {
    const columns = columnNames((schema as any).bookings);
    expect(columns).toEqual(expect.arrayContaining(['combo', 'is_used', 'checked_in_at', 'branch_id']));
  });
});

describe('no code reads the old model', () => {
  const files = SCANNED_FOLDERS.flatMap(sourceFiles);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((file) => file.endsWith(join('lib', 'catalog-scope.ts')))).toBe(true);
  });

  it('no old helper, JSON function or removed column name is used', () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const text of FORBIDDEN_TEXT) {
          if (line.includes(text)) hits.push(`${relative(ROOT, file).split(sep).join('/')}:${index + 1}: ${text}`);
        }
        if (PACKAGE_COMBO.test(line)) hits.push(`${relative(ROOT, file).split(sep).join('/')}:${index + 1}: package .combo`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('the package combo pattern tells a package from an order', () => {
    expect(PACKAGE_COMBO.test('const ids = pkg.combo;')).toBe(true);
    expect(PACKAGE_COMBO.test('tables.ticket_packages.combo')).toBe(true);
    expect(PACKAGE_COMBO.test('bookings.combo')).toBe(false);
    expect(PACKAGE_COMBO.test('b.combo')).toBe(false);
  });
});
