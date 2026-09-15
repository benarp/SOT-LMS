/**
 * Turns a pasted video link into something an <iframe> will actually play.
 *
 * Mirrored by apps/mobile/lib/videoEmbed.ts, which differs on purpose: the
 * mobile player adds `playsinline=1` and falls back to embedding an unknown
 * URL as-is, because a WebView has no "open in a new tab" escape hatch.
 *
 * Returns null when the URL isn't something we know how to embed — callers
 * link out to it instead of rendering a player that would refuse to load.
 */
export function getEmbedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim())
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const videoId = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? u.pathname.split('/').pop()
      if (videoId) return `https://www.youtube.com/embed/${videoId}?rel=0`
    }
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
    // Other sites (e.g. Bible Project) typically block iframing — link out instead
    return null
  } catch {
    return null
  }
}
