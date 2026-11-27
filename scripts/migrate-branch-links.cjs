// Moves the branch data of the old JSON columns into the link tables of migration 0005, checks the result, and (only
// for a rollback) writes the link tables back into the old columns. Plan: docs/ke-hoach-tai-cau-truc-chi-nhanh.md.
//
// It only READS the database. Every write is put in a SQL file that a person reads before running it with
// `npx wrangler d1 execute <db> <place> --config worker/wrangler.toml --file <file.sql>`.
// Place options (every command):
//   --local                     the local database (wrangler dev --local)
//   --remote                    the live database (cinema-db)
//   --remote --env preview      the preview database
//
// Commands, in the order of a run:
//   snapshot <place> --out before.json    counts and money totals of the orders
//   generate <place> --out branch-links.sql
//   (read branch-links.sql, run it)
//   verify <place>                        old columns = new tables, every order and VR line has a branch
//   snapshot <place> --out after.json
//   compare before.json after.json        every count and total must be equal
//   reverse <place> --out old-columns.sql ONLY to go back to the old code: old columns from the link tables
//
// What the generated SQL does (and nothing else):
//   - fills the link tables and the new flags (all_branches, movie_scope, all_packages) from the old columns. The old
//     columns are never changed.
//   - orders made before the first branch existed (branch_id empty) get the default branch; VR lines without a branch
//     get the branch of their order. Only empty cells are filled.
// It refuses to generate when a link table already has rows (the new code may be live: rebuilding from the old
// columns would undo changes made in the new admin screens). --force empties the link tables first and rebuilds them;
// use it only before the new code is deployed (rehearsal, or the minutes between migration and deploy).

const { execSync } = require('child_process');
const fs = require('fs');

// ==================== PLACE AND QUERIES ====================

const args = process.argv.slice(2);
const command = args[0];
const place = {
  remote: args.includes('--remote'),
  local: args.includes('--local'),
  env: args.includes('--env') ? args[args.indexOf('--env') + 1] : null
};
const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const force = args.includes('--force');
const databaseName = place.env === 'preview' ? 'cinema-db-preview' : 'cinema-db';

function placeArgs() {
  const list = [place.remote ? '--remote' : '--local'];
  if (place.env) list.push('--env', place.env);
  return list;
}

/** Runs one SELECT and returns its rows. Refuses anything but a SELECT. */
function select(sqlText) {
  if (!/^\s*select\b/i.test(sqlText)) throw new Error('only SELECT is run by this script: ' + sqlText.slice(0, 60));
  // One line in double quotes: npx needs a shell on Windows, which would otherwise split the query at its spaces
  const oneLine = sqlText.replace(/\s+/g, ' ').trim();
  if (oneLine.includes('"')) throw new Error('a query here may not hold a double quote');
  const commandLine = ['npx wrangler d1 execute', databaseName, ...placeArgs(), '--config worker/wrangler.toml --json --command', `"${oneLine}"`].join(' ');
  const output = execSync(commandLine, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(firstJsonArray(output))[0].results || [];
}

/** The first JSON array in wrangler's output (it may print notes before and after it). */
function firstJsonArray(text) {
  const start = text.indexOf('[');
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      if (character === '\\') index++;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === '[' || character === '{') depth++;
    else if (character === ']' || character === '}') {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('no JSON result in the wrangler output');
}

/** A text value for SQL ('' doubles a quote). */
function sqlText(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// ==================== READING THE OLD COLUMNS ====================

/** Ids in a JSON list or in an old hand-written list ("[4, 5]", "1|2|3"); null for NULL. */
function readIdList(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === '' || text === 'null') return null;
  const ids = [];
  for (const match of text.matchAll(/\d+/g)) {
    const id = Number(match[0]);
    if (id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function loadOld() {
  return {
    branches: select('SELECT id, is_default, created_at, deleted_at FROM branches ORDER BY id'),
    movies: select('SELECT id, title AS name, NULL AS code, branch_ids, deleted_at FROM movies ORDER BY id'),
    packages: select('SELECT id, name, code, type, branch_ids, combo, deleted_at FROM ticket_packages ORDER BY id'),
    vouchers: select('SELECT id, name, code, scope, branch_ids, applicable_ticket_package_ids, deleted_at FROM vouchers ORDER BY id'),
    posts: select('SELECT id, title AS name, slug AS code, branch_ids, NULL AS deleted_at FROM posts ORDER BY id'),
    media: select('SELECT id, title AS name, section AS code, branch_ids, deleted_at FROM site_media ORDER BY id')
  };
}

/**
 * What each record should be in the new tables, from its old columns (the rules the old code used):
 *   movies, packages, posts, media: NULL = every branch, "[]" = no branch, a list = those branches;
 *   vouchers: NULL or "[]" = every branch; package list NULL or "[]" = every package;
 *   movie packages: an empty combo meant "every movie of the branch".
 */
function expectedState(old, problems) {
  const branchIds = new Set(old.branches.map((row) => Number(row.id)));
  const movieIds = new Set(old.movies.map((row) => Number(row.id)));
  const packageIds = new Set(old.packages.map((row) => Number(row.id)));

  const keepKnown = (ids, known, what) =>
    ids.filter((id) => {
      if (known.has(id)) return true;
      problems.push(`${what}: id ${id} does not exist, skipped`);
      return false;
    });

  const scoped = (rows, kind) =>
    rows.map((row) => {
      const ids = readIdList(row.branch_ids);
      return {
        id: Number(row.id),
        name: row.name,
        code: row.code,
        deleted: Boolean(row.deleted_at),
        all_branches: ids === null,
        branch_ids: ids === null ? [] : keepKnown(ids, branchIds, `${kind} #${row.id} branch`)
      };
    });

  const packages = scoped(old.packages, 'package').map((pkg, index) => {
    const row = old.packages[index];
    const isVr = row.type === 'vr';
    const combo = readIdList(row.combo) || [];
    const movieScope = !isVr && combo.length === 0 ? 'all_at_branch' : 'selected';
    return { ...pkg, movie_scope: movieScope, movie_ids: isVr ? [] : keepKnown(combo, movieIds, `package #${row.id} movie`) };
  });

  const vouchers = old.vouchers.map((row) => {
    const ids = readIdList(row.branch_ids);
    const packageList = readIdList(row.applicable_ticket_package_ids);
    const allBranches = ids === null || ids.length === 0;
    const allPackages = packageList === null || packageList.length === 0;
    return {
      id: Number(row.id),
      name: row.name,
      code: row.code,
      deleted: Boolean(row.deleted_at),
      all_branches: allBranches,
      branch_ids: allBranches ? [] : keepKnown(ids, branchIds, `voucher #${row.id} branch`),
      all_packages: allPackages,
      package_ids: allPackages ? [] : keepKnown(packageList, packageIds, `voucher #${row.id} package`)
    };
  });

  return {
    movies: scoped(old.movies, 'movie'),
    packages,
    vouchers,
    posts: scoped(old.posts, 'post'),
    media: scoped(old.media, 'media')
  };
}

const LINKS = {
  movies: { table: 'movies', link: 'movie_branches', key: 'movie_id', label: 'Phim' },
  packages: { table: 'ticket_packages', link: 'package_branches', key: 'package_id', label: 'Gói vé' },
  vouchers: { table: 'vouchers', link: 'voucher_branches', key: 'voucher_id', label: 'Voucher' },
  posts: { table: 'posts', link: 'post_branches', key: 'post_id', label: 'Bài viết' },
  media: { table: 'site_media', link: 'site_media_branches', key: 'media_id', label: 'Ảnh/video' }
};

/** Records (not deleted) that will be offered nowhere: no "every branch" and no branch. The user links them in admin. */
function unassignedRecords(expected) {
  const list = [];
  for (const [kind, config] of Object.entries(LINKS)) {
    for (const record of expected[kind]) {
      if (!record.deleted && !record.all_branches && record.branch_ids.length === 0) {
        list.push(`${config.label} #${record.id} ${record.name || ''}${record.code ? ' (' + record.code + ')' : ''}`);
      }
    }
  }
  return list;
}

// ==================== GENERATE ====================

function generate() {
  const linkRows = Object.values(LINKS)
    .map((config) => config.link)
    .concat(['package_movies', 'voucher_packages'])
    .map((table) => Number(select(`SELECT COUNT(*) AS n FROM ${table}`)[0].n))
    .reduce((sum, n) => sum + n, 0);
  if (linkRows > 0 && !force) {
    throw new Error(
      `the link tables already hold ${linkRows} rows. If the new code is live, they hold changes made in the new admin ` +
        'screens and must not be rebuilt. Before the deploy (rehearsal / switch), pass --force to empty and rebuild them.'
    );
  }
  const old = loadOld();
  const problems = [];
  const expected = expectedState(old, problems);
  const lines = [];
  const say = (text) => lines.push(text);

  say('-- Generated by scripts/migrate-branch-links.cjs at ' + new Date().toISOString() + ' from ' + databaseName + ' ' + placeArgs().join(' '));
  say('-- Read it before running. It changes no old column, no amount and no order status.');
  say('');
  if (force) {
    say('-- --force: the link tables are emptied and rebuilt from the old columns');
    for (const table of Object.values(LINKS).map((config) => config.link).concat(['package_movies', 'voucher_packages'])) {
      say(`DELETE FROM ${table};`);
    }
    say('');
  }

  for (const [kind, config] of Object.entries(LINKS)) {
    const records = expected[kind];
    say(`-- ===== ${config.table}: ${records.length} rows =====`);
    for (const record of records) {
      say(`UPDATE ${config.table} SET all_branches = ${record.all_branches ? 1 : 0} WHERE id = ${record.id};`);
      for (const branchId of record.branch_ids) {
        say(`INSERT INTO ${config.link} (${config.key}, branch_id) VALUES (${record.id}, ${branchId});`);
      }
    }
    say('');
  }

  say('-- ===== package movies =====');
  for (const pkg of expected.packages) {
    say(`UPDATE ticket_packages SET movie_scope = '${pkg.movie_scope}' WHERE id = ${pkg.id};`);
    for (const movieId of pkg.movie_ids) {
      say(`INSERT INTO package_movies (package_id, movie_id) VALUES (${pkg.id}, ${movieId});`);
    }
  }
  say('');

  say('-- ===== voucher packages =====');
  for (const voucher of expected.vouchers) {
    say(`UPDATE vouchers SET all_packages = ${voucher.all_packages ? 1 : 0} WHERE id = ${voucher.id};`);
    for (const packageId of voucher.package_ids) {
      say(`INSERT INTO voucher_packages (voucher_id, package_id) VALUES (${voucher.id}, ${packageId});`);
    }
  }
  say('');

  // Orders made before the first branch existed belong to the default branch (the only cinema then). Approved by
  // the user (plan section 9, steps G and H).
  const live = old.branches.filter((row) => !row.deleted_at);
  const defaultBranch = live.find((row) => Number(row.is_default) === 1);
  if (!defaultBranch) throw new Error('no default branch');
  const firstBranchAt = old.branches.map((row) => String(row.created_at)).sort()[0];
  const orphanOrders = Number(select('SELECT COUNT(*) AS n FROM bookings WHERE branch_id IS NULL')[0].n);
  const beforeBranches = Number(
    select(`SELECT COUNT(*) AS n FROM bookings WHERE branch_id IS NULL AND created_at < '${firstBranchAt}'`)[0].n
  );
  if (orphanOrders !== beforeBranches) {
    problems.push(`${orphanOrders - beforeBranches} orders without a branch were made AFTER the first branch: left as they are`);
  }
  say(`-- ===== orders without a branch: ${beforeBranches} made before ${firstBranchAt} -> default branch #${defaultBranch.id} =====`);
  say(`UPDATE bookings SET branch_id = ${Number(defaultBranch.id)} WHERE branch_id IS NULL AND created_at < '${firstBranchAt}';`);
  say('UPDATE booking_vr_items SET branch_id = (SELECT b.branch_id FROM bookings b WHERE b.id = booking_vr_items.booking_id)');
  say('  WHERE branch_id IS NULL AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_vr_items.booking_id AND b.branch_id IS NOT NULL);');

  if (!outPath) throw new Error('--out <file.sql> is needed');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log('Written ' + outPath + ' (' + lines.length + ' lines).');
  for (const kind of Object.keys(LINKS)) {
    const records = expected[kind];
    console.log(
      `  ${kind}: ${records.length} rows, ${records.filter((r) => r.all_branches).length} every branch, ` +
        `${records.reduce((sum, r) => sum + r.branch_ids.length, 0)} links`
    );
  }
  console.log(
    `  package movies: ${expected.packages.filter((p) => p.movie_scope === 'all_at_branch').length} every movie of the branch, ` +
      `${expected.packages.reduce((sum, p) => sum + p.movie_ids.length, 0)} selected links`
  );
  console.log(`  orders to give the default branch: ${beforeBranches}`);
  reportUnassigned(expected);
  if (problems.length) {
    console.log('Problems (read them):');
    for (const problem of problems) console.log('  - ' + problem);
  }
}

function reportUnassigned(expected) {
  const unassigned = unassignedRecords(expected);
  console.log(`Chưa gắn chi nhánh (không hiện ở đâu, cần vào admin gắn chi nhánh rồi lưu): ${unassigned.length}`);
  for (const line of unassigned) console.log('  - ' + line);
}

// ==================== VERIFY ====================

function verify() {
  const old = loadOld();
  const expected = expectedState(old, []);
  const failures = [];
  const groupIds = (rows, key) => {
    const map = new Map();
    for (const row of rows) {
      const id = Number(row[key]);
      map.set(id, [...(map.get(id) || []), Number(row.value)].sort((a, b) => a - b));
    }
    return map;
  };
  const sameList = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));

  for (const [kind, config] of Object.entries(LINKS)) {
    const flags = new Map(select(`SELECT id, all_branches FROM ${config.table}`).map((row) => [Number(row.id), Number(row.all_branches) === 1]));
    const links = groupIds(select(`SELECT ${config.key}, branch_id AS value FROM ${config.link}`), config.key);
    for (const record of expected[kind]) {
      if (flags.get(record.id) !== record.all_branches) failures.push(`${config.table} #${record.id}: all_branches differs`);
      if (!sameList(links.get(record.id) || [], record.branch_ids)) failures.push(`${config.table} #${record.id}: branches differ`);
    }
  }
  const scopes = new Map(select('SELECT id, movie_scope FROM ticket_packages').map((row) => [Number(row.id), row.movie_scope]));
  const packageMovies = groupIds(select('SELECT package_id, movie_id AS value FROM package_movies'), 'package_id');
  for (const pkg of expected.packages) {
    if (scopes.get(pkg.id) !== pkg.movie_scope) failures.push(`package #${pkg.id}: movie_scope differs`);
    if (!sameList(packageMovies.get(pkg.id) || [], pkg.movie_ids)) failures.push(`package #${pkg.id}: movies differ`);
  }
  const allPackages = new Map(select('SELECT id, all_packages FROM vouchers').map((row) => [Number(row.id), Number(row.all_packages) === 1]));
  const voucherPackages = groupIds(select('SELECT voucher_id, package_id AS value FROM voucher_packages'), 'voucher_id');
  for (const voucher of expected.vouchers) {
    if (allPackages.get(voucher.id) !== voucher.all_packages) failures.push(`voucher #${voucher.id}: all_packages differs`);
    if (!sameList(voucherPackages.get(voucher.id) || [], voucher.package_ids)) failures.push(`voucher #${voucher.id}: packages differ`);
  }

  // Every order and VR line must have a branch (plan 5.1 point 3)
  const orderChecks = {
    'orders without a branch': 'SELECT COUNT(*) AS n FROM bookings WHERE branch_id IS NULL',
    'VR lines without a branch': 'SELECT COUNT(*) AS n FROM booking_vr_items WHERE branch_id IS NULL'
  };
  for (const [label, sqlQuery] of Object.entries(orderChecks)) {
    const n = Number(select(sqlQuery)[0].n);
    if (n !== 0) failures.push(`${label}: ${n}`);
  }

  reportUnassigned(expected);
  if (failures.length) {
    console.log('VERIFY FAILED:');
    for (const failure of failures) console.log('  - ' + failure);
    process.exit(1);
  }
  console.log('Verify OK: every link table matches the old columns, every order and VR line has a branch.');
}

// ==================== CHECK (any time after the switch) ====================

/** Weekly check on the new tables: orders and VR lines without a branch must be 0; unassigned records are warnings. */
function check() {
  const failures = [];
  for (const [label, sqlQuery] of Object.entries({
    'orders without a branch': 'SELECT COUNT(*) AS n FROM bookings WHERE branch_id IS NULL',
    'VR lines without a branch': 'SELECT COUNT(*) AS n FROM booking_vr_items WHERE branch_id IS NULL'
  })) {
    const n = Number(select(sqlQuery)[0].n);
    console.log(`${label}: ${n}`);
    if (n !== 0) failures.push(label);
  }
  const warnings = [];
  for (const [kind, config] of Object.entries(LINKS)) {
    const deleted = kind === 'posts' ? '1 = 1' : 'r.deleted_at IS NULL';
    const rows = select(
      `SELECT r.id AS id FROM ${config.table} r WHERE ${deleted} AND r.all_branches = 0
         AND NOT EXISTS (SELECT 1 FROM ${config.link} l WHERE l.${config.key} = r.id)`
    );
    for (const row of rows) warnings.push(`${config.label} #${row.id}`);
  }
  console.log(`Cảnh báo - chưa gắn chi nhánh: ${warnings.length}${warnings.length ? ' (' + warnings.join(', ') + ')' : ''}`);
  if (failures.length) process.exit(1);
}

// ==================== REVERSE (rollback only) ====================

/**
 * SQL that writes the link tables back into the old columns, for every record (also the ones created by the new
 * code), so the old code shows each record where the new code showed it. Only for going back to the old code.
 * Old rules it writes: branch_ids NULL = every branch, a JSON list = those branches; branch_id = the first branch.
 * "Not linked to any branch": movies and packages get "[]" (the old code shows them nowhere); vouchers, posts and media
 * get [0] (no such branch id: nowhere), because the old code read their "[]" as every branch. A voucher limited to no
 * package gets [0] too. Packages: combo NULL = every movie of the branch, a list = those movies. (A "selected" package
 * with no movie cannot be saved by the new code; the old code would read an empty combo as every movie.)
 */
function reverse() {
  const lines = ['-- Generated by scripts/migrate-branch-links.cjs reverse at ' + new Date().toISOString(),
    '-- ROLLBACK ONLY: writes the old columns from the link tables. Changes no amount and no order.', ''];
  const groups = (table, key, value) => {
    const map = new Map();
    for (const row of select(`SELECT ${key} AS id, ${value} AS value FROM ${table} ORDER BY ${value}`)) {
      map.set(Number(row.id), [...(map.get(Number(row.id)) || []), Number(row.value)]);
    }
    return map;
  };
  const listText = (ids) => sqlText(JSON.stringify(ids));

  for (const [kind, config] of Object.entries(LINKS)) {
    const links = groups(config.link, config.key, 'branch_id');
    const rows = select(`SELECT id, all_branches FROM ${config.table}`);
    lines.push(`-- ===== ${config.table} =====`);
    for (const row of rows) {
      const ids = links.get(Number(row.id)) || [];
      const all = Number(row.all_branches) === 1;
      let branchIds;
      const emptyMeansEvery = kind === 'vouchers' || kind === 'posts' || kind === 'media';
      if (all) branchIds = 'NULL';
      else branchIds = listText(ids.length || !emptyMeansEvery ? ids : [0]);
      const firstBranch = kind === 'movies' || kind === 'packages' ? `, branch_id = ${all || !ids.length ? 'NULL' : ids[0]}` : '';
      lines.push(`UPDATE ${config.table} SET branch_ids = ${branchIds}${firstBranch} WHERE id = ${row.id};`);
    }
    lines.push('');
  }

  const packageMovies = groups('package_movies', 'package_id', 'movie_id');
  lines.push('-- ===== package movies (combo) =====');
  for (const row of select("SELECT id, type, movie_scope FROM ticket_packages")) {
    if (row.type === 'vr') continue;
    const ids = packageMovies.get(Number(row.id)) || [];
    const combo = row.movie_scope === 'all_at_branch' ? 'NULL' : listText(ids);
    lines.push(`UPDATE ticket_packages SET combo = ${combo} WHERE id = ${row.id};`);
  }
  lines.push('');

  const voucherPackages = groups('voucher_packages', 'voucher_id', 'package_id');
  lines.push('-- ===== voucher packages =====');
  for (const row of select('SELECT id, all_packages FROM vouchers')) {
    const ids = voucherPackages.get(Number(row.id)) || [];
    const value = Number(row.all_packages) === 1 ? 'NULL' : listText(ids.length ? ids : [0]);
    lines.push(`UPDATE vouchers SET applicable_ticket_package_ids = ${value} WHERE id = ${row.id};`);
  }

  if (!outPath) throw new Error('--out <file.sql> is needed');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log('Written ' + outPath + ' (' + lines.length + ' lines). Read it; run it only to go back to the old code.');
}

// ==================== SNAPSHOT AND COMPARE ====================

/** Counts and money totals that must not move: orders by status, amounts, used tickets, VR lines, voucher logs. */
function snapshot() {
  const result = {
    orders_by_status: select(
      `SELECT COALESCE(payment_status, '') AS status, COUNT(*) AS orders,
         ROUND(COALESCE(SUM(total_price), 0), 2) AS total_price,
         ROUND(COALESCE(SUM(original_total_price), 0), 2) AS original_total_price,
         ROUND(COALESCE(SUM(voucher_discount_amount), 0), 2) AS voucher_discount_amount,
         SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) AS used,
         COUNT(checked_in_at) AS with_check_in,
         COUNT(booking_code) AS with_code
       FROM bookings GROUP BY COALESCE(payment_status, '') ORDER BY 1`
    ),
    vr_lines: select('SELECT COUNT(*) AS lines, ROUND(COALESCE(SUM(line_total), 0), 2) AS line_total FROM booking_vr_items'),
    voucher_logs: select('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(discount_amount_applied), 0), 2) AS discount FROM voucher_redemption_logs'),
    unmatched_transfers: select('SELECT COUNT(*) AS n FROM unmatched_transfers'),
    rows: select(
      `SELECT (SELECT COUNT(*) FROM bookings) AS bookings, (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM movies) AS movies, (SELECT COUNT(*) FROM ticket_packages) AS packages,
         (SELECT COUNT(*) FROM vouchers) AS vouchers, (SELECT COUNT(*) FROM posts) AS posts,
         (SELECT COUNT(*) FROM site_media) AS media, (SELECT COUNT(*) FROM showtimes) AS showtimes,
         (SELECT COUNT(*) FROM branches) AS branches, (SELECT COUNT(*) FROM staffs) AS staffs,
         (SELECT COUNT(*) FROM audit_logs) AS audit_logs`
    )
  };
  if (!outPath) throw new Error('--out <file.json> is needed');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('Written ' + outPath);
  console.log(JSON.stringify(result, null, 2));
}

function compare() {
  const [beforePath, afterPath] = args.slice(1, 3);
  const before = fs.readFileSync(beforePath, 'utf8');
  const after = fs.readFileSync(afterPath, 'utf8');
  if (before !== after) {
    console.log('COMPARE FAILED: the counts or totals moved.');
    console.log('--- before\n' + before + '\n--- after\n' + after);
    process.exit(1);
  }
  console.log('Compare OK: every order count and money total is exactly the same.');
}

// ==================== MAIN ====================

const commands = { generate, verify, check, reverse, snapshot, compare };
if (!commands[command]) {
  console.log('Usage: node scripts/migrate-branch-links.cjs <generate|verify|check|reverse|snapshot|compare> (--local | --remote [--env preview]) [--out file] [--force]');
  process.exit(2);
}
if (command !== 'compare' && !place.local && !place.remote) {
  console.log('Say where: --local, or --remote (live), or --remote --env preview.');
  process.exit(2);
}
try {
  commands[command]();
} catch (error) {
  console.error('Stopped: ' + error.message);
  process.exit(1);
}
