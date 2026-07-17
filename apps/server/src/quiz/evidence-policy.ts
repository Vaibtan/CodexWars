const BLOCKED_SOURCE_DOMAINS = ["facebook.com", "instagram.com", "reddit.com", "tiktok.com", "x.com"] as const;

export const TRUSTED_SOURCE_DOMAINS = [
  "apnews.com", "bbc.com", "britannica.com", "fifa.com", "history.com", "nasa.gov", "nationalgeographic.com",
  "nih.gov", "noaa.gov", "npr.org", "olympics.com", "reuters.com", "si.edu", "un.org", "who.int", "worldbank.org"
] as const;

export function httpsHostname(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      ? url.hostname.toLocaleLowerCase("en").replace(/^www\./u, "")
      : undefined;
  } catch {
    return undefined;
  }
}

export function trustedEvidenceHostname(hostname: string): boolean {
  if (BLOCKED_SOURCE_DOMAINS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))) return false;
  return TRUSTED_SOURCE_DOMAINS.some((trusted) => hostname === trusted || hostname.endsWith(`.${trusted}`));
}
