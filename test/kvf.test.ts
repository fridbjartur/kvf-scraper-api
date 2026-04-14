import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { MemoryCache } from "../src/lib/cache";
import { KvfService } from "../src/lib/kvf-service";
import { parseEpisodePage } from "../src/lib/parsers/episode-page";
import { parseFrontPage } from "../src/lib/parsers/front-page";
import { parseProgramPage } from "../src/lib/parsers/program-page";
import type { FetchResult, KvfClient } from "../src/lib/types";

const sjonFixture = await Bun.file("test/fixtures/sjon.html").text();
const vitFixture = await Bun.file("test/fixtures/vit.html").text();
const programPage0Fixture = await Bun.file("test/fixtures/program-dv-page-0.html").text();
const programPage1Fixture = await Bun.file("test/fixtures/program-dv-page-1.html").text();
const vitProgramPage0Fixture = await Bun.file("test/fixtures/program-vit-vinus-page-0.html").text();

class FakeClient implements KvfClient {
  constructor(
    private readonly handler: (url: string) => Promise<FetchResult> | FetchResult
  ) {}

  fetchHtml(url: string): Promise<FetchResult> {
    return Promise.resolve(this.handler(url));
  }
}

describe("front-page parser", () => {
  test("extracts featured programs and ordered categories", () => {
    const page = parseFrontPage(sjonFixture, "https://kvf.fo/sjon", "sjon");

    expect(page.featuredPrograms.length).toBeGreaterThan(5);
    expect(page.featuredPrograms[0]?.title).toBe("í løtuni");
    expect(page.categories[0]?.title).toBe("Nýggjasta");
    expect(page.categories[0]?.id).toBe(114);
    expect(page.categories[0]?.programCount).toBeGreaterThan(5);
    expect(page.categories[0]?.programs.some((program) => program.slug === "dv")).toBe(true);
  });

  test("extracts vit categories and marks non-program cards without an api url", () => {
    const page = parseFrontPage(vitFixture, "https://kvf.fo/sjon/vit", "vit");

    expect(page.section).toBe("vit");
    expect(page.categories[0]?.title).toBe("Føroyskar sendingar");
    expect(page.categories[0]?.programs[0]?.apiProgramUrl).toBe("/api/vit/programs/les-vimus");
    expect(page.categories.flatMap((category) => category.programs).some((program) => program.path === "/node/158986")).toBe(
      true
    );
    expect(
      page.categories
        .flatMap((category) => category.programs)
        .find((program) => program.path === "/node/158986")?.apiProgramUrl
    ).toBeNull();
  });
});

describe("program-page parser", () => {
  test("extracts program metadata, episodes, and pager info", () => {
    const page = parseProgramPage(
      programPage0Fixture,
      "https://kvf.fo/sjon/sending/dv",
      "https://kvf.fo/sjon/sending/dv?sid=206508",
      "sjon"
    );

    expect(page.program.slug).toBe("dv");
    expect(page.currentEpisodeSid).toBe("206508");
    expect(page.program.title).toContain("Dagur");
    expect(page.episodes[0]?.sid).toBe("206894");
    expect(page.episodes[0]?.publishDate).toBe("2026-04-10");
    expect(page.pager.nextPageUrl).toContain("page=1");
  });

  test("paginates and deduplicates episodes through the service", async () => {
    const lastPageFixture = programPage1Fixture.replace(
      /<ul class="pager pager-load-more">[\s\S]*?<\/ul>/,
      ""
    );

    const client = new FakeClient((url) => {
      if (url.includes("page=1")) {
        return {
          url: "https://kvf.fo/sjon/sending/dv?sid=206508&page=1",
          html: lastPageFixture
        };
      }

      return {
        url: "https://kvf.fo/sjon/sending/dv?sid=206508",
        html: programPage0Fixture
      };
    });

    const service = new KvfService(client, new MemoryCache());
    const page = await service.getProgram("dv", true);

    expect(page.episodes.length).toBeGreaterThan(20);
    expect(page.episodes.some((episode) => episode.sid === "205549")).toBe(true);
    expect(new Set(page.episodes.map((episode) => episode.sid)).size).toBe(page.episodes.length);
    expect(page.pager.pagesScraped).toBe(2);
    expect(page.pager.hasMore).toBe(false);
  });

  test("supports vit program pages through the shared parser", () => {
    const page = parseProgramPage(
      vitProgramPage0Fixture,
      "https://kvf.fo/vit/sending/sv/vinus-og-vimus",
      "https://kvf.fo/vit/sending/sv/vinus-og-vimus?sid=184370",
      "vit"
    );

    expect(page.section).toBe("vit");
    expect(page.program.slug).toBe("vinus-og-vimus");
    expect(page.currentEpisodeSid).toBe("184370");
    expect(page.program.apiProgramUrl).toBe("/api/vit/programs/vinus-og-vimus");
  });
});

describe("episode-page parser", () => {
  test("extracts playback metadata and builds the hls stream url", () => {
    const episode = parseEpisodePage(
      programPage0Fixture,
      "dv",
      "206508",
      "https://kvf.fo/sjon/sending/dv?sid=206508"
    );

    expect(episode.sid).toBe("206508");
    expect(episode.title).toBe("Dagur & vika");
    expect(episode.publishDate).toBe("2026-03-31");
    expect(episode.source.media).toBe("DOV7215_ok");
    expect(episode.source.created).toBe("2026");
    expect(episode.streamUrl).toBe(
      "https://vod.kringvarp.fo/redirect/video/_definst_/smil:smil/video/DOV7215_ok.smil?type=m3u8"
    );
    expect(episode.playbackAvailable).toBe(true);
  });
});

describe("cache behavior", () => {
  test("returns stale data when refresh fails", async () => {
    let shouldFail = false;
    const client = new FakeClient((url) => {
      if (shouldFail) {
        throw new Error(`failed for ${url}`);
      }

      return {
        url: "https://kvf.fo/sjon",
        html: sjonFixture
      };
    });

    const service = new KvfService(client, new MemoryCache());
    const first = await service.getSjonPage();
    shouldFail = true;
    const second = await service.getSjonPage(true);

    expect(second.sourceUrl).toBe(first.sourceUrl);
    expect(second.categories.length).toBe(first.categories.length);
  });
});

describe("app routes", () => {
  test("serves page-shaped and normalized responses", async () => {
    const fakeService = {
      getSjonPage: async () => ({
        fetchedAt: "2026-04-13T00:00:00.000Z",
        sourceUrl: "https://kvf.fo/sjon",
        section: "sjon" as const,
        featuredPrograms: [],
        categories: []
      }),
      getVitPage: async () => ({
        fetchedAt: "2026-04-13T00:00:00.000Z",
        sourceUrl: "https://kvf.fo/sjon/vit",
        section: "vit" as const,
        featuredPrograms: [],
        categories: []
      }),
      getProgram: async (slug: string) => ({
        sourceUrl: `https://kvf.fo/sjon/sending/${slug}`,
        finalUrl: `https://kvf.fo/sjon/sending/${slug}?sid=1`,
        section: "sjon" as const,
        program: {
          title: "Dagur og vika",
          slug,
          url: `https://kvf.fo/sjon/sending/${slug}`,
          path: `/sjon/sending/${slug}`,
          thumbnailUrl: null,
          description: null,
          apiProgramUrl: `/api/sjon/programs/${slug}`
        },
        currentEpisodeSid: "1",
        episodes: [],
        pager: {
          pagesScraped: 1,
          hasMore: false,
          nextPageUrl: null
        }
      }),
      getVitProgram: async (slug: string) => ({
        sourceUrl: `https://kvf.fo/vit/sending/sv/${slug}`,
        finalUrl: `https://kvf.fo/vit/sending/sv/${slug}?sid=1`,
        section: "vit" as const,
        program: {
          title: "Vinus og Vimús",
          slug,
          url: `https://kvf.fo/vit/sending/sv/${slug}`,
          path: `/vit/sending/sv/${slug}`,
          thumbnailUrl: null,
          description: null,
          apiProgramUrl: `/api/vit/programs/${slug}`
        },
        currentEpisodeSid: "1",
        episodes: [],
        pager: {
          pagesScraped: 1,
          hasMore: false,
          nextPageUrl: null
        }
      }),
      getEpisode: async (slug: string, sid: string) => ({
        sid,
        slug,
        title: "Dagur og vika",
        publishDate: "2026-03-31",
        thumbnailUrl: null,
        streamUrl: "https://example.test/stream.m3u8",
        playbackAvailable: true,
        source: {
          media: "MEDIA",
          created: "2026",
          episodeUrl: `https://kvf.fo/sjon/sending/${slug}?sid=${sid}`
        }
      }),
      getVitEpisode: async (slug: string, sid: string) => ({
        sid,
        slug,
        title: "Blasiljod og latipipa",
        publishDate: "2025-01-31",
        thumbnailUrl: null,
        streamUrl: "https://example.test/vit-stream.m3u8",
        playbackAvailable: true,
        source: {
          media: "MEDIA",
          created: "2025",
          episodeUrl: `https://kvf.fo/vit/sending/sv/${slug}?sid=${sid}`
        }
      }),
      refresh: async () => ({
        refreshedAt: "2026-04-13T00:00:00.000Z",
        keysCleared: ["*"],
        frontPage: {
          fetchedAt: "2026-04-13T00:00:00.000Z",
          sourceUrl: "https://kvf.fo/sjon",
          section: "sjon" as const,
          featuredPrograms: [],
          categories: []
        },
        vitPage: {
          fetchedAt: "2026-04-13T00:00:00.000Z",
          sourceUrl: "https://kvf.fo/sjon/vit",
          section: "vit" as const,
          featuredPrograms: [],
          categories: []
        }
      })
    } as unknown as KvfService;

    const app = createApp(fakeService);

    const sjonResponse = await app.request("/api/sjon");
    const vitResponse = await app.request("/api/vit");
    const sjonProgramResponse = await app.request("/api/sjon/programs/dv");
    const episodeResponse = await app.request("/api/sjon/episodes/dv/206508");
    const vitEpisodeResponse = await app.request("/api/vit/episodes/vinus-og-vimus/184370");
    const oldProgramResponse = await app.request("/api/programs/dv");
    const oldEpisodeResponse = await app.request("/api/episodes/dv/206508");

    expect(sjonResponse.status).toBe(200);
    expect((await sjonResponse.json()).sourceUrl).toBe("https://kvf.fo/sjon");
    expect(vitResponse.status).toBe(200);
    expect((await vitResponse.json()).sourceUrl).toBe("https://kvf.fo/sjon/vit");
    expect(sjonProgramResponse.status).toBe(200);
    expect(episodeResponse.status).toBe(200);
    expect((await episodeResponse.json()).streamUrl).toBe("https://example.test/stream.m3u8");
    expect(vitEpisodeResponse.status).toBe(200);
    expect((await vitEpisodeResponse.json()).streamUrl).toBe("https://example.test/vit-stream.m3u8");
    expect(oldProgramResponse.status).toBe(404);
    expect(oldEpisodeResponse.status).toBe(404);
  });
});
