import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

function esc(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  return s.replace(/'/g, "''");
}

async function main() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } as any });
  await client.connect();

  const moviesRes = await client.query(`
    SELECT id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active
    FROM movies
    ORDER BY id ASC
  `);
  const ticketsRes = await client.query(`
    SELECT id, name, price, is_active, display_order, created_at
    FROM ticket_packages
    ORDER BY display_order ASC, id ASC
  `);
  const toysRes = await client.query(`
    SELECT id, name, category, price, stock, status, image_url, created_at, updated_at
    FROM toys
    ORDER BY created_at DESC, id DESC
  `);

  const out: string[] = [];
  out.push(
    `CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, cover_image TEXT, detail_images TEXT, genres TEXT, rating REAL, duration_min INTEGER, release_date TEXT, is_active INTEGER DEFAULT 1);`
  );
  out.push(`DELETE FROM movies;`);
  for (const r of moviesRes.rows) {
    const detailImages = Array.isArray(r.detail_images) ? JSON.stringify(r.detail_images) : (r.detail_images ?? '[]');
    const genres = Array.isArray(r.genres) ? JSON.stringify(r.genres) : (r.genres ?? '[]');
    const ratingNum = r.rating === null || r.rating === undefined ? 0 : Number(r.rating);
    const durationMin = r.duration_min == null ? 'NULL' : Number(r.duration_min);
    const releaseDateStr =
      r.release_date instanceof Date
        ? (r.release_date as Date).toISOString()
        : r.release_date
          ? String(r.release_date)
          : null;
    const isActive = r.is_active ? 1 : 0;
    out.push(
      `INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (${Number(
        r.id
      )}, '${esc(r.title)}', ${r.description ? `'${esc(r.description)}'` : 'NULL'}, ${
        r.cover_image ? `'${esc(r.cover_image)}'` : 'NULL'
      }, '${esc(detailImages)}', '${esc(genres)}', ${Number.isFinite(ratingNum) ? ratingNum : 0}, ${durationMin}, ${
        releaseDateStr ? `'${esc(releaseDateStr)}'` : 'NULL'
      }, ${isActive});`
    );
  }

  out.push(
    `CREATE TABLE IF NOT EXISTS ticket_packages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, is_active INTEGER DEFAULT 1, display_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`
  );
  out.push(`DELETE FROM ticket_packages;`);
  for (const r of ticketsRes.rows) {
    const isActive = r.is_active ? 1 : 0;
    const createdAt = r.created_at instanceof Date ? (r.created_at as Date).toISOString() : String(r.created_at ?? '');
    out.push(
      `INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (${Number(
        r.id
      )}, '${esc(r.name)}', ${Number(r.price) || 0}, ${isActive}, ${Number(r.display_order) || 0}, '${
        esc(createdAt) || ''
      }');`
    );
  }

  out.push(
    `CREATE TABLE IF NOT EXISTS toys (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL, stock INTEGER, status TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`
  );
  out.push(`DELETE FROM toys;`);
  for (const r of toysRes.rows) {
    const createdAt = r.created_at instanceof Date ? (r.created_at as Date).toISOString() : String(r.created_at ?? '');
    out.push(
      `INSERT INTO toys (id, name, category, price, stock, status, image_url, created_at) VALUES (${Number(
        r.id
      )}, '${esc(r.name)}', ${r.category ? `'${esc(r.category)}'` : 'NULL'}, ${Number(r.price) || 0}, ${
        Number(r.stock) || 0
      }, ${r.status ? `'${esc(r.status)}'` : 'NULL'}, ${r.image_url ? `'${esc(r.image_url)}'` : 'NULL'}, '${
        esc(createdAt) || ''
      }');`
    );
  }

  const dir = path.resolve(process.cwd(), 'tmp');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  const filePath = path.join(dir, 'migrate_d1.sql');
  fs.writeFileSync(filePath, out.join('\n'), 'utf-8');
  await client.end();
  console.log(filePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
