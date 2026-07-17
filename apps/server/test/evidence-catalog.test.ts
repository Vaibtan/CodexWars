import { describe, expect, it } from "vitest";
import { createEvidenceCatalog, resolveEvidenceReferences } from "../src/quiz/evidence-catalog.js";

describe("quiz evidence catalog", () => {
  it("assigns stable IDs to unique provider-owned HTTPS sources", () => {
    const catalog = createEvidenceCatalog([
      {
        title: "NASA Science",
        url: "https://www.nasa.gov/science/?utm_source=chatgpt.com#overview"
      },
      {
        title: "Duplicate search result",
        url: "https://www.nasa.gov/science"
      },
      {
        title: "World Health Organization",
        url: "https://www.who.int/news-room"
      },
      {
        title: "Rejected insecure source",
        url: "http://www.bbc.com/science"
      }
    ]);

    expect(catalog.entries).toEqual([
      {
        id: "source-01",
        publisher: "nasa.gov",
        title: "NASA Science",
        url: "https://www.nasa.gov/science"
      },
      {
        id: "source-02",
        publisher: "who.int",
        title: "World Health Organization",
        url: "https://www.who.int/news-room"
      }
    ]);
  });

  it("resolves model-selected IDs to authoritative catalog evidence", () => {
    const catalog = createEvidenceCatalog([{
      title: "NASA Science",
      url: "https://www.nasa.gov/science/?utm_source=chatgpt.com"
    }]);

    expect(resolveEvidenceReferences(catalog, [{ publishedAt: null, sourceId: "source-01" }], 123_456)).toEqual([{
      publisher: "nasa.gov",
      retrievedAt: 123_456,
      title: "NASA Science",
      url: "https://www.nasa.gov/science"
    }]);
  });
});
