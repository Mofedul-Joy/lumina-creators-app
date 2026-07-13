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

// Which embeds are vertical (9:16) so we render them in a tall portrait frame
// instead of letterboxing them into a 16:9 box: TikTok, Instagram Reels, and
// YouTube Shorts (detected from the /shorts/ path — a normal YouTube watch link
// stays landscape).
export function isPortraitEmbed(platform: string, postUrl: string): boolean {
  if (platform === "tiktok" || platform === "instagram") return true;
  if (platform === "youtube" && /\/shorts\//.test(postUrl)) return true;
  return false;
}
