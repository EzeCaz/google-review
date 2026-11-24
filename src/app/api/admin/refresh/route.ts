import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { refreshShopReviews, ensureDemoShop } from "@/lib/reviews-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/refresh?shop=<shopDomain>
 * Manually trigger a sync of Google reviews for the shop.
 * Bypasses the daily cron; safe to call after editing placeId / apiKey.
 */
export async function POST(req: NextRequest) {
  const shopDomain = (req.nextUrl.searchParams.get("shop") || "")
    .trim()
    .toLowerCase()
  if (!shopDomain) {
    return NextResponse.json({ error: "Missing ?shop= param" }, { status: 400 })
  }
  await ensureDemoShop()
  const shop = await db.shop.findUnique({ where: { shopDomain } })
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })
  if (!shop.placeId || !shop.googleApiKey) {
    return NextResponse.json(
      { error: "Missing placeId or googleApiKey. Set them first in the config form." },
      { status: 400 }
    )
  }
  const result = await refreshShopReviews(shop.id)
  return NextResponse.json({ result })
}
