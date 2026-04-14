import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { KvfService } from "./lib/kvf-service";
import { createKvfService } from "./lib/kvf-service";

const slugSchema = z.string().min(1);
const sidSchema = z.string().regex(/^\d+$/);

export function createApp(service: KvfService = createKvfService()) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      ok: true,
      service: "kvf-scraper-api",
      now: new Date().toISOString()
    });
  });

  app.get("/api/sjon", async (c) => {
    const forceRefresh = c.req.query("refresh") === "1";
    const page = await service.getSjonPage(forceRefresh);
    return c.json(page);
  });

  app.get("/api/vit", async (c) => {
    const forceRefresh = c.req.query("refresh") === "1";
    const page = await service.getVitPage(forceRefresh);
    return c.json(page);
  });

  app.get("/api/sjon/programs/:slug", async (c) => {
    const slug = slugSchema.parse(c.req.param("slug"));
    const forceRefresh = c.req.query("refresh") === "1";
    const program = await service.getProgram(slug, forceRefresh);
    return c.json(program);
  });

  app.get("/api/vit/programs/:slug", async (c) => {
    const slug = slugSchema.parse(c.req.param("slug"));
    const forceRefresh = c.req.query("refresh") === "1";
    const program = await service.getVitProgram(slug, forceRefresh);
    return c.json(program);
  });

  app.get("/api/sjon/episodes/:slug/:sid", async (c) => {
    const slug = slugSchema.parse(c.req.param("slug"));
    const sid = sidSchema.parse(c.req.param("sid"));
    const forceRefresh = c.req.query("refresh") === "1";
    const episode = await service.getEpisode(slug, sid, forceRefresh);
    return c.json(episode);
  });

  app.get("/api/vit/episodes/:slug/:sid", async (c) => {
    const slug = slugSchema.parse(c.req.param("slug"));
    const sid = sidSchema.parse(c.req.param("sid"));
    const forceRefresh = c.req.query("refresh") === "1";
    const episode = await service.getVitEpisode(slug, sid, forceRefresh);
    return c.json(episode);
  });

  app.post("/api/refresh", async (c) => {
    const payload = await service.refresh();
    return c.json(payload);
  });

  app.onError((error, c) => {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request", details: error.flatten() }, 400);
    }

    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }

    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  });

  return app;
}
