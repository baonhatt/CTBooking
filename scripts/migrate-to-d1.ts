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
  const postsRes = await client.query(`
    SELECT id, title, slug, content, excerpt, featured_image, author_id, status, is_featured, view_count, published_at, created_at, updated_at
    FROM posts
    ORDER BY created_at DESC
  `);
  const mediaRes = await client.query(`
    SELECT id, section, type, title, description, public_id, url, format, width, height, duration, display_order, is_active, created_at, updated_at
    FROM site_media
    ORDER BY display_order ASC, created_at DESC
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

  out.push(
    `CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE, content TEXT NOT NULL, excerpt TEXT, featured_image TEXT, author_id INTEGER, status TEXT DEFAULT 'draft', is_featured INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0, published_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`
  );
  out.push(`DELETE FROM posts;`);
  for (const r of postsRes.rows) {
    const pubAt = r.published_at instanceof Date ? r.published_at.toISOString() : (r.published_at ? String(r.published_at) : null);
    const crAt = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? '');
    const upAt = r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? '');
    const isFeatured = r.is_featured ? 1 : 0;
    out.push(
      `INSERT INTO posts (id, title, slug, content, excerpt, featured_image, author_id, status, is_featured, view_count, published_at, created_at, updated_at) VALUES (${Number(
        r.id
      )}, '${esc(r.title)}', ${r.slug ? `'${esc(r.slug)}'` : 'NULL'}, '${esc(r.content)}', ${
        r.excerpt ? `'${esc(r.excerpt)}'` : 'NULL'
      }, ${r.featured_image ? `'${esc(r.featured_image)}'` : 'NULL'}, ${
        r.author_id ? Number(r.author_id) : 'NULL'
      }, '${esc(r.status)}', ${isFeatured}, ${Number(r.view_count) || 0}, ${
        pubAt ? `'${esc(pubAt)}'` : 'NULL'
      }, '${esc(crAt)}', '${esc(upAt)}');`
    );
  }

  out.push(
    `CREATE TABLE IF NOT EXISTS site_media (id INTEGER PRIMARY KEY, section TEXT NOT NULL, type TEXT NOT NULL, title TEXT, description TEXT, public_id TEXT, url TEXT NOT NULL, format TEXT, width INTEGER, height INTEGER, duration REAL, display_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`
  );
  out.push(`DELETE FROM site_media;`);
  for (const r of mediaRes.rows) {
    const crAt = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? '');
    const upAt = r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? '');
    const isActive = r.is_active ? 1 : 0;
    out.push(
      `INSERT INTO site_media (id, section, type, title, description, public_id, url, format, width, height, duration, display_order, is_active, created_at, updated_at) VALUES (${Number(
        r.id
      )}, '${esc(r.section)}', '${esc(r.type)}', ${r.title ? `'${esc(r.title)}'` : 'NULL'}, ${
        r.description ? `'${esc(r.description)}'` : 'NULL'
      }, ${r.public_id ? `'${esc(r.public_id)}'` : 'NULL'}, '${esc(r.url)}', ${
        r.format ? `'${esc(r.format)}'` : 'NULL'
      }, ${r.width || 'NULL'}, ${r.height || 'NULL'}, ${r.duration || 'NULL'}, ${
        r.display_order || 0
      }, ${isActive}, '${esc(crAt)}', '${esc(upAt)}');`
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
