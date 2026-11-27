import { and, asc, eq, getTableName, inArray, isNull, notInArray, sql, SQL } from 'drizzle-orm';
import * as schema from '../../shared/schema';

/*
 * The only place that knows where movies, packages, vouchers, posts and site media are offered and which movies a
 * package covers. Every route, cron and webhook goes through these functions; nothing else reads or writes the link
 * tables (movie_branches, package_branches, package_movies, voucher_branches, voucher_packages, post_branches,
 * site_media_branches).
 *
 * Rules (docs/ke-hoach-tai-cau-truc-chi-nhanh.md, section 3.5):
 *   - "Every branch" is only ever all_branches = 1. A missing or empty branch list never means every branch.
 *   - all_branches = 0 with no link row = not offered anywhere yet ("chưa gắn chi nhánh"); only the Super Admin may
 *     change such a record.
 *   - A link row = offered at that branch. Price and display order are the record's own (one price for every branch).
 *
 * In this file, in order:
 *   BRANCH SCOPE      - the all_branches flag + link rows of a record: SQL filters, reading, input checks, writing
 *   PACKAGE MOVIES    - movie_scope + package_movies
 *   CUSTOMER CATALOG  - what one branch shows: movies, packages with their movies, single checks
 *   VOUCHERS          - branches and packages of a voucher
 *   BRANCH USAGE      - what still uses a branch (before it is deleted)
 *   BATCH             - running several writes as one unit
 */

// ==================== BRANCH SCOPE ====================

export type ScopedKind = 'movie' | 'package' | 'voucher' | 'post' | 'media';

/** Where a record is offered: every branch (also future ones), or the listed branches (none = nowhere yet). */
export type BranchScope = { all_branches: boolean; branch_ids: number[] };

type ScopedTables = { record: any; link: any; link_key: any };

const SCOPED: Record<ScopedKind, ScopedTables> = {
  movie: { record: schema.movies, link: schema.movie_branches, link_key: schema.movie_branches.movie_id },
  package: { record: schema.ticket_packages, link: schema.package_branches, link_key: schema.package_branches.package_id },
  voucher: { record: schema.vouchers, link: schema.voucher_branches, link_key: schema.voucher_branches.voucher_id },
  post: { record: schema.posts, link: schema.post_branches, link_key: schema.post_branches.post_id },
  media: { record: schema.site_media, link: schema.site_media_branches, link_key: schema.site_media_branches.media_id }
};

/** Error with an HTTP status, as the routes already throw them. */
function httpError(status: number, message: string): Error {
  const error: any = new Error(message);
  error.statusCode = status;
  error.status = status;
  return error;
}

/** Positive whole numbers of a list, each once, in order. */
export function cleanIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * The link table and its key column as plain SQL names. Inside drizzle's relational queries (db.query.x.findMany)
 * every column object is printed with the outer table's alias, which would turn "movie_branches"."movie_id" into
 * "movies"."movie_id"; plain names keep the sub-select right in both kinds of query.
 */
function linkNames(kind: ScopedKind) {
  const { link, link_key } = SCOPED[kind];
  const table = getTableName(link);
  return {
    table: sql.raw(`"${table}"`),
    key: sql.raw(`"${table}"."${link_key.name}"`),
    branch: sql.raw(`"${table}"."branch_id"`)
  };
}

/** SQL: the record (of the outer query) is offered at this branch. */
export function sqlServesBranch(kind: ScopedKind, branchId: number): SQL {
  const { record } = SCOPED[kind];
  const names = linkNames(kind);
  return sql`(${record.all_branches} = 1 OR EXISTS (SELECT 1 FROM ${names.table} WHERE ${names.key} = ${record.id} AND ${names.branch} = ${branchId}))`;
}

/** SQL: a staff member of these branches sees the record (records of every branch are seen by everyone). */
export function sqlInStaffBranches(kind: ScopedKind, staffBranchIds: number[]): SQL {
  if (!staffBranchIds.length) return sql`1 = 0`;
  const { record } = SCOPED[kind];
  const names = linkNames(kind);
  const idList = sql.join(
    staffBranchIds.map((id) => sql`${id}`),
    sql`, `
  );
  return sql`(${record.all_branches} = 1 OR EXISTS (SELECT 1 FROM ${names.table} WHERE ${names.key} = ${record.id} AND ${names.branch} IN (${idList})))`;
}

/** SQL: the record is shown at some branch: every branch, or at least one link (not "chưa gắn chi nhánh"). */
export function sqlLinkedToSomeBranch(kind: ScopedKind): SQL {
  const { record } = SCOPED[kind];
  const names = linkNames(kind);
  return sql`(${record.all_branches} = 1 OR EXISTS (SELECT 1 FROM ${names.table} WHERE ${names.key} = ${record.id}))`;
}

/** The branch ids linked to each record, keyed by record id. */
export async function loadBranchIds(db: any, kind: ScopedKind, recordIds: number[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  const ids = cleanIdList(recordIds);
  if (!ids.length) return result;
  const { link, link_key } = SCOPED[kind];
  const rows = await db
    .select({ record_id: link_key, branch_id: link.branch_id })
    .from(link)
    .where(inArray(link_key, ids))
    .orderBy(asc(link.branch_id));
  for (const row of rows) {
    const recordId = Number(row.record_id);
    const list = result.get(recordId) || [];
    list.push(Number(row.branch_id));
    result.set(recordId, list);
  }
  return result;
}

/** The scope of rows that carry id and all_branches: adds all_branches (boolean) and branch_ids (list). */
export async function withBranchScope<T extends { id: number; all_branches?: any }>(
  db: any,
  kind: ScopedKind,
  rows: T[]
): Promise<Array<T & BranchScope>> {
  const linked = await loadBranchIds(
    db,
    kind,
    rows.filter((row) => !isAllBranches(row)).map((row) => Number(row.id))
  );
  return rows.map((row) => {
    const allBranches = isAllBranches(row);
    return { ...row, all_branches: allBranches, branch_ids: allBranches ? [] : linked.get(Number(row.id)) || [] };
  });
}

/** One record's scope; null when the record does not exist. */
export async function readBranchScope(db: any, kind: ScopedKind, recordId: number): Promise<BranchScope | null> {
  const { record } = SCOPED[kind];
  const [row] = await db
    .select({ id: record.id, all_branches: record.all_branches })
    .from(record)
    .where(eq(record.id, recordId))
    .limit(1);
  if (!row) return null;
  const [scoped] = await withBranchScope(db, kind, [row]);
  return { all_branches: scoped.all_branches, branch_ids: scoped.branch_ids };
}

function isAllBranches(row: { all_branches?: any }): boolean {
  return row.all_branches === true || row.all_branches === 1 || row.all_branches === '1';
}

function isTrue(value: unknown): boolean {
  return value === true || value === 1 || value === 'true';
}

function isFalse(value: unknown): boolean {
  return value === false || value === 0 || value === 'false';
}

/**
 * The scope sent by an admin form. It must say so explicitly: { all_branches: true }, or { all_branches: false,
 * branch_ids: [...] } (an empty list = not offered anywhere yet). Anything else is refused with 400: a missing field
 * never means "every branch". A list with something that is not a branch id is refused too.
 */
export function readScopeInput(input: { all_branches?: unknown; branch_ids?: unknown }): BranchScope {
  if (isTrue(input.all_branches)) return { all_branches: true, branch_ids: [] };
  const list = input.branch_ids;
  const listIsValid = Array.isArray(list) && list.every((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (isFalse(input.all_branches) && listIsValid) return { all_branches: false, branch_ids: cleanIdList(list) };
  throw httpError(400, 'Vui lòng chọn "Tất cả chi nhánh" hoặc danh sách chi nhánh áp dụng');
}

/**
 * The scope sent by an edit: undefined when neither field was sent (the branches stay as they are; nothing is ever
 * read as "every branch"), else the same check as readScopeInput.
 */
export function readScopeChange(input: { all_branches?: unknown; branch_ids?: unknown }): BranchScope | undefined {
  if (input.all_branches === undefined && input.branch_ids === undefined) return undefined;
  return readScopeInput(input);
}

/**
 * A staff member limited to some branches may only give a record branches of their own, at least one (a record of no
 * branch can then only be changed by the Super Admin), never "every branch". The Super Admin
 * (restrictToBranchIds null) may give anything, also no branch.
 */
export function assertStaffMayAssign(scope: BranchScope, restrictToBranchIds: number[] | null, noun: string) {
  if (!restrictToBranchIds) return;
  if (scope.all_branches) {
    throw httpError(403, `Chỉ Super Admin mới có quyền áp dụng ${noun} cho tất cả chi nhánh`);
  }
  if (!scope.branch_ids.length) {
    throw httpError(403, 'Vui lòng chọn ít nhất một chi nhánh thuộc quyền quản lý');
  }
  if (scope.branch_ids.some((id) => !restrictToBranchIds.includes(id))) {
    throw httpError(403, `Bạn không có quyền áp dụng ${noun} cho chi nhánh ngoài phạm vi quản lý`);
  }
}

/**
 * A staff member limited to some branches may change a record only when every branch of it is theirs. Records of
 * every branch and records of no branch are for the Super Admin only.
 */
export function staffMayModify(scope: BranchScope | null, restrictToBranchIds: number[] | null): boolean {
  if (!restrictToBranchIds) return true;
  if (!scope || scope.all_branches || !scope.branch_ids.length) return false;
  return scope.branch_ids.every((id) => restrictToBranchIds.includes(id));
}

/** A staff member limited to some branches sees a record of every branch or of one of their branches. */
export function staffMaySee(scope: BranchScope | null, restrictToBranchIds: number[] | null): boolean {
  if (!restrictToBranchIds) return true;
  if (!scope) return false;
  return scope.all_branches || scope.branch_ids.some((id) => restrictToBranchIds.includes(id));
}

/** Branch ids that exist and are not deleted; throws when the list names another one. */
export async function assertBranchesExist(db: any, branchIds: number[]) {
  if (!branchIds.length) return;
  const rows = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(and(inArray(schema.branches.id, branchIds), isNull(schema.branches.deleted_at)));
  if (rows.length !== branchIds.length) throw httpError(400, 'Chi nhánh không tồn tại hoặc đã bị xóa');
}

/** The writes that give a record this scope: the all_branches flag, links removed and links added. */
export async function branchScopeStatements(db: any, kind: ScopedKind, recordId: number, scope: BranchScope): Promise<any[]> {
  const { record, link, link_key } = SCOPED[kind];
  const wanted = scope.all_branches ? [] : scope.branch_ids;
  const current = (await loadBranchIds(db, kind, [recordId])).get(recordId) || [];
  const toAdd = wanted.filter((id) => !current.includes(id));
  const statements: any[] = [db.update(record).set({ all_branches: scope.all_branches }).where(eq(record.id, recordId))];
  if (current.some((id) => !wanted.includes(id))) {
    statements.push(
      db
        .delete(link)
        .where(wanted.length ? and(eq(link_key, recordId), notInArray(link.branch_id, wanted)) : eq(link_key, recordId))
    );
  }
  if (toAdd.length) {
    statements.push(db.insert(link).values(toAdd.map((branchId) => ({ [link_key.name]: recordId, branch_id: branchId }))));
  }
  return statements;
}

/** Gives a record this scope in one batch. */
export async function setBranchScope(db: any, kind: ScopedKind, recordId: number, scope: BranchScope) {
  await runBatch(db, await branchScopeStatements(db, kind, recordId, scope));
}

/** Names of the branches of a scope, "Tất cả chi nhánh" for every branch (unknown ids are skipped). */
export function branchScopeLabel(scope: BranchScope, namesById: Map<number, string>): string | null {
  if (scope.all_branches) return 'Tất cả chi nhánh';
  const names = scope.branch_ids.map((id) => namesById.get(id)).filter((name): name is string => Boolean(name));
  return names.length ? names.join(', ') : null;
}

// ==================== PACKAGE MOVIES ====================

export type MovieScope = 'selected' | 'all_at_branch';

/** The movies of a package: every movie of the order's branch, or the selected ones. */
export type PackageMovies = { movie_scope: MovieScope; movie_ids: number[] };

export function readMovieScope(value: unknown): MovieScope {
  return value === 'all_at_branch' ? 'all_at_branch' : 'selected';
}

/** The selected movie ids of each package, keyed by package id. */
export async function loadPackageMovieIds(db: any, packageIds: number[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  const ids = cleanIdList(packageIds);
  if (!ids.length) return result;
  const rows = await db
    .select({ package_id: schema.package_movies.package_id, movie_id: schema.package_movies.movie_id })
    .from(schema.package_movies)
    .where(inArray(schema.package_movies.package_id, ids))
    .orderBy(asc(schema.package_movies.movie_id));
  for (const row of rows) {
    const packageId = Number(row.package_id);
    const list = result.get(packageId) || [];
    list.push(Number(row.movie_id));
    result.set(packageId, list);
  }
  return result;
}

/** Adds movie_scope and movie_ids to package rows (movie_ids is empty for 'all_at_branch'). */
export async function withPackageMovies<T extends { id: number; movie_scope?: any }>(
  db: any,
  rows: T[]
): Promise<Array<T & PackageMovies>> {
  const selected = await loadPackageMovieIds(
    db,
    rows.filter((row) => readMovieScope(row.movie_scope) === 'selected').map((row) => Number(row.id))
  );
  return rows.map((row) => {
    const movieScope = readMovieScope(row.movie_scope);
    return {
      ...row,
      movie_scope: movieScope,
      movie_ids: movieScope === 'selected' ? selected.get(Number(row.id)) || [] : []
    };
  });
}

/**
 * The package movies sent by the admin form: { movie_scope: 'all_at_branch' } or { movie_scope: 'selected',
 * movie_ids: [...] } with at least one movie (a movie package with no movie cannot be sold). Refused with 400
 * otherwise. VR packages have no movies (the caller skips this).
 */
export function readPackageMoviesInput(input: { movie_scope?: unknown; movie_ids?: unknown }): PackageMovies {
  if (input.movie_scope === 'all_at_branch') return { movie_scope: 'all_at_branch', movie_ids: [] };
  if (input.movie_scope === 'selected') {
    const list = input.movie_ids;
    const listIsValid = Array.isArray(list) && list.every((id) => Number.isInteger(Number(id)) && Number(id) > 0);
    if (!listIsValid || cleanIdList(list).length === 0) {
      throw httpError(400, 'Vui lòng chọn ít nhất một phim cho gói, hoặc chọn "Mọi phim chiếu ở chi nhánh"');
    }
    return { movie_scope: 'selected', movie_ids: cleanIdList(list) };
  }
  throw httpError(400, 'Vui lòng chọn "Mọi phim chiếu ở chi nhánh" hoặc danh sách phim của gói');
}

/** The package movies sent by an edit: undefined when neither field was sent (they stay as they are). */
export function readPackageMoviesChange(input: { movie_scope?: unknown; movie_ids?: unknown }): PackageMovies | undefined {
  if (input.movie_scope === undefined && input.movie_ids === undefined) return undefined;
  return readPackageMoviesInput(input);
}

/** Throws when a selected movie does not exist or was deleted. */
export async function assertMoviesExist(db: any, movieIds: number[]) {
  if (!movieIds.length) return;
  const rows = await db
    .select({ id: schema.movies.id })
    .from(schema.movies)
    .where(and(inArray(schema.movies.id, movieIds), isNull(schema.movies.deleted_at)));
  if (rows.length !== movieIds.length) throw httpError(400, 'Một hoặc nhiều phim đã chọn không tồn tại hoặc đã bị xóa');
}

/** The writes that give a package these movies. */
export async function packageMoviesStatements(db: any, packageId: number, movies: PackageMovies): Promise<any[]> {
  const wanted = movies.movie_scope === 'selected' ? movies.movie_ids : [];
  const current = (await loadPackageMovieIds(db, [packageId])).get(packageId) || [];
  const toAdd = wanted.filter((id) => !current.includes(id));
  const statements: any[] = [
    db.update(schema.ticket_packages).set({ movie_scope: movies.movie_scope }).where(eq(schema.ticket_packages.id, packageId))
  ];
  if (current.some((id) => !wanted.includes(id))) {
    statements.push(
      db
        .delete(schema.package_movies)
        .where(
          wanted.length
            ? and(eq(schema.package_movies.package_id, packageId), notInArray(schema.package_movies.movie_id, wanted))
            : eq(schema.package_movies.package_id, packageId)
        )
    );
  }
  if (toAdd.length) {
    statements.push(db.insert(schema.package_movies).values(toAdd.map((movieId) => ({ package_id: packageId, movie_id: movieId }))));
  }
  return statements;
}

/** Active, not deleted packages that list this movie among their selected movies. */
export async function packagesSelectingMovie(db: any, movieId: number): Promise<Array<{ id: number; name: string }>> {
  const packages = schema.ticket_packages;
  return db
    .select({ id: packages.id, name: packages.name })
    .from(packages)
    .innerJoin(schema.package_movies, eq(schema.package_movies.package_id, packages.id))
    .where(
      and(
        eq(schema.package_movies.movie_id, movieId),
        eq(packages.is_active, true),
        isNull(packages.deleted_at),
        eq(packages.movie_scope, 'selected')
      )
    );
}

// ==================== CUSTOMER CATALOG ====================

/** A movie as the customer screens read it inside a package or the booking page. */
export type BranchMovie = { id: number; title: string; cover_image: string | null; duration_min: number | null };

const ACTIVE_MOVIE = () => and(eq(schema.movies.is_active, true), isNull(schema.movies.deleted_at));
const ACTIVE_PACKAGE = () => and(eq(schema.ticket_packages.is_active, true), isNull(schema.ticket_packages.deleted_at));

/** The movies shown at a branch: active, not deleted, offered there. */
export async function moviesAtBranch(db: any, branchId: number): Promise<BranchMovie[]> {
  const movies = schema.movies;
  return db
    .select({ id: movies.id, title: movies.title, cover_image: movies.cover_image, duration_min: movies.duration_min })
    .from(movies)
    .where(and(ACTIVE_MOVIE(), sqlServesBranch('movie', branchId)))
    .orderBy(asc(movies.id));
}

/** Whether a movie is active, not deleted and shown at the branch. */
export async function movieServesBranch(db: any, movieId: number, branchId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.movies.id })
    .from(schema.movies)
    .where(and(eq(schema.movies.id, movieId), ACTIVE_MOVIE(), sqlServesBranch('movie', branchId)))
    .limit(1);
  return Boolean(row);
}

/** Whether a package (any state) is offered at the branch, ignoring whether it is active. */
export async function packageOfferedAtBranch(db: any, packageId: number, branchId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.ticket_packages.id })
    .from(schema.ticket_packages)
    .where(and(eq(schema.ticket_packages.id, packageId), sqlServesBranch('package', branchId)))
    .limit(1);
  return Boolean(row);
}

/** The package columns the customer screens and the order logic read. */
function customerPackageColumns() {
  const packages = schema.ticket_packages;
  return {
    id: packages.id,
    name: packages.name,
    code: packages.code,
    description: packages.description,
    price: packages.price,
    display_order: packages.display_order,
    features: packages.features,
    type: packages.type,
    is_member_only: packages.is_member_only,
    movie_scope: packages.movie_scope,
    min_group_size: packages.min_group_size,
    max_group_size: packages.max_group_size,
    cover_image: packages.cover_image,
    duration_min: packages.duration_min,
    vr_genre: packages.vr_genre,
    min_players: packages.min_players,
    max_players: packages.max_players
  };
}

const VR_TYPE = () => eq(schema.ticket_packages.type, 'vr');
const MOVIE_TYPE = () => sql`(${schema.ticket_packages.type} IS NULL OR ${schema.ticket_packages.type} != 'vr')`;

/**
 * The packages sold at a branch (active, not deleted, offered there). Movie packages carry `movies`: the movies of
 * the package shown at that branch.
 */
export async function packagesAtBranch(db: any, branchId: number, type: 'movie' | 'vr') {
  const packages = schema.ticket_packages;
  const rows = await db
    .select(customerPackageColumns())
    .from(packages)
    .where(and(ACTIVE_PACKAGE(), type === 'vr' ? VR_TYPE() : MOVIE_TYPE(), sqlServesBranch('package', branchId)))
    .orderBy(asc(packages.display_order), asc(packages.price), asc(packages.id));
  if (type === 'vr') return rows.map((row: any) => ({ ...row, price: Number(row.price) }));
  const branchMovies = await moviesAtBranch(db, branchId);
  const selected = await loadPackageMovieIds(
    db,
    rows.filter((row: any) => readMovieScope(row.movie_scope) === 'selected').map((row: any) => Number(row.id))
  );
  return rows.map((row: any) => ({
    ...row,
    price: Number(row.price),
    movie_scope: readMovieScope(row.movie_scope),
    movies: packageMoviesFrom(readMovieScope(row.movie_scope), selected.get(Number(row.id)) || [], branchMovies)
  }));
}

/** The movies of a package at a branch: every movie of the branch, or the selected ones that the branch shows. */
function packageMoviesFrom(movieScope: MovieScope, selectedIds: number[], branchMovies: BranchMovie[]): BranchMovie[] {
  if (movieScope === 'all_at_branch') return branchMovies;
  return branchMovies.filter((movie) => selectedIds.includes(Number(movie.id)));
}

/** One package as sold at a branch (with its movies there), or null when it is not sold there. */
export async function packageAtBranch(db: any, packageId: number, branchId: number) {
  const [row] = await db
    .select(customerPackageColumns())
    .from(schema.ticket_packages)
    .where(and(eq(schema.ticket_packages.id, packageId), ACTIVE_PACKAGE(), sqlServesBranch('package', branchId)))
    .limit(1);
  if (!row) return null;
  const movieScope = readMovieScope(row.movie_scope);
  const movies =
    row.type === 'vr'
      ? []
      : packageMoviesFrom(
          movieScope,
          (await loadPackageMovieIds(db, [packageId])).get(packageId) || [],
          await moviesAtBranch(db, branchId)
        );
  return { ...row, price: Number(row.price), movie_scope: movieScope, movies };
}

/** The default branch (not deleted), or null. Customer requests without a branch are answered for it. */
export async function defaultBranchId(db: any): Promise<number | null> {
  const [row] = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(and(eq(schema.branches.is_default, true), isNull(schema.branches.deleted_at)))
    .limit(1);
  return row ? Number(row.id) : null;
}

/** The branch a customer request is about: the one asked for, else the default branch. */
export async function customerBranchId(db: any, requested: unknown): Promise<number | null> {
  const id = Number(requested);
  if (Number.isInteger(id) && id > 0) return id;
  return defaultBranchId(db);
}

// ==================== VOUCHERS ====================

/** Where and on what a voucher applies. package_ids is empty when all_packages. */
export type VoucherScope = BranchScope & { all_packages: boolean; package_ids: number[] };

/** The package ids of each voucher, keyed by voucher id. */
export async function loadVoucherPackageIds(db: any, voucherIds: number[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  const ids = cleanIdList(voucherIds);
  if (!ids.length) return result;
  const rows = await db
    .select({ voucher_id: schema.voucher_packages.voucher_id, package_id: schema.voucher_packages.package_id })
    .from(schema.voucher_packages)
    .where(inArray(schema.voucher_packages.voucher_id, ids))
    .orderBy(asc(schema.voucher_packages.package_id));
  for (const row of rows) {
    const voucherId = Number(row.voucher_id);
    const list = result.get(voucherId) || [];
    list.push(Number(row.package_id));
    result.set(voucherId, list);
  }
  return result;
}

/** Adds the branch and package scope to voucher rows (that carry id, all_branches, all_packages). */
export async function withVoucherScope<T extends { id: number; all_branches?: any; all_packages?: any }>(
  db: any,
  rows: T[]
): Promise<Array<T & VoucherScope>> {
  const scoped = await withBranchScope(db, 'voucher', rows);
  const packageIds = await loadVoucherPackageIds(
    db,
    rows.filter((row) => !isAllPackages(row)).map((row) => Number(row.id))
  );
  return scoped.map((row) => {
    const allPackages = isAllPackages(row);
    return { ...row, all_packages: allPackages, package_ids: allPackages ? [] : packageIds.get(Number(row.id)) || [] };
  });
}

/** One voucher's scope; null when the voucher does not exist. */
export async function readVoucherScope(db: any, voucherId: number): Promise<VoucherScope | null> {
  const vouchers = schema.vouchers;
  const [row] = await db
    .select({ id: vouchers.id, all_branches: vouchers.all_branches, all_packages: vouchers.all_packages })
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1);
  if (!row) return null;
  const [scoped] = await withVoucherScope(db, [row]);
  return {
    all_branches: scoped.all_branches,
    branch_ids: scoped.branch_ids,
    all_packages: scoped.all_packages,
    package_ids: scoped.package_ids
  };
}

function isAllPackages(row: { all_packages?: any }): boolean {
  return row.all_packages === true || row.all_packages === 1 || row.all_packages === '1';
}

/** Whether a voucher applies at a branch. */
export function voucherServesBranch(scope: BranchScope, branchId: number): boolean {
  return scope.all_branches || scope.branch_ids.includes(branchId);
}

/** Whether a voucher discounts a package (the voucher's type scope movie / vr / all is checked by the caller). */
export function voucherCoversPackage(scope: { all_packages: boolean; package_ids: number[] }, packageId: number): boolean {
  return scope.all_packages || scope.package_ids.includes(packageId);
}

/**
 * The package choice sent by the voucher form. It must say so explicitly: { all_packages: true }, or
 * { all_packages: false, package_ids: [...] } with at least one package (a voucher of no package cannot be saved).
 * Anything else is refused with 400.
 */
export function readVoucherPackagesInput(input: { all_packages?: unknown; package_ids?: unknown }) {
  if (isTrue(input.all_packages)) return { all_packages: true, package_ids: [] as number[] };
  const list = input.package_ids;
  const listIsValid = Array.isArray(list) && list.every((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (isFalse(input.all_packages) && listIsValid) {
    if (cleanIdList(list).length === 0) {
      throw httpError(400, 'Vui lòng chọn ít nhất một gói áp dụng hoặc chọn "Tất cả gói"');
    }
    return { all_packages: false, package_ids: cleanIdList(list) };
  }
  throw httpError(400, 'Vui lòng chọn "Tất cả gói" hoặc danh sách gói áp dụng');
}

/** The package choice sent by an edit: undefined when neither field was sent (it stays as it is). */
export function readVoucherPackagesChange(input: { all_packages?: unknown; package_ids?: unknown }) {
  if (input.all_packages === undefined && input.package_ids === undefined) return undefined;
  return readVoucherPackagesInput(input);
}

/** Throws 400 when a chosen package does not exist or was deleted. */
export async function assertPackagesExist(db: any, packageIds: number[]) {
  if (!packageIds.length) return;
  const rows = await db
    .select({ id: schema.ticket_packages.id })
    .from(schema.ticket_packages)
    .where(and(inArray(schema.ticket_packages.id, packageIds), isNull(schema.ticket_packages.deleted_at)));
  if (rows.length !== packageIds.length) throw httpError(400, 'Một hoặc nhiều gói đã chọn không tồn tại hoặc đã bị xóa');
}

/** The writes that give a voucher these packages. */
export async function voucherPackagesStatements(
  db: any,
  voucherId: number,
  choice: { all_packages: boolean; package_ids: number[] }
): Promise<any[]> {
  const wanted = choice.all_packages ? [] : choice.package_ids;
  const current = (await loadVoucherPackageIds(db, [voucherId])).get(voucherId) || [];
  const toAdd = wanted.filter((id) => !current.includes(id));
  const statements: any[] = [
    db.update(schema.vouchers).set({ all_packages: choice.all_packages }).where(eq(schema.vouchers.id, voucherId))
  ];
  if (current.some((id) => !wanted.includes(id))) {
    statements.push(
      db
        .delete(schema.voucher_packages)
        .where(
          wanted.length
            ? and(eq(schema.voucher_packages.voucher_id, voucherId), notInArray(schema.voucher_packages.package_id, wanted))
            : eq(schema.voucher_packages.voucher_id, voucherId)
        )
    );
  }
  if (toAdd.length) {
    statements.push(db.insert(schema.voucher_packages).values(toAdd.map((packageId) => ({ voucher_id: voucherId, package_id: packageId }))));
  }
  return statements;
}

// ==================== BRANCH USAGE ====================

export type BranchUsage = {
  movies: number;
  packages: number;
  vouchers: number;
  posts: number;
  media: number;
  unused_tickets: number;
};

/**
 * What still uses a branch: not deleted records linked to it (records of every branch do not count: they simply
 * stop showing there) and paid tickets not used yet.
 */
export async function branchUsage(db: any, branchId: number): Promise<BranchUsage> {
  const countLinked = async (kind: ScopedKind) => {
    const { record, link, link_key } = SCOPED[kind];
    // Posts have no deleted_at: a post is removed for good
    const conditions = record.deleted_at ? [eq(link.branch_id, branchId), isNull(record.deleted_at)] : [eq(link.branch_id, branchId)];
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(link)
      .innerJoin(record, eq(record.id, link_key))
      .where(and(...conditions));
    return Number(row?.count || 0);
  };
  const bookings = schema.bookings;
  const [tickets] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bookings)
    .where(and(eq(bookings.branch_id, branchId), eq(bookings.payment_status, 'paid'), sql`COALESCE(${bookings.is_used}, 0) = 0`));
  return {
    movies: await countLinked('movie'),
    packages: await countLinked('package'),
    vouchers: await countLinked('voucher'),
    posts: await countLinked('post'),
    media: await countLinked('media'),
    unused_tickets: Number(tickets?.count || 0)
  };
}

/** SQL: number of active, not deleted records of a kind offered at the branch of the outer query (branchIdColumn). */
export function sqlCountServedAt(kind: 'movie' | 'package', branchIdColumn: any): SQL {
  const { record } = SCOPED[kind];
  const names = linkNames(kind);
  return sql`(SELECT COUNT(*) FROM ${record} WHERE ${record.is_active} = 1 AND ${record.deleted_at} IS NULL AND (${record.all_branches} = 1 OR EXISTS (SELECT 1 FROM ${names.table} WHERE ${names.key} = ${record.id} AND ${names.branch} = ${branchIdColumn})))`;
}

// ==================== BATCH ====================

/** Runs writes as one unit (D1 batch = one transaction). Returns each statement's result. */
export async function runBatch(db: any, statements: any[]): Promise<any[]> {
  if (!statements.length) return [];
  return db.batch(statements);
}
