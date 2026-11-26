// Read-only queries for the public (customer) routes: branches, movie details, site media, and the trimming of ticket
// and VR packages. Each one names its columns and filters on "active and not deleted", so a public route never
// returns staff ids, audit dates, deleted rows or admin-only fields. The admin screens use server/routes/admin/*.

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

// ===== BRANCHES =====

/**
 * The branch fields the customer site reads: name and contact (header, footer, checkout), the banners (home page)
 * and the settings text (hotline, map, opening info and the bank account shown for the QR payment).
 */
function publicBranchColumns(branches: any) {
  return {
    id: branches.id,
    name: branches.name,
    address: branches.address,
    phone: branches.phone,
    email: branches.email,
    banner_images: branches.banner_images,
    settings: branches.settings
  };
}

/** The branches a customer can choose: active, open and not deleted, the default one first. */
export async function listPublicBranches(anyDb: any, tables: { branches: any }) {
  const branches = tables.branches;
  return anyDb
    .select(publicBranchColumns(branches))
    .from(branches)
    .where(and(eq(branches.is_active, true), eq(branches.is_open, true), isNull(branches.deleted_at)))
    .orderBy(desc(branches.is_default), asc(branches.name));
}

/** The default branch (active, open, not deleted), with the same fields as the list. Null when there is none. */
export async function getPublicDefaultBranch(anyDb: any, tables: { branches: any }) {
  const branches = tables.branches;
  const [branch] = await anyDb
    .select(publicBranchColumns(branches))
    .from(branches)
    .where(
      and(
        eq(branches.is_default, true),
        eq(branches.is_active, true),
        eq(branches.is_open, true),
        isNull(branches.deleted_at)
      )
    )
    .limit(1);
  return branch || null;
}

/** The bank account part of a branch's settings text, as a settings text again. Null when there is none. */
export function paymentSettingsOnly(settings: string | null | undefined): string | null {
  if (!settings) return null;
  try {
    const parsed = JSON.parse(settings);
    return parsed?.payment_config ? JSON.stringify({ payment_config: parsed.payment_config }) : null;
  } catch {
    return null;
  }
}

/**
 * What the QR payment page needs from the order's branch: its name and the bank account to transfer to. Only an
 * active, not deleted branch; null otherwise.
 */
export async function getPublicBranchPaymentInfo(anyDb: any, tables: { branches: any }, branchId: number) {
  if (!Number.isInteger(branchId) || branchId <= 0) return null;
  const branches = tables.branches;
  const [branch] = await anyDb
    .select({ id: branches.id, name: branches.name, settings: branches.settings })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.is_active, true), isNull(branches.deleted_at)))
    .limit(1);
  if (!branch) return null;
  return { id: branch.id, name: branch.name, settings: paymentSettingsOnly(branch.settings) };
}

// ===== MOVIES =====

/** A JSON list stored as text (genres); anything else gives an empty list. */
function parseJsonList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** One movie for the film popup of the home page. Only an active, not deleted movie; null otherwise. */
export async function getPublicMovieDetail(anyDb: any, tables: { movies: any }, movieId: number) {
  if (!Number.isInteger(movieId) || movieId <= 0) return null;
  const movies = tables.movies;
  const movie = await anyDb.query.movies.findFirst({
    where: and(eq(movies.id, movieId), eq(movies.is_active, true), isNull(movies.deleted_at)),
    columns: {
      id: true,
      title: true,
      description: true,
      cover_image: true,
      genres: true,
      rating: true,
      duration_min: true,
      release_date: true
    }
  });
  if (!movie) return null;
  return { ...movie, genres: parseJsonList(movie.genres) };
}

// ===== SITE MEDIA =====

/** The videos and images of the home page (hero, technology section): active and not deleted only. */
export async function listPublicSiteMedia(
  anyDb: any,
  tables: { site_media: any },
  filters: { section?: string; type?: string } = {}
) {
  const media = tables.site_media;
  const conditions: any[] = [eq(media.is_active, true), isNull(media.deleted_at)];
  if (filters.section) conditions.push(eq(media.section, filters.section));
  if (filters.type) conditions.push(eq(media.type, filters.type));
  return anyDb
    .select({
      id: media.id,
      section: media.section,
      type: media.type,
      title: media.title,
      description: media.description,
      url: media.url
    })
    .from(media)
    .where(and(...conditions))
    .orderBy(asc(media.display_order), desc(media.created_at));
}

// ===== TICKET AND VR PACKAGES =====
// The route first hides member-only packages from visitors (it needs is_member_only), then sends these trimmed copies.

/** A movie inside a ticket package: title and poster, and its branches (the booking page filters on them). */
export function toPublicPackageMovie(movie: any) {
  return {
    id: movie?.id,
    title: movie?.title,
    cover_image: movie?.cover_image,
    duration_min: movie?.duration_min,
    branch_id: movie?.branch_id ?? null,
    branch_ids: movie?.branch_ids ?? null
  };
}

/** A movie ticket package as the price section, the booking page and the schedule read it. */
export function toPublicTicketPackage(pkg: any) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    features: pkg.features,
    type: pkg.type,
    display_order: pkg.display_order,
    movies: Array.isArray(pkg.movies) ? pkg.movies.map(toPublicPackageMovie) : []
  };
}

/** A VR package as the VR section and the booking page read it. */
export function toPublicVrPackage(pkg: any) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    features: pkg.features,
    vr_genre: pkg.vr_genre,
    cover_image: pkg.cover_image,
    duration_min: pkg.duration_min,
    min_players: pkg.min_players,
    max_players: pkg.max_players,
    display_order: pkg.display_order
  };
}
