// Per-platform embed URL builders, given a submitted post URL. Facebook has
// no public oEmbed/embed surface without a Meta App ID, so it's link-out only.

function idFrom(re: RegExp, url: string): string | null {
  const m = url.match(re);
  return m ? m[1] : null;
}

export function getEmbedUrl(platform: string, postUrl: string): string | null {
  switch (platform) {
    case "youtube": {
      const id = idFrom(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/, postUrl);
      // playsinline keeps it in our frame; a Short embeds from the same /embed/ path.
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1` : null;
    }
    case "tiktok": {
      const id = idFrom(/\/video\/(\d+)/, postUrl);
      return id ? `https://www.tiktok.com/embed/v2/${id}` : null;
    }
    case "instagram": {
      const m = postUrl.match(/\/(p|reel|tv)\/([^/?#]+)/);
      return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/` : null;
    }
    case "twitter": {
      const id = idFrom(/\/status\/(\d+)/, postUrl);
      return id ? `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark` : null;
    }
    default:
      return null; // facebook, or an unrecognized URL shape
  }
}

// A free, stable poster for a linked video when we have no stored thumbnail.
// Only YouTube exposes a predictable public still by video id; TikTok/Instagram
// have no equivalent without scraping, so they keep falling back to the tinted
// platform gradient until the scraper stores a real thumbnail.
export function derivedPosterUrl(platform: string | null | undefined, postUrl: string | null | undefined): string | null {
  if (!postUrl || platform !== "youtube") return null;
  const id = idFrom(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/, postUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

// Which embeds are vertical (9:16) so we render them in a tall portrait frame
// instead of letterboxing them into a 16:9 box: TikTok, Instagram Reels, and
// YouTube Shorts (detected from the /shorts/ path — a normal YouTube watch link
// stays landscape).
export function isPortraitEmbed(platform: string, postUrl: string): boolean {
  if (platform === "tiktok" || platform === "instagram") return true;
  if (platform === "youtube" && /\/shorts\//.test(postUrl)) return true;
  return false;
}

// A video the creator uploaded from their own machine: it lives in our bucket,
// so there is no platform, no post to embed, and no scraped thumbnail — we play
// the file itself with a native <video> and let the browser paint frame one as
// the poster. Detected by extension so it works regardless of which bucket host
// the URL resolves to.
export function isDirectVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/)[0];
  return /\.(mp4|mov|m4v|webm|ogv|ogg|qt)$/i.test(path);
}
