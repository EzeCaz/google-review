import { NextRequest, NextResponse } from "next/server"
import {
  findShop,
  findShopReviewsByShopDomain,
  ensureDemoShop,
  refreshShopReviews,
} from "@/lib/reviews-service"
import { fetchPlaceReviews } from "@/lib/google-places"
import type { ShopConfig } from "@/lib/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Public storefront endpoint — returns the cached widget payload for a shop.
 *
 * Query: ?shop=<shopDomain>   (e.g. ?shop=noovi-co.myshopify.com)
 *
 * Behavior:
 *   1. Auto-creates the demo shop if it doesn't exist (so the widget always renders).
 *   2. Reads cached reviews from the local JSON store.
 *   3. If the cached reviews are stale OR missing AND the shop has a Google API
 *      key + Place ID configured, fetches fresh reviews directly from Google
 *      Places API (with a 5-minute CDN cache so we don't burn quota).
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

  let shop = findShop(shopDomain)
  if (!shop) {
    return NextResponse.json(
      { error: "Shop not found" },
      { status: 404 }
    )
  }

  // If the shop has Google credentials AND the local cache is empty or stale
  // (lastSyncedAt > 1 hour ago, or lastSyncStatus is "demo"), fetch fresh from
  // Google directly. This works around Vercel's per-instance /tmp — any
  // instance can repopulate the cache on demand.
  const now = Date.now()
  const lastSyncMs = shop.lastSyncedAt ? new Date(shop.lastSyncedAt).getTime() : 0
  const isStale = now - lastSyncMs > 60 * 60 * 1000 // 1 hour
  const needsRefresh =
    shop.placeId &&
    shop.googleApiKey &&
    (shop.lastSyncStatus === "demo" || shop.lastSyncStatus === null || isStale)

  if (needsRefresh) {
    try {
      // Try the local store first via refreshShopReviews (writes to this instance's /tmp)
      await refreshShopReviews(shop.id)
      shop = findShop(shopDomain) || shop
    } catch (e) {
      // If the local store refresh fails, fall back to direct fetch + use it
      // without persisting (still returns correct data to the caller)
      try {
        const details = await fetchPlaceReviews(shop.placeId!, shop.googleApiKey!)
        // Update shop-level cached stats but use the fetched reviews directly
        const payload = buildPayload(shop, details.reviews.map((r) => ({
          id: r.googleId,
          author: r.authorName,
          photo: r.authorPhotoUri ?? null,
          rating: r.rating,
          text: r.text,
          language: r.languageCode ?? null,
          publishedAt: r.publishTime,
          authorUrl: r.authorUrl ?? null,
        })), {
          rating: details.rating ?? shop.rating,
          userRatingTotal: details.userRatingCount ?? shop.userRatingTotal,
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: "ok",
        })
        const res = NextResponse.json(payload)
        res.headers.set("Access-Control-Allow-Origin", "*")
        // Cache for 5 minutes at the CDN, 60s in browser
        res.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
        return res
      } catch (fetchErr: any) {
        // Both paths failed; return whatever's in the local cache (demo data)
        // so the widget still renders. The error is logged in the shop's
        // lastSyncError field for debugging.
      }
    }
  }

  // Build payload from local store
  const reviews = findShopReviewsByShopDomain(shopDomain, 50)

  const payload = buildPayload(shop, reviews.map((r) => ({
    id: r.id,
    author: r.author,
    photo: r.photo,
    rating: r.rating,
    text: r.text,
    language: r.language,
    publishedAt: r.publishedAt,
    authorUrl: r.authorUrl,
  })), {
    rating: shop.rating,
    userRatingTotal: shop.userRatingTotal,
    lastSyncedAt: shop.lastSyncedAt,
    lastSyncStatus: shop.lastSyncStatus,
  })

  const res = NextResponse.json(payload)
  res.headers.set("Access-Control-Allow-Origin", "*")
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
  return res
}

function buildPayload(
  shop: ReturnType<typeof findShop> & {},
  reviews: Array<{
    id: string
    author: string
    photo: string | null
    rating: number
    text: string
    language: string | null
    publishedAt: string
    authorUrl: string | null
  }>,
  syncInfo: {
    rating: number | null
    userRatingTotal: number | null
    lastSyncedAt: string | null
    lastSyncStatus: string | null
  }
) {
  const config: ShopConfig = {
    desktopCardWidth: shop!.desktopCardWidth,
    desktopCardHeight: shop!.desktopCardHeight,
    desktopCardGap: shop!.desktopCardGap,
    desktopCardsVisible: shop!.desktopCardsVisible,
    mobileCardWidth: shop!.mobileCardWidth,
    mobileCardHeight: shop!.mobileCardHeight,
    mobileCardGap: shop!.mobileCardGap,
    mobileCardsVisible: shop!.mobileCardsVisible,
    accentColor: shop!.accentColor,
    cardBg: shop!.cardBg,
    cardTextColor: shop!.cardTextColor,
    widgetBg: shop!.widgetBg,
    maxReviews: shop!.maxReviews,
    autoplay: shop!.autoplay,
    autoplaySpeed: shop!.autoplaySpeed,
    showHeader: shop!.showHeader,
    showWriteButton: shop!.showWriteButton,
    rtl: shop!.rtl,
  }

  return {
    shop: {
      shopDomain: shop!.shopDomain,
      businessName: shop!.businessName,
      placeId: shop!.placeId,
      rating: syncInfo.rating,
      userRatingTotal: syncInfo.userRatingTotal,
      lastSyncedAt: syncInfo.lastSyncedAt,
      lastSyncStatus: syncInfo.lastSyncStatus,
      config,
    },
    reviews,
    generatedAt: new Date().toISOString(),
  }
}
