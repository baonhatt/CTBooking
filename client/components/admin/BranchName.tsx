/**
 * A branch name as list screens show it. Branch names read "HCM | CN AEON MALL Tân Phú Celadon": the region code goes
 * in a small chip on top and the rest wraps onto at most two lines, so a long name is never cut to "HCM | CN Vạn ...".
 * The full name is always in the tooltip.
 */

/** "HCM | CN Vạn Hạnh Mall" -> { region: 'HCM', place: 'CN Vạn Hạnh Mall' }; a name without " | " has no region. */
export function splitBranchName(name: string): { region: string | null; place: string } {
  const parts = String(name || '').split('|');
  if (parts.length < 2) return { region: null, place: String(name || '').trim() };
  const region = parts[0].trim();
  const place = parts.slice(1).join('|').trim();
  return region && place ? { region, place } : { region: null, place: String(name).trim() };
}

type BranchNameProps = {
  name: string;
  /** Chip colours, e.g. for a coloured badge list; plain text when left out */
  tone?: string;
  /** stacked: region above the name (narrow columns); inline: region before the name (compact chips) */
  layout?: 'stacked' | 'inline';
  className?: string;
};

export function BranchName({ name, tone, layout = 'stacked', className }: BranchNameProps) {
  const { region, place } = splitBranchName(name);
  const direction = layout === 'inline' ? 'flex-row items-baseline gap-1' : 'flex-col items-start gap-0.5';
  return (
    <span
      className={`inline-flex min-w-0 max-w-full ${direction} ${tone ? `rounded-md border px-1.5 py-0.5 ${tone}` : ''} ${className || ''}`}
      title={name}
    >
      {region && (
        <span className="shrink-0 rounded bg-slate-800/5 px-1 text-[10px] font-bold uppercase leading-4 tracking-wide text-slate-500">
          {region}
        </span>
      )}
      <span className="line-clamp-2 whitespace-normal break-words text-[12px] font-medium leading-snug">{place}</span>
    </span>
  );
}
