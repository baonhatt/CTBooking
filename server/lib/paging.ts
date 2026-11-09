// Safe paging for list screens.

/** The most rows one page may hold. */
export const MAX_PAGE_SIZE = 100;

/** The page size used when none (or a bad one) is given. */
export const DEFAULT_PAGE_SIZE = 20;

/** The most ids put in one "IN (...)" query. D1 allows only a limited number of bound values per query. */
export const IN_QUERY_CHUNK = 100;

/** The most rows the export route returns. */
export const EXPORT_MAX_ROWS = 5000;

function toWholeNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) ? number : null;
}

/**
 * Turns the page and page size from a URL into safe numbers: page at least 1, page size between 1 and maxPageSize.
 * A missing, negative, zero, fractional or text value falls back to the default.
 */
export function clampPage(
  page: unknown,
  pageSize: unknown,
  options: { maxPageSize?: number; defaultPageSize?: number } = {}
): { page: number; pageSize: number } {
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const wholePage = toWholeNumber(page);
  const wholeSize = toWholeNumber(pageSize);

  return {
    page: wholePage !== null && wholePage >= 1 ? wholePage : 1,
    pageSize: wholeSize !== null && wholeSize >= 1 ? Math.min(wholeSize, maxPageSize) : Math.min(defaultPageSize, maxPageSize)
  };
}

/** Cuts a list into pieces of at most `size` items. */
export function chunk<T>(items: T[], size: number = IN_QUERY_CHUNK): T[][] {
  const pieces: T[][] = [];
  const pieceSize = size >= 1 ? Math.floor(size) : IN_QUERY_CHUNK;
  for (let start = 0; start < items.length; start += pieceSize) {
    pieces.push(items.slice(start, start + pieceSize));
  }
  return pieces;
}
