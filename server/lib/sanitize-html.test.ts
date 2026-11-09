import { describe, it, expect } from 'vitest';
import { sanitizePostHtml } from './sanitize-html';

describe('sanitizePostHtml: attacks', () => {
  const attacks: Array<[string, string]> = [
    ['script tag', '<p>hi</p><script>alert(1)</script>'],
    ['script with src', '<script src="http://evil.test/x.js"></script>'],
    ['img onerror', '<img src=x onerror=alert(1)>'],
    ['img onerror quoted', '<img src="x" onerror="alert(document.cookie)">'],
    ['svg onload', '<svg onload=alert(1)></svg>'],
    ['javascript link', '<a href="javascript:alert(1)">click</a>'],
    ['javascript link, mixed case and tab', '<a href="JaVa\tScRiPt:alert(1)">click</a>'],
    ['data html link', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['iframe', '<iframe src="http://evil.test"></iframe>'],
    ['object', '<object data="http://evil.test/x.swf"></object>'],
    ['embed', '<embed src="http://evil.test/x.swf">'],
    ['onclick on a paragraph', '<p onclick="alert(1)">text</p>'],
    ['onmouseover on a link', '<a href="https://ok.test" onmouseover="alert(1)">x</a>'],
    ['style with expression', '<p style="width: expression(alert(1))">x</p>'],
    ['style with url', '<p style="background-color: url(javascript:alert(1))">x</p>'],
    ['form', '<form action="http://evil.test"><input name="password"></form>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=http://evil.test">'],
    ['base tag', '<base href="http://evil.test/">'],
    ['style tag', '<style>body{display:none}</style>'],
    ['broken tag trick', '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ['input that is not a check box', '<input type="text" onfocus="alert(1)" autofocus>']
  ];

  it.each(attacks)('%s leaves nothing that can run', (_name, html) => {
    const clean = sanitizePostHtml(html);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe|<object|<embed|<svg|<form|<meta|<base|<style/i);
    expect(clean).not.toMatch(/\son[a-z]+\s*=/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/expression\s*\(/i);
    expect(clean).not.toMatch(/url\s*\(/i);
    expect(clean).not.toMatch(/alert\(1\)<\/script/i);
  });

  it('removes the body of a script, not only its tags', () => {
    expect(sanitizePostHtml('<p>a</p><script>steal()</script><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('keeps the text of a tag that is not allowed', () => {
    expect(sanitizePostHtml('<custom-tag>kept</custom-tag>')).toBe('kept');
  });

  it('removes the href of a javascript link but keeps the text', () => {
    const clean = sanitizePostHtml('<a href="javascript:alert(1)">click</a>');
    expect(clean).toContain('click');
    expect(clean).not.toContain('javascript');
  });

  it('turns a text input into nothing but lets a check box stay', () => {
    expect(sanitizePostHtml('<input type="text">')).not.toContain('text');
    expect(sanitizePostHtml('<input type="checkbox" disabled="disabled" checked="checked">')).toContain('type="checkbox"');
  });
});

describe('sanitizePostHtml: what the editor writes stays', () => {
  const kept: Array<[string, string]> = [
    ['paragraphs and headings', '<h2>Title</h2><p>One <strong>bold</strong> and <em>italic</em> and <u>under</u> and <s>gone</s>.</p>'],
    ['aligned and indented text', '<p style="text-align:center;">Centered</p><p style="margin-left:40px;">Indented</p>'],
    ['colours and font size', '<p><span style="color:hsl(0, 75%, 60%);font-size:18px;">red</span><span style="background-color:#ff0;">mark</span></p>'],
    ['lists', '<ul><li>a</li><li>b</li></ul><ol><li>1</li><li>2</li></ol>'],
    ['ordered list with a style', '<ol style="list-style-type:lower-alpha;"><li>a</li></ol>'],
    ['a link', '<p><a href="https://cinesphere.com.vn/bai-viet/1" title="More">read</a></p>'],
    ['a block quote', '<blockquote><p>quote</p></blockquote>'],
    ['a horizontal line', '<hr>'],
    ['an image with a caption', '<figure class="image image-style-side"><img src="https://res.cloudinary.com/x/a.jpg" alt="Poster" width="800" height="450"><figcaption>Caption</figcaption></figure>'],
    ['a responsive image', '<figure class="image"><picture><source srcset="https://x.test/a.webp" type="image/webp"><img src="https://x.test/a.jpg" alt=""></picture></figure>'],
    ['a table', '<figure class="table"><table><thead><tr><th>A</th></tr></thead><tbody><tr><td style="text-align:center;" colspan="1">1</td></tr></tbody></table></figure>'],
    ['code', '<p>Use <code>npm test</code></p><pre><code class="language-ts">const a = 1;</code></pre>'],
    ['highlight', '<p><mark class="marker-yellow">noted</mark></p>'],
    ['a to-do list', '<ul class="todo-list"><li><label class="todo-list__label"><input type="checkbox" disabled="disabled"><span class="todo-list__label__description">item</span></label></li></ul>']
  ];

  it.each(kept)('keeps %s', (_name, html) => {
    const clean = sanitizePostHtml(html);
    // Same tags in the same order
    const tags = (value: string) => (value.match(/<\/?[a-z0-9]+/gi) || []).map((tag) => tag.toLowerCase());
    expect(tags(clean)).toEqual(tags(html));
  });

  it('keeps the text, the styles and the links exactly', () => {
    const html = '<p style="text-align:center;">Xin chào <a href="https://cinesphere.com.vn/x?a=1&amp;b=2">liên kết</a></p>';
    const clean = sanitizePostHtml(html);
    expect(clean).toContain('Xin chào');
    expect(clean).toContain('text-align:center');
    expect(clean).toContain('https://cinesphere.com.vn/x?a=1&amp;b=2');
  });

  it('keeps allowed styles and removes only the dangerous ones in the same attribute', () => {
    const clean = sanitizePostHtml('<p style="color: red; position: fixed; top: 0; background-color: url(x)">x</p>');
    expect(clean).toContain('color:');
    expect(clean).not.toContain('position');
    expect(clean).not.toContain('url(');
  });
});

describe('sanitizePostHtml: links that open a new tab', () => {
  it('adds rel="noopener noreferrer" to a link with a target', () => {
    const clean = sanitizePostHtml('<a href="https://ok.test" target="_blank">x</a>');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('replaces a rel that was given, and leaves a plain link without one', () => {
    expect(sanitizePostHtml('<a href="https://ok.test" target="_blank" rel="opener">x</a>')).not.toContain('rel="opener"');
    expect(sanitizePostHtml('<a href="https://ok.test">x</a>')).not.toContain('rel=');
  });
});

describe('sanitizePostHtml: odd input', () => {
  it('gives an empty string for anything that is not text', () => {
    for (const value of [undefined, null, 12, {}, [], '']) expect(sanitizePostHtml(value)).toBe('');
  });

  it('keeps an escaped < in text as it is', () => {
    expect(sanitizePostHtml('a &lt; b')).toBe('a &lt; b');
  });

  it('gives the same result when it is cleaned twice', () => {
    const once = sanitizePostHtml('<p style="text-align:center;">x <a href="https://ok.test" target="_blank">y</a></p><img src=x onerror=alert(1)>');
    expect(sanitizePostHtml(once)).toBe(once);
  });
});
