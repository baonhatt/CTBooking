import { describe, it, expect } from 'vitest';
import { escapeHtml, jsonLdString, addMissingImageAlt } from './safe-html';

describe('escapeHtml', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml('<a href="x" title=\'y\'>&</a>')).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  it('keeps ordinary text and handles missing values', () => {
    expect(escapeHtml('Phim "A" - Tập 1')).toBe('Phim &quot;A&quot; - Tập 1');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('jsonLdString', () => {
  it('cannot end the script block, whatever the title says', () => {
    const text = jsonLdString({ headline: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });

  it('is still valid JSON with the same meaning', () => {
    const data = { headline: '</script> & "quotes"   line', list: [1, 2, { a: '<b>' }] };
    expect(JSON.parse(jsonLdString(data))).toEqual(data);
  });

  it('leaves plain data readable', () => {
    expect(jsonLdString({ a: 1, b: 'text' })).toBe('{"a":1,"b":"text"}');
  });
});

describe('addMissingImageAlt', () => {
  it('adds the title as alt to images without one, escaped', () => {
    const html = addMissingImageAlt('<p><img src="a.jpg"></p>', '"><script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
  });

  it('leaves images that have an alt alone, and handles self-closing images', () => {
    expect(addMissingImageAlt('<img src="a.jpg" alt="Poster">', 'Title')).toBe('<img src="a.jpg" alt="Poster">');
    expect(addMissingImageAlt('<img src="a.jpg" />', 'Title')).toBe('<img alt="Title" src="a.jpg" />');
  });
});
