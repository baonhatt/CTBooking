import { describe, it, expect } from 'vitest';
import { neutralizeFormula } from './exportUtils';

describe('neutralizeFormula', () => {
  it.each(['=SUM(A1:A9)', '+1+1', '-2+3', '@cmd', '\tcmd', '\rcmd', '=HYPERLINK("http://evil.test","x")'])(
    'puts a quote in front of %p so it stays text',
    (value) => {
      expect(neutralizeFormula(value)).toBe("'" + value);
    }
  );

  it.each(['Nguyễn Văn A', 'a=b', 'user@example.com', '0900000000', '', 'Vé 2D - Phim A', '100.000'])('leaves %p alone', (value) => {
    expect(neutralizeFormula(value)).toBe(value);
  });
});
