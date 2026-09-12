import { normalizeApiUrl } from './normalizeApiUrl';

describe('normalizeApiUrl', () => {
  it('returns localhost fallback when input is undefined or empty', () => {
    expect(normalizeApiUrl(undefined)).toBe('http://localhost:3000');
    expect(normalizeApiUrl('')).toBe('http://localhost:3000');
    expect(normalizeApiUrl('   ')).toBe('http://localhost:3000');
  });

  it('passes through a value that already has an http(s) protocol', () => {
    expect(normalizeApiUrl('https://api.veego.com')).toBe('https://api.veego.com');
    expect(normalizeApiUrl('http://192.168.1.1:3000')).toBe('http://192.168.1.1:3000');
  });

  it('prepends https:// to a bare host with no protocol', () => {
    expect(normalizeApiUrl('api.veego.com')).toBe('https://api.veego.com');
  });

  it('extracts the value after "=" (e.g. a copy-pasted EXPO_PUBLIC_API_URL=... env line)', () => {
    expect(normalizeApiUrl('EXPO_PUBLIC_API_URL=https://api.veego.com')).toBe('https://api.veego.com');
    expect(normalizeApiUrl('EXPO_PUBLIC_API_URL=api.veego.com')).toBe('https://api.veego.com');
  });

  it('joins back a value containing multiple "=" signs (e.g. a base64-padded token in a query string)', () => {
    expect(normalizeApiUrl('KEY=https://api.veego.com/path?token=abc==')).toBe(
      'https://api.veego.com/path?token=abc==',
    );
  });

  it('trims surrounding whitespace before evaluating the value', () => {
    expect(normalizeApiUrl('  https://api.veego.com  ')).toBe('https://api.veego.com');
    expect(normalizeApiUrl('  api.veego.com  ')).toBe('https://api.veego.com');
  });

  it('falls back to localhost when the value after "=" is empty', () => {
    expect(normalizeApiUrl('EXPO_PUBLIC_API_URL=')).toBe('http://localhost:3000');
    expect(normalizeApiUrl('EXPO_PUBLIC_API_URL=   ')).toBe('http://localhost:3000');
  });
});
