const BASE_URL = "https://kvf.fo";

export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, BASE_URL).toString();
}

export function extractPathname(pathOrUrl: string): string {
  return new URL(pathOrUrl, BASE_URL).pathname;
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function extractSlugFromPath(pathOrUrl: string): string {
  const pathname = extractPathname(pathOrUrl);
  const match = pathname.match(/\/(?:sjon\/sending|vit\/sending\/sv)\/([^/?#]+)/);
  return match?.[1] ?? "";
}

export function buildProgramApiUrl(pathOrUrl: string): string | null {
  const pathname = extractPathname(pathOrUrl);
  const slug = extractSlugFromPath(pathname);

  if (!slug) {
    return null;
  }

  if (pathname.startsWith("/sjon/sending/")) {
    return `/api/sjon/programs/${slug}`;
  }

  if (pathname.startsWith("/vit/sending/sv/")) {
    return `/api/vit/programs/${slug}`;
  }

  return null;
}

export function parseDateText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return normalized;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function parseSidFromUrl(pathOrUrl: string): string | null {
  const url = new URL(pathOrUrl, BASE_URL);
  return url.searchParams.get("sid");
}

export function buildEpisodeUrl(slug: string, sid: string): string {
  return absoluteUrl(`/sjon/sending/${slug}?sid=${sid}`);
}

export function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}
