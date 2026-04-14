export type FetchResult = {
  url: string;
  html: string;
};

export type ProgramCard = {
  title: string;
  slug: string;
  url: string;
  path: string;
  thumbnailUrl: string | null;
  apiProgramUrl: string | null;
};

export type FeaturedProgram = ProgramCard & {
  summary: string | null;
};

export type Category = {
  id: number | null;
  title: string;
  programCount: number;
  programs: ProgramCard[];
};

export type SjonPage = {
  fetchedAt: string;
  sourceUrl: string;
  section: "sjon" | "vit";
  featuredPrograms: FeaturedProgram[];
  categories: Category[];
};

export type Episode = {
  sid: string;
  title: string;
  publishDate: string | null;
  thumbnailUrl: string | null;
  episodeUrl: string;
  slug: string;
};

export type ProgramPage = {
  sourceUrl: string;
  finalUrl: string;
  section: "sjon" | "vit";
  program: ProgramCard & {
    description: string | null;
  };
  currentEpisodeSid: string | null;
  episodes: Episode[];
  pager: {
    pagesScraped: number;
    hasMore: boolean;
    nextPageUrl: string | null;
  };
};

export type EpisodeDetail = {
  sid: string;
  slug: string;
  title: string;
  publishDate: string | null;
  thumbnailUrl: string | null;
  streamUrl: string | null;
  playbackAvailable: boolean;
  source: {
    media: string | null;
    created: string | null;
    episodeUrl: string;
  };
};

export interface KvfClient {
  fetchHtml(url: string): Promise<FetchResult>;
}

export interface CacheStore {
  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, entry: CacheEntry<T>): void;
  clear(): void;
}

export type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
  expiresAt: number;
};
