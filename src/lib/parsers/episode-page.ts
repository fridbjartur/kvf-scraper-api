import { absoluteUrl, parseDateText } from "../utils";
import type { EpisodeDetail } from "../types";

function matchVariable(html: string, name: string): string | null {
  const pattern = new RegExp(`var\\s+${name}\\s*=\\s*'([^']*)';`);
  return html.match(pattern)?.[1] ?? null;
}

export function parseEpisodePage(html: string, slug: string, sid: string, finalUrl: string): EpisodeDetail {
  const media = matchVariable(html, "media");
  const created = matchVariable(html, "created");
  const title = matchVariable(html, "title") ?? slug;
  const image = matchVariable(html, "image");
  const publishDate =
    parseDateText(html.match(/<div id="sending_publish">([\s\S]*?)<\/div>/)?.[1] ?? null);

  const streamUrl = media
    ? absoluteUrl(
        `https://vod.kringvarp.fo/redirect/video/_definst_/smil:smil/video/${media}.smil?type=m3u8`
      )
    : null;

  return {
    sid,
    slug,
    title,
    publishDate,
    thumbnailUrl: image ? absoluteUrl(image) : null,
    streamUrl,
    playbackAvailable: Boolean(streamUrl),
    source: {
      media,
      created,
      episodeUrl: absoluteUrl(finalUrl)
    }
  };
}
