// A gentle hint for a mistyped mail provider. It never blocks an email: the booking page accepts any valid address and
// only asks "did you mean ...?" when the domain is one typo away from a common provider.

const COMMON_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

// Edit distance where swapping two neighbouring letters counts as one change (gmial -> gmail)
function editDistance(first: string, second: string): number {
  const rows = first.length + 1;
  const cols = second.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let row = 0; row < rows; row++) table[row][0] = row;
  for (let col = 0; col < cols; col++) table[0][col] = col;

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const cost = first[row - 1] === second[col - 1] ? 0 : 1;
      table[row][col] = Math.min(table[row - 1][col] + 1, table[row][col - 1] + 1, table[row - 1][col - 1] + cost);
      const swapped =
        row > 1 && col > 1 && first[row - 1] === second[col - 2] && first[row - 2] === second[col - 1];
      if (swapped) table[row][col] = Math.min(table[row][col], table[row - 2][col - 2] + 1);
    }
  }
  return table[rows - 1][cols - 1];
}

/** The email with its provider corrected, or null when the address looks right (or is a provider we do not know). */
export function suggestEmailFix(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1) return null;
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  for (const commonDomain of COMMON_EMAIL_DOMAINS) {
    if (editDistance(domain, commonDomain) === 1) return `${localPart}@${commonDomain}`;
  }
  return null;
}
