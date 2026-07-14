export function normalizeApiUrl(raw: string | undefined): string {
  const normalized = (raw ?? '').includes('=')
    ? (raw ?? '').split('=').slice(1).join('=').trim()
    : (raw ?? '').trim();
  return normalized.startsWith('http')
    ? normalized
    : normalized
      ? `https://${normalized}`
      : 'http://localhost:3000';
}
