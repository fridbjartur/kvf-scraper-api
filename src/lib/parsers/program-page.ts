import * as cheerio from "cheerio";
import type { Episode, ProgramPage } from "../types";
import {
  absoluteUrl,
  buildProgramApiUrl,
  extractSlugFromPath,
  normalizeText,
  parseDateText,
  parseSidFromUrl
} from "../utils";

export function parseProgramPage(
  html: string,
  sourceUrl: string,
  finalUrl: string,
  section: "sjon" | "vit"
): ProgramPage {
  const $ = cheerio.load(html);
  const slug = extractSlugFromPath(finalUrl || sourceUrl);
  const headerTitle = normalizeText($("h1").first().text());
  const currentEpisodeSid =
    html.match(/var __activenode="\?sid=(\d+)"/)?.[1] ??
    new URL(finalUrl).searchParams.get("sid");

  const description =
    normalizeText($(".pane-node-body, .field-name-body, .field-name-field-summary-article").first().text()) ||
    null;
  const programImage = $(".field-name-field-mynd img").first().attr("src");

  const episodes: Episode[] = $(".quicktabs-views-group")
    .toArray()
    .map((element) => {
      const row = $(element);
      const link = row.find(".views-field-title a").first();
      const href = link.attr("href");
      const title = normalizeText(link.text());

      if (!href || !title) {
        return null;
      }

      const sid = parseSidFromUrl(href);
      if (!sid) {
        return null;
      }

      const image = row.find(".views-field-field-mynd img").first().attr("src");

      return {
        sid,
        slug,
        title,
        publishDate: parseDateText(row.find(".views-field-field-publish").text()),
        thumbnailUrl: image ? absoluteUrl(image) : null,
        episodeUrl: absoluteUrl(href)
      };
    })
    .filter((value): value is Episode => value !== null);

  const nextRelativeUrl = $(".pager-load-more a").first().attr("href") ?? null;

  return {
    sourceUrl: absoluteUrl(sourceUrl),
    finalUrl: absoluteUrl(finalUrl),
    section,
    program: {
      title: headerTitle || normalizeText($("#sending_uvtitle").text()) || slug,
      slug,
      url: absoluteUrl(section === "vit" ? `/vit/sending/sv/${slug}` : `/sjon/sending/${slug}`),
      path: section === "vit" ? `/vit/sending/sv/${slug}` : `/sjon/sending/${slug}`,
      thumbnailUrl: programImage ? absoluteUrl(programImage) : null,
      description,
      apiProgramUrl: buildProgramApiUrl(
        section === "vit" ? `/vit/sending/sv/${slug}` : `/sjon/sending/${slug}`
      )
    },
    currentEpisodeSid,
    episodes,
    pager: {
      pagesScraped: 1,
      hasMore: Boolean(nextRelativeUrl),
      nextPageUrl: nextRelativeUrl ? absoluteUrl(nextRelativeUrl) : null
    }
  };
}
