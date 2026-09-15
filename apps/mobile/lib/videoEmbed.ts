/**
 * Turns a stored video link into something the WebView player will accept.
 *
 * Mirrors apps/web/src/lib/videoEmbed.ts, with two deliberate differences:
 * `playsinline=1` so iOS doesn't hijack the video into fullscreen, and an
 * unknown URL is embedded as-is rather than returning null — a WebView has no
 * "open in a new tab" escape hatch the way the web player does.
 */
export function getEmbedUrl(rawUrl: string): string | null {
  // Stored URLs may have stray whitespace; iOS WebKit rejects them outright
  const url = rawUrl.trim()
  try {
    const u = new URL(url)
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const videoId = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? u.pathname.split('/').pop()
      if (videoId) return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
    // Bible Project and others — embed as-is
    return url
  } catch {
    return url
  }
}
