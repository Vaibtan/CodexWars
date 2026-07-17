export interface ProviderEvidenceSource {
  readonly title?: string;
  readonly url: string;
}

export interface EvidenceCatalogEntry {
  readonly id: `source-${string}`;
  readonly publisher: string;
  readonly title: string;
  readonly url: string;
}

export interface EvidenceCatalog {
  readonly entries: readonly EvidenceCatalogEntry[];
}

export interface EvidenceReference {
  readonly publishedAt: string | null;
  readonly sourceId: string;
}

const TRACKING_PARAMETERS = new Set(["fbclid", "gclid"]);

export function canonicalSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (normalized.startsWith("utm_") || TRACKING_PARAMETERS.has(normalized)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return undefined;
  }
}

export function createEvidenceCatalog(sources: readonly ProviderEvidenceSource[]): EvidenceCatalog {
  const unique = new Map<string, Omit<EvidenceCatalogEntry, "id">>();
  for (const source of sources) {
    const url = canonicalSourceUrl(source.url);
    if (url === undefined || unique.has(url)) continue;
    const publisher = httpsHostname(url);
    if (publisher === undefined) continue;
    unique.set(url, {
      publisher,
      title: source.title?.trim() || publisher,
      url
    });
  }
  return {
    entries: [...unique.values()].map((source, index) => ({
      id: `source-${String(index + 1).padStart(2, "0")}`,
      ...source
    }))
  };
}

export function resolveEvidenceReferences(
  catalog: EvidenceCatalog,
  references: readonly EvidenceReference[],
  retrievedAt: number
): ModelEvidenceSource[] | undefined {
  const byId = new Map<string, EvidenceCatalogEntry>(catalog.entries.map((entry) => [entry.id, entry]));
  const resolved: ModelEvidenceSource[] = [];
  for (const reference of references) {
    const source = byId.get(reference.sourceId);
    if (source === undefined) return undefined;
    resolved.push({
      ...(reference.publishedAt === null ? {} : { publishedAt: reference.publishedAt }),
      publisher: source.publisher,
      retrievedAt,
      title: source.title,
      url: source.url
    });
  }
  return resolved;
}
import { httpsHostname } from "./evidence-policy.js";
import type { ModelEvidenceSource } from "./types.js";
