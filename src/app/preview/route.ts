import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * /preview?shop=<shopDomain>
 *
 * Standalone HTML page that mounts the storefront widget using embed.js.
 * Used as the iframe content in the admin "Preview" tab.
 */
export async function GET(req: NextRequest) {
  const shopDomain = (req.nextUrl.searchParams.get("shop") || "")
    .trim()
    .toLowerCase()
  if (!shopDomain) {
    return new Response("Missing ?shop= param", { status: 400 })
  }

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reviews preview</title>
<style>
  html, body { margin: 0; padding: 0; background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  #noovi-reviews-root { width: 100%; }
</style>
</head>
<body>
<div id="noovi-reviews-root"></div>
<script src="/embed.js?shop=${encodeURIComponent(shopDomain)}" async></script>
</body>
</html>`

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "no-store",
    },
  })
}
