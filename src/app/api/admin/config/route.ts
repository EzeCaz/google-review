import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { ensureDemoShop } from "@/lib/reviews-service"
import type { ShopConfig } from "@/lib/types"

export const dynamic = "force-dynamic"

const ConfigSchema = z.object({
  shopDomain: z.string().min(1).max(255),
  businessName: z.string().max(120).optional().nullable(),
  placeId: z.string().max(200).optional().nullable(),
  googleApiKey: z.string().max(300).optional().nullable(),

  desktopCardWidth: z.number().int().min(180).max(600).optional(),
  desktopCardHeight: z.number().int().min(80).max(600).optional(),
  desktopCardGap: z.number().int().min(0).max(80).optional(),
  desktopCardsVisible: z.number().int().min(1).max(8).optional(),
  mobileCardWidth: z.number().int().min(160).max(600).optional(),
  mobileCardHeight: z.number().int().min(80).max(600).optional(),
  mobileCardGap: z.number().int().min(0).max(80).optional(),
  mobileCardsVisible: z.number().int().min(1).max(4).optional(),

  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  cardBg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  cardTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widgetBg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),

  maxReviews: z.number().int().min(1).max(50).optional(),
  autoplay: z.boolean().optional(),
  autoplaySpeed: z.number().int().min(1000).max(30000).optional(),
  showHeader: z.boolean().optional(),
  showWriteButton: z.boolean().optional(),
  rtl: z.boolean().optional(),
})

/**
 * GET /api/admin/config?shop=<shopDomain>
 *
 * Returns the FULL config including googleApiKey (admin only — never expose publicly).
 */
export async function GET(req: NextRequest) {
  const shopDomain = (req.nextUrl.searchParams.get("shop") || "")
    .trim()
    .toLowerCase()
  if (!shopDomain) {
    return NextResponse.json({ error: "Missing ?shop= param" }, { status: 400 })
  }
  await ensureDemoShop()
  const shop = await db.shop.findUnique({ where: { shopDomain } })
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

  // Group flat fields into nested config so the client type is shared with the
  // public endpoint.
  const config: ShopConfig = {
    desktopCardWidth: shop.desktopCardWidth,
    desktopCardHeight: shop.desktopCardHeight,
    desktopCardGap: shop.desktopCardGap,
    desktopCardsVisible: shop.desktopCardsVisible,
    mobileCardWidth: shop.mobileCardWidth,
    mobileCardHeight: shop.mobileCardHeight,
    mobileCardGap: shop.mobileCardGap,
    mobileCardsVisible: shop.mobileCardsVisible,
    accentColor: shop.accentColor,
    cardBg: shop.cardBg,
    cardTextColor: shop.cardTextColor,
    widgetBg: shop.widgetBg,
    maxReviews: shop.maxReviews,
    autoplay: shop.autoplay,
    autoplaySpeed: shop.autoplaySpeed,
    showHeader: shop.showHeader,
    showWriteButton: shop.showWriteButton,
    rtl: shop.rtl,
  }

  return NextResponse.json({
    shop: {
      id: shop.id,
      shopDomain: shop.shopDomain,
      businessName: shop.businessName,
      placeId: shop.placeId,
      googleApiKey: shop.googleApiKey,
      rating: shop.rating,
      userRatingTotal: shop.userRatingTotal,
      lastSyncedAt: shop.lastSyncedAt,
      lastSyncStatus: shop.lastSyncStatus,
      lastSyncError: shop.lastSyncError,
      config,
    },
  })
}

/**
 * POST /api/admin/config
 * Body: ConfigSchema (partial). Updates the matching shop row.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = ConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data
  const shopDomain = (data.shopDomain || "").trim().toLowerCase()
  if (!shopDomain) return NextResponse.json({ error: "shopDomain required" }, { status: 400 })

  await ensureDemoShop()

  const { shopDomain: _ignored, ...update } = data
  const shop = await db.shop.update({
    where: { shopDomain },
    data: update as any,
  })

  return NextResponse.json({ ok: true, shop })
}
