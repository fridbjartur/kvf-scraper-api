import { MemoryCache } from "./cache";
import { config } from "./config";
import { HttpKvfClient } from "./kvf-client";
import { parseEpisodePage } from "./parsers/episode-page";
import { parseFrontPage } from "./parsers/front-page";
import { parseProgramPage } from "./parsers/program-page";
import type {
  CacheEntry,
  CacheStore,
  EpisodeDetail,
  KvfClient,
  ProgramPage,
  SjonPage
} from "./types";
import { absoluteUrl, uniqueBy } from "./utils";

export class KvfService {
  constructor(
    private readonly client: KvfClient = new HttpKvfClient(),
    private readonly cache: CacheStore = new MemoryCache()
  ) {}

  async getSjonPage(forceRefresh = false): Promise<SjonPage> {
    return this.readThroughCache(
      "sjon:frontpage",
      config.ttl.sjonMs,
      forceRefresh,
      async () => {
        const result = await this.client.fetchHtml("/sjon");
        return parseFrontPage(result.html, result.url, "sjon");
      }
    );
  }

  async getVitPage(forceRefresh = false): Promise<SjonPage> {
    return this.readThroughCache(
      "vit:frontpage",
      config.ttl.sjonMs,
      forceRefresh,
      async () => {
        const result = await this.client.fetchHtml("/sjon/vit");
        return parseFrontPage(result.html, result.url, "vit");
      }
    );
  }

  async getProgram(slug: string, forceRefresh = false): Promise<ProgramPage> {
    return this.readThroughCache(`program:sjon:${slug}`, config.ttl.programMs, forceRefresh, async () => {
      const initial = await this.client.fetchHtml(`/sjon/sending/${slug}`);
      const firstPage = parseProgramPage(initial.html, `/sjon/sending/${slug}`, initial.url, "sjon");
      const episodes = [...firstPage.episodes];

      let nextPageUrl = firstPage.pager.nextPageUrl;
      let pagesScraped = 1;

      while (nextPageUrl && pagesScraped < config.maxProgramPages) {
        const page = await this.client.fetchHtml(nextPageUrl);
        const parsed = parseProgramPage(page.html, nextPageUrl, page.url, "sjon");
        episodes.push(...parsed.episodes);
        nextPageUrl = parsed.pager.nextPageUrl;
        pagesScraped += 1;
      }

      return {
        ...firstPage,
        episodes: uniqueBy(episodes, (episode) => episode.sid),
        pager: {
          pagesScraped,
          hasMore: Boolean(nextPageUrl),
          nextPageUrl
        }
      };
    });
  }

  async getVitProgram(slug: string, forceRefresh = false): Promise<ProgramPage> {
    return this.readThroughCache(`program:vit:${slug}`, config.ttl.programMs, forceRefresh, async () => {
      const initial = await this.client.fetchHtml(`/vit/sending/sv/${slug}`);
      const firstPage = parseProgramPage(initial.html, `/vit/sending/sv/${slug}`, initial.url, "vit");
      const episodes = [...firstPage.episodes];

      let nextPageUrl = firstPage.pager.nextPageUrl;
      let pagesScraped = 1;

      while (nextPageUrl && pagesScraped < config.maxProgramPages) {
        const page = await this.client.fetchHtml(nextPageUrl);
        const parsed = parseProgramPage(page.html, nextPageUrl, page.url, "vit");
        episodes.push(...parsed.episodes);
        nextPageUrl = parsed.pager.nextPageUrl;
        pagesScraped += 1;
      }

      return {
        ...firstPage,
        episodes: uniqueBy(episodes, (episode) => episode.sid),
        pager: {
          pagesScraped,
          hasMore: Boolean(nextPageUrl),
          nextPageUrl
        }
      };
    });
  }

  async getEpisode(slug: string, sid: string, forceRefresh = false): Promise<EpisodeDetail> {
    return this.readThroughCache(`episode:sjon:${slug}:${sid}`, config.ttl.episodeMs, forceRefresh, async () => {
      const result = await this.client.fetchHtml(`/sjon/sending/${slug}?sid=${sid}`);
      return parseEpisodePage(result.html, slug, sid, result.url);
    });
  }

  async getVitEpisode(slug: string, sid: string, forceRefresh = false): Promise<EpisodeDetail> {
    return this.readThroughCache(`episode:vit:${slug}:${sid}`, config.ttl.episodeMs, forceRefresh, async () => {
      const result = await this.client.fetchHtml(`/vit/sending/sv/${slug}?sid=${sid}`);
      return parseEpisodePage(result.html, slug, sid, result.url);
    });
  }

  async refresh(): Promise<{
    refreshedAt: string;
    keysCleared: string[];
    frontPage: SjonPage;
    vitPage: SjonPage;
  }> {
    this.cache.clear();
    const frontPage = await this.getSjonPage(true);
    const vitPage = await this.getVitPage(true);

    return {
      refreshedAt: new Date().toISOString(),
      keysCleared: ["sjon:*", "vit:*", "program:*", "episode:*"],
      frontPage,
      vitPage
    };
  }

  private async readThroughCache<T>(
    key: string,
    ttlMs: number,
    forceRefresh: boolean,
    loader: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get<T>(key);

    if (!forceRefresh && existing && existing.expiresAt > now) {
      return existing.value;
    }

    try {
      const value = await loader();
      const entry: CacheEntry<T> = {
        value,
        fetchedAt: now,
        expiresAt: now + ttlMs
      };
      this.cache.set(key, entry);
      return value;
    } catch (error) {
      if (existing) {
        return existing.value;
      }
      throw error;
    }
  }
}

export function createKvfService(): KvfService {
  return new KvfService();
}
