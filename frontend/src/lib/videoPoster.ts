// Capture the first frame of a locally-selected video as a JPEG poster, so an
// uploaded clip can show an instant thumbnail everywhere (creator, admin, client)
// instead of the browser re-decoding the video's first frame on every page load.
//
// Best-effort: any failure (codec the browser can't decode, a still-encoding
// file, a security error) resolves to null and the caller just uploads without
// a poster — the tile then falls back to its live first-frame render, exactly as
// before this change. It never blocks or fails the video upload.

const CAPTURE_TIMEOUT_MS = 8000;
const POSTER_MAX_EDGE = 720; // plenty for a tile; keeps the poster a few tens of KB
const POSTER_QUALITY = 0.72;

export function captureVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    // Guard: only attempt on real video files in a browser with canvas.
    if (typeof document === "undefined" || !file.type.startsWith("video/")) {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      try { video.load(); } catch { /* ignore */ }
    };
    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(blob);
    };
    const timer = setTimeout(() => done(null), CAPTURE_TIMEOUT_MS);

    const draw = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) { done(null); return; }
        const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { done(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob), "image/jpeg", POSTER_QUALITY);
      } catch {
        done(null); // e.g. a tainted-canvas SecurityError
      }
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => {
      // Nudge off frame 0 so we don't grab a black leader frame; many encoders
      // start on black. If seeking isn't supported we still draw what we have.
      const target = Math.min(0.1, (video.duration || 1) / 2);
      const onSeeked = () => draw();
      video.onseeked = onSeeked;
      try {
        video.currentTime = target;
        // If the seek is a no-op (already there / unsupported), draw anyway.
        setTimeout(() => { if (!settled) draw(); }, 600);
      } catch {
        draw();
      }
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}
