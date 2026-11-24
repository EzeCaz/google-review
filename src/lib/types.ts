/**
 * Shared types between admin UI, admin API, and public API.
 */

export interface ShopConfig {
  desktopCardWidth: number
  desktopCardHeight: number
  desktopCardGap: number
  desktopCardsVisible: number
  mobileCardWidth: number
  mobileCardHeight: number
  mobileCardGap: number
  mobileCardsVisible: number
  accentColor: string
  cardBg: string
  cardTextColor: string
  widgetBg: string
  maxReviews: number
  autoplay: boolean
  autoplaySpeed: number
  showHeader: boolean
  showWriteButton: boolean
  rtl: boolean
}

export interface ShopData {
  id: string
  shopDomain: string
  businessName: string | null
  placeId: string | null
  googleApiKey: string | null
  rating: number | null
  userRatingTotal: number | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  config: ShopConfig
}

export interface PublicReview {
  id: string
  author: string
  photo: string | null
  rating: number
  text: string
  language: string | null
  publishedAt: string
  authorUrl: string | null
}

export interface PublicPayload {
  shop: ShopData
  reviews: PublicReview[]
  generatedAt: string
}

export interface PlaceCandidate {
  placeId: string
  displayName: string
}
