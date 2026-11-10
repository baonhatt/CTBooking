import { describe, it, expect } from 'vitest';
import { suggestEmailFix } from './email-hint';

describe('suggestEmailFix', () => {
  it('suggests the right provider for a one-letter typo', () => {
    expect(suggestEmailFix('an@gmial.com')).toBe('an@gmail.com');
    expect(suggestEmailFix('an@gmai.com')).toBe('an@gmail.com');
    expect(suggestEmailFix('an@gmail.con')).toBe('an@gmail.com');
    expect(suggestEmailFix('an@yahho.com')).toBe('an@yahoo.com');
    expect(suggestEmailFix('an@hotmial.com')).toBe('an@hotmail.com');
  });

  it('keeps the part before the @ as typed, and ignores the case of the domain', () => {
    expect(suggestEmailFix('Nguyen.Van.A@GMIAL.COM')).toBe('Nguyen.Van.A@gmail.com');
  });

  it('says nothing for a correct provider', () => {
    expect(suggestEmailFix('an@gmail.com')).toBeNull();
    expect(suggestEmailFix('an@Outlook.com')).toBeNull();
  });

  it('says nothing for a company or other provider', () => {
    expect(suggestEmailFix('an@congty.vn')).toBeNull();
    expect(suggestEmailFix('an@fpt.com.vn')).toBeNull();
    expect(suggestEmailFix('an@protonmail.com')).toBeNull();
  });

  it('says nothing when there is no address to fix', () => {
    expect(suggestEmailFix('')).toBeNull();
    expect(suggestEmailFix('no-at-sign')).toBeNull();
    expect(suggestEmailFix('@gmial.com')).toBeNull();
  });
});
