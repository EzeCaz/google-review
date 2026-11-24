import { NextRequest, NextResponse } from "next/server"
import { refreshAllShops } from "@/lib/reviews-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/refresh?token=<CRON_SECRET>
 *
 * Daily cron entrypoint. Protect with a shared secret token.
 * Wire to Vercel Cron, Render Cron Job, GitHub Actions scheduled workflow,
 * or any other cron provider that pings a URL daily.
 *
 * Env: CRON_SECRET — set this in your hosting provider. The ?token= must match.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET env var is not set on the server." },
      { status: 500 }
    )
  }
  const token = req.nextUrl.searchParams.get("token") || ""
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const startedAt = new Date()
  await refreshAllShops()
  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date(),
  })
}
