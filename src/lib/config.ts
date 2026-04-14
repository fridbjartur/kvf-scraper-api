export const config = {
  port: Number(Bun.env.PORT ?? 3000),
  userAgent:
    Bun.env.KVF_USER_AGENT ??
    "kvf-scraper-api/0.1 (+https://github.com/local/kvf-scraper-api)",
  requestTimeoutMs: Number(Bun.env.KVF_REQUEST_TIMEOUT_MS ?? 15000),
  maxConcurrency: Number(Bun.env.KVF_MAX_CONCURRENCY ?? 4),
  maxProgramPages: Number(Bun.env.KVF_MAX_PROGRAM_PAGES ?? 25),
  ttl: {
    sjonMs: Number(Bun.env.KVF_TTL_SJON_MS ?? 15 * 60 * 1000),
    programMs: Number(Bun.env.KVF_TTL_PROGRAM_MS ?? 30 * 60 * 1000),
    episodeMs: Number(Bun.env.KVF_TTL_EPISODE_MS ?? 60 * 60 * 1000)
  }
};
