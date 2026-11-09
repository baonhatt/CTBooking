import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../../shared/schema';

// A real in-memory SQLite database for tests, so a query's WHERE clause is actually run.
// Tables are created from the drizzle schema (column names and types only: no keys or defaults are needed here).

/** Makes a database with the given schema tables created and returns the drizzle handle and the raw database. */
export function makeSqliteDb(tableNames: string[]) {
  const raw = new DatabaseSync(':memory:');

  for (const name of tableNames) {
    const table = (schema as any)[name];
    const config = getTableConfig(table);
    const columns = config.columns.map((column: any) => '"' + column.name + '" ' + column.getSQLType()).join(', ');
    raw.exec('CREATE TABLE "' + config.name + '" (' + columns + ')');
  }

  const db = drizzle(
    async (sqlText: string, params: any[], method: string) => {
      const statement = raw.prepare(sqlText);
      if (method === 'run') {
        statement.run(...params);
        return { rows: [] };
      }
      statement.setReturnArrays(true);
      const rows = statement.all(...params) as any[];
      return { rows: method === 'get' ? rows[0] : rows };
    },
    { schema }
  );

  return { db: db as any, raw };
}

/** Inserts rows by column name into a table. Missing columns stay NULL. */
export function insertRows(raw: DatabaseSync, tableName: string, rows: Array<Record<string, unknown>>) {
  const config = getTableConfig((schema as any)[tableName]);
  for (const row of rows) {
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map((key) => {
      const value = row[key];
      if (typeof value === 'boolean') return value ? 1 : 0;
      return value === undefined ? null : (value as any);
    });
    raw
      .prepare('INSERT INTO "' + config.name + '" (' + keys.map((key) => '"' + key + '"').join(', ') + ') VALUES (' + placeholders + ')')
      .run(...values);
  }
}
