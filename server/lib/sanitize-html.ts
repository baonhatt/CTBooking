import { FilterXSS, safeAttrValue } from 'xss';

// Cleans the HTML of a post (written in the CKEditor 5 editor) with an allow-list.
//
// It runs when a post is saved and when a post is read by the public, so posts saved before this existed are also
// cleaned without touching the database. Only the tags and attributes below survive. Scripts, event handlers
// (onerror=...), javascript: links, iframes and the like are removed.

// The tags the editor produces
const ALLOWED_TAGS: Record<string, string[]> = {
  p: ['class', 'style'],
  br: [],
  hr: ['class', 'style'],
  div: ['class', 'style'],
  span: ['class', 'style'],
  h1: ['class', 'style'],
  h2: ['class', 'style'],
  h3: ['class', 'style'],
  h4: ['class', 'style'],
  h5: ['class', 'style'],
  h6: ['class', 'style'],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  strike: [],
  sub: [],
  sup: [],
  mark: ['class'],
  code: ['class'],
  pre: ['class', 'style'],
  blockquote: ['class', 'style'],
  ul: ['class', 'style', 'type'],
  ol: ['class', 'style', 'type', 'start', 'reversed'],
  li: ['class', 'style', 'value'],
  a: ['href', 'title', 'target', 'rel', 'class'],
  img: ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', 'class', 'style'],
  picture: ['class'],
  source: ['srcset', 'sizes', 'media', 'type'],
  figure: ['class', 'style'],
  figcaption: ['class', 'style'],
  table: ['class', 'style'],
  thead: ['class', 'style'],
  tbody: ['class', 'style'],
  tfoot: ['class', 'style'],
  colgroup: [],
  col: ['style', 'width'],
  tr: ['class', 'style'],
  th: ['class', 'style', 'colspan', 'rowspan', 'scope'],
  td: ['class', 'style', 'colspan', 'rowspan'],
  // The to-do list of the editor: a disabled check box
  label: ['class'],
  input: ['type', 'disabled', 'checked']
};

// The style properties the editor uses (alignment, font, colours, tables, indent). url() and expression() are always removed.
const ALLOWED_STYLES: Record<string, boolean> = {
  'text-align': true,
  color: true,
  'background-color': true,
  'font-size': true,
  'font-family': true,
  'font-weight': true,
  'font-style': true,
  'text-decoration': true,
  'margin-left': true,
  'margin-right': true,
  'padding-left': true,
  width: true,
  'min-width': true,
  height: true,
  'list-style-type': true,
  'vertical-align': true,
  border: true,
  'border-color': true,
  'border-style': true,
  'border-width': true,
  'border-collapse': true,
  'border-top': true,
  'border-bottom': true,
  'border-left': true,
  'border-right': true,
  padding: true,
  'aspect-ratio': true
};

const filter = new FilterXSS({
  // Only the tags above are allowed
  whiteList: ALLOWED_TAGS,
  // A tag that is not allowed is removed but its text stays; the body of script and style goes too
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template'],
  css: { whiteList: ALLOWED_STYLES },
  // A style that still holds url(), expression() or similar after the property filter is dropped whole
  safeAttrValue(tag: string, name: string, value: string, cssFilter: any) {
    const safe = safeAttrValue(tag, name, value, cssFilter);
    if (name !== 'style') return safe;
    // Keep the harmless declarations, drop the ones with url(), expression() and the like
    return safe
      .split(';')
      .filter((declaration) => declaration.trim() && !/url\s*\(|expression|@import|behavior|-moz-binding/i.test(declaration))
      .join(';');
  },
  // Only a check box may be an input
  onTagAttr(tag: string, name: string, value: string) {
    if (tag === 'input' && name === 'type' && value !== 'checkbox') return '';
    return undefined;
  }
});

/** A link that opens a new tab must not give the new page control of this one. */
function addNoopenerToBlankLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (whole, attributes: string) => {
    if (!/\btarget=/i.test(attributes)) return whole;
    const withoutRel = attributes.replace(/\srel="[^"]*"/i, '');
    return '<a' + withoutRel + ' rel="noopener noreferrer">';
  });
}

/** The cleaned HTML. Anything that is not a string becomes an empty string. */
export function sanitizePostHtml(html: unknown): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  // A style attribute that ended up empty is removed
  const cleaned = filter.process(html).replace(/\sstyle(?:=""|(?=[\s>/]))/gi, '');
  return addNoopenerToBlankLinks(cleaned);
}
