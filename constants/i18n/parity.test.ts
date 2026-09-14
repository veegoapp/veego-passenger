import { en } from './en';
import { ar } from './ar';

// TypeScript already forces `ar` to declare every key of `en` (ar.ts types
// itself as `ar: typeof en`), so a missing/extra key is a build error, not
// a runtime one. What TS can't catch is a value going wrong *inside* a
// string — most commonly a `{placeholder}` interpolation token dropped or
// mistyped during translation. A screen calling `t('key', { p: 25 })` on a
// string missing `{p}` silently renders the literal `{p}` (or drops data)
// only in Arabic, and nothing catches it short of manually switching the
// app to Arabic and hitting that exact screen.
function extractPlaceholders(value: string): string[] {
  return Array.from(value.matchAll(/\{[a-zA-Z0-9_]+\}/g), (m) => m[0]).sort();
}

describe('i18n translations: en/ar parity', () => {
  const keys = Object.keys(en) as (keyof typeof en)[];

  it('has at least one translation key to check', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it.each(keys)('"%s" is a non-empty string in both languages', (key) => {
    expect(typeof en[key]).toBe('string');
    expect(typeof ar[key]).toBe('string');
    expect((en[key] as string).length).toBeGreaterThan(0);
    expect((ar[key] as string).length).toBeGreaterThan(0);
  });

  it.each(keys)('"%s" uses the same {placeholder} tokens in English and Arabic', (key) => {
    expect(extractPlaceholders(ar[key] as string)).toEqual(extractPlaceholders(en[key] as string));
  });
});
