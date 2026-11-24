import { NextRequest, NextResponse } from "next/server"
import {
  findShop,
  findShopReviewsByShopDomain,
  ensureDemoShop,
} from "@/lib/reviews-service"
import type { ShopConfig } from "@/lib/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Public storefront endpoint — returns the cached widget payload for a shop.
 *
 * Query: ?shop=<shopDomain>   (e.g. ?shop=noovi-co.myshopify.com)
 *
 * The response is intentionally minimal so the embed script can render fast.
 * It includes: shop config + reviews list + summary (avg rating / total count).
 */
export async function GET(req: NextRequest) {
  const shopDomain = (req.nextUrl.searchParams.get("shop") || "")
    .trim()
    .toLowerCase()

  if (!shopDomain) {
    return NextResponse.json(
      { error: "Missing ?shop= param" },
      { status: 400 }
    )
  }

  // Auto-create the demo shop on first call so the widget always renders.
  await ensureDemoShop()

  const shop = findShop(shopDomain)
  if (!shop) {
    return NextResponse.json(
      { error: "Shop not found" },
      { status: 404 }
    )
  }

  const reviews = findShopReviewsByShopDomain(shopDomain, 50)

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

  const payload = {
    shop: {
      shopDomain: shop.shopDomain,
      businessName: shop.businessName,
      placeId: shop.placeId,
      rating: shop.rating,
      userRatingTotal: shop.userRatingTotal,
      lastSyncedAt: shop.lastSyncedAt,
      lastSyncStatus: shop.lastSyncStatus,
      config,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      author: r.author,
      photo: r.photo,
      rating: r.rating,
      text: r.text,
      language: r.language,
      publishedAt: r.publishedAt,
      authorUrl: r.authorUrl,
    })),
    generatedAt: new Date().toISOString(),
  }

  const res = NextResponse.json(payload)
  res.headers.set("Access-Control-Allow-Origin", "*")
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
  return res
}
