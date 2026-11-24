import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ensureDemoShop } from "@/lib/reviews-service"

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

  const shop = await db.shop.findUnique({
    where: { shopDomain },
    include: {
      reviews: {
        orderBy: { publishedAt: "desc" },
        take: 50,
      },
    },
  })

  if (!shop) {
    return NextResponse.json(
      { error: "Shop not found" },
      { status: 404 }
    )
  }

  const payload = {
    shop: {
      shopDomain: shop.shopDomain,
      businessName: shop.businessName,
      placeId: shop.placeId,
      rating: shop.rating ?? 0,
      userRatingTotal: shop.userRatingTotal ?? 0,
      lastSyncedAt: shop.lastSyncedAt,
      lastSyncStatus: shop.lastSyncStatus,
      config: {
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
      },
    },
    reviews: shop.reviews.map((r) => ({
      id: r.googleId,
      author: r.authorName,
      photo: r.authorPhoto,
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
