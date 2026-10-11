import { extractToken } from './QrScanner';

describe('extractToken', () => {
  it('tam bağlantıdan token çıkarır', () => {
    expect(extractToken('http://localhost:5173/scan/cmv24dp9d006jx9sodutty8fs')).toBe('cmv24dp9d006jx9sodutty8fs');
    expect(extractToken('https://zimmet.togu.edu.tr/scan/abcDEF123456789/')).toBe('abcDEF123456789');
  });
  it('çıplak token kabul eder', () => {
    expect(extractToken('  cmv24dp9d006jx9sodutty8fs ')).toBe('cmv24dp9d006jx9sodutty8fs');
  });
  it('geçersiz içeriği reddeder', () => {
    expect(extractToken('')).toBeNull();
    expect(extractToken('merhaba dünya')).toBeNull();
    expect(extractToken('https://example.com/baska/yol')).toBeNull();
  });
});
