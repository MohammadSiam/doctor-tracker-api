/**
 * Search strategy: every searchable document stores a `searchTokens` array of lowercase words
 * (name, email, hospital, ...). The array has a multikey index, and queries match each search
 * word as an anchored prefix regex (`^jo`), which MongoDB can answer with an index range scan.
 * This gives "search as you type" across several fields without an unindexed `/term/i` scan.
 */
export function buildSearchTokens(...values: Array<string | undefined | null>): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const normalized = value.toLowerCase();
    tokens.add(normalized.replace(/\s+/g, ''));
    for (const word of normalized.split(/[\s@.,+\-_/()]+/)) {
      if (word) tokens.add(word);
    }
  }
  return [...tokens];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildSearchFilter(search?: string) {
  const words = search?.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 5) ?? [];
  if (words.length === 0) return {};
  return { searchTokens: { $all: words.map((word) => new RegExp(`^${escapeRegex(word)}`)) } };
}
