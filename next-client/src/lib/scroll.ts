// Used when the header is not on the page yet (its real height is read as soon as it is)
const DEFAULT_HEADER_HEIGHT = 72;

/**
 * Scrolls smoothly to the element with this id, stopping just under the fixed header.
 * Returns false when the element is not on the page.
 */
export function scrollToElementId(elementId: string): boolean {
  const element = document.getElementById(elementId);
  if (!element) return false;
  const header = document.querySelector('header') as HTMLElement | null;
  const headerOffset = header?.offsetHeight || DEFAULT_HEADER_HEIGHT;
  const absoluteTop = window.scrollY + element.getBoundingClientRect().top;
  window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset), behavior: 'smooth' });
  return true;
}
