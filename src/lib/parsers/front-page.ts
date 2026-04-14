import * as cheerio from "cheerio";
import type { Category, FeaturedProgram, ProgramCard, SjonPage } from "../types";
import {
  absoluteUrl,
  buildProgramApiUrl,
  extractPathname,
  extractSlugFromPath,
  normalizeText
} from "../utils";

function parseProgramCard(element: cheerio.Cheerio<any>, titleSelector: string): ProgramCard | null {
  const link = element.find(titleSelector).find("a").first();
  const href = link.attr("href");
  const title = normalizeText(link.text());

  if (!href || !title) {
    return null;
  }

  const image = element.find("img").first().attr("src") ?? null;

  return {
    title,
    slug: extractSlugFromPath(href),
    url: absoluteUrl(href),
    path: extractPathname(href),
    thumbnailUrl: image ? absoluteUrl(image) : null,
    apiProgramUrl: buildProgramApiUrl(href)
  };
}

export function parseFrontPage(html: string, sourceUrl: string, section: "sjon" | "vit"): SjonPage {
  const $ = cheerio.load(html);

  const featuredPrograms: FeaturedProgram[] = $(".view-BANNER .swiper-banner")
    .toArray()
    .map((element) => {
      const row = $(element);
      const card = parseProgramCard(row, ".views-field-title");
      if (!card) {
        return null;
      }

      return {
        ...card,
        summary: normalizeText(row.find(".views-field-text").text()) || null
      };
    })
    .filter((value): value is FeaturedProgram => value !== null);

  const categories: Category[] = $(".view-COLL > .view-content > .view-grouping")
    .toArray()
    .map((element) => {
      const group = $(element);
      const headerText = normalizeText(group.children(".view-grouping-header").first().text());
      const nestedGroup = group.children(".view-grouping-content").children(".view-grouping").first();
      const title = normalizeText(nestedGroup.find("> .view-grouping-content > h3").first().text());
      const programs = nestedGroup
        .find("> .view-grouping-content > .swiper-row")
        .toArray()
        .map((row) => parseProgramCard($(row), ".views-field-title-1"))
        .filter((value): value is ProgramCard => value !== null);

      return {
        id: headerText ? Number(headerText) : null,
        title,
        programCount: programs.length,
        programs
      };
    })
    .filter((category) => category.title.length > 0);

  return {
    fetchedAt: new Date().toISOString(),
    sourceUrl: absoluteUrl(sourceUrl),
    section,
    featuredPrograms,
    categories
  };
}
