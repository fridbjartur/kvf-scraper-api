# kvf-scraper-api

A small Bun + TypeScript API that scrapes KVF's `Sjon` and `VIT` pages and exposes the results as structured JSON.

It fetches front pages, program pages, and episode details from `kvf.fo`, normalizes the HTML into predictable response shapes, and keeps results in a simple in-memory cache to reduce repeated scraping.

## Features

- Scrapes KVF `Sjon` and `VIT` content into JSON
- Exposes program and episode data through a Hono API
- Parses KVF HTML with Cheerio
- Validates route params with Zod
- Uses in-memory TTL caching with stale-on-error fallback

## Stack

- Bun
- TypeScript
- Hono
- Cheerio
- Zod

## Getting Started

```bash
npm install
npm run dev
```

The server starts on `http://localhost:3000` by default.

## Scripts

```bash
npm run dev
npm run start
npm run test
npm run typecheck
```

## API

```text
GET  /health
GET  /api/sjon
GET  /api/vit
GET  /api/sjon/programs/:slug
GET  /api/vit/programs/:slug
GET  /api/sjon/episodes/:slug/:sid
GET  /api/vit/episodes/:slug/:sid
POST /api/refresh
```

All read endpoints support `?refresh=1` to bypass cache for that request.

## Environment

Optional environment variables:

- `PORT` default: `3000`
- `KVF_USER_AGENT`
- `KVF_REQUEST_TIMEOUT_MS` default: `15000`
- `KVF_MAX_CONCURRENCY` default: `4`
- `KVF_MAX_PROGRAM_PAGES` default: `25`
- `KVF_TTL_SJON_MS` default: `900000`
- `KVF_TTL_PROGRAM_MS` default: `1800000`
- `KVF_TTL_EPISODE_MS` default: `3600000`

## Notes

- The scraper depends on KVF's current HTML structure, so parser updates may be needed if the site changes.
- Cache storage is in memory only, so it resets when the process restarts.
