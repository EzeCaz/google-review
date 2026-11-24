import path from 'path'
import fs from 'fs'
import os from 'os'

/**
 * JSON-file-backed store for the Noovi Reviews app.
 *
 * Why not Prisma + SQLite?
 * - Prisma's query engine binary doesn't bundle cleanly on Vercel serverless,
 *   and SQLite file locks misbehave when /tmp is per-instance.
 * - For a widget that holds ~10 rows and is refreshed daily, JSON-on-disk
 *   is simpler, faster, and has zero cold-start overhead.
 *
 * Layout (in writable /tmp on Vercel, ./db locally):
 *   {dbDir}/noovi-reviews.json — {
 *     shop: { ...config + cached rating/total + lastSync... },
 *     reviews: [ { author, photo, rating, text, publishedAt, ... }, ... ]
 *   }
 *
 * Reads are synchronous (small file, ~20KB).
 * Writes are atomic via temp-file + rename.
 */

interface ReviewRow {
  id: string
  author: string
  photo: string | null
  rating: number
  text: string
  language: string | null
  publishedAt: string
  authorUrl: string | null
  placeId: string | null
}

interface ShopRow {
  id: string
  shopDomain: string
  businessName: string | null
  placeId: string | null
  googleApiKey: string | null
  // sizing
  desktopCardWidth: number
  desktopCardHeight: number
  desktopCardGap: number
  desktopCardsVisible: number
  mobileCardWidth: number
  mobileCardHeight: number
  mobileCardGap: number
  mobileCardsVisible: number
  // theme
  accentColor: string
  cardBg: string
  cardTextColor: string
  widgetBg: string
  // behavior
  maxReviews: number
  autoplay: boolean
  autoplaySpeed: number
  showHeader: boolean
  showWriteButton: boolean
  rtl: boolean
  // sync state
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  rating: number
  userRatingTotal: number
  createdAt: string
  updatedAt: string
}

interface DBShape {
  shops: ShopRow[]
  reviews: ReviewRow[]
}

function dbDir(): string {
  if (process.env.VERCEL) {
    const d = '/tmp'
    try { fs.mkdirSync(d, { recursive: true }) } catch {}
    return d
  }
  const d = path.join(process.cwd(), 'db')
  try { fs.mkdirSync(d, { recursive: true }) } catch {}
  return d
}

function dbPath(): string {
  return path.join(dbDir(), 'noovi-reviews.json')
}

// In-process cache to avoid re-reading the file on every API call within a warm instance.
let cached: DBShape | null = null
let cachedMtime = 0

function loadDB(): DBShape {
  const p = dbPath()
  try {
    const stat = fs.statSync(p)
    if (cached && stat.mtimeMs === cachedMtime) {
      return cached
    }
    const raw = fs.readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as DBShape
    cached = parsed
    cachedMtime = stat.mtimeMs
    return parsed
  } catch {
    // File doesn't exist or is corrupt — return empty state, caller can create.
    const empty: DBShape = { shops: [], reviews: [] }
    cached = empty
    cachedMtime = 0
    return empty
  }
}

function saveDB(db: DBShape): void {
  const p = dbPath()
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, p)
  // Invalidate cache
  try {
    const stat = fs.statSync(p)
    cached = db
    cachedMtime = stat.mtimeMs
  } catch {
    cached = db
  }
}

function makeId(): string {
  return 'r_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
}

// ---------- Public API ----------

export function listAllShops(): ShopRow[] {
  return loadDB().shops
}

export function findShop(shopDomain: string): ShopRow | null {
  const db = loadDB()
  return db.shops.find((s) => s.shopDomain === shopDomain) || null
}

export function findShopReviews(shopId: string, limit = 50): ReviewRow[] {
  const db = loadDB()
  return db.reviews
    .filter((r) => r.id.startsWith(shopId) || r.placeId !== null)
    .slice(0, limit)
}

export function findShopReviewsByShopDomain(shopDomain: string, limit = 50): ReviewRow[] {
  const shop = findShop(shopDomain)
  if (!shop) return []
  const db = loadDB()
  return db.reviews
    .filter((r) => r.id.startsWith(shop.id + '_'))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
}

export function upsertShop(shop: Partial<ShopRow> & { shopDomain: string }): ShopRow {
  const db = loadDB()
  const existing = db.shops.find((s) => s.shopDomain === shop.shopDomain)
  const now = new Date().toISOString()
  if (existing) {
    Object.assign(existing, shop, { updatedAt: now })
    saveDB(db)
    return existing
  }
  const newRow: ShopRow = {
    id: makeId(),
    shopDomain: shop.shopDomain,
    businessName: shop.businessName ?? null,
    placeId: shop.placeId ?? null,
    googleApiKey: shop.googleApiKey ?? null,
    desktopCardWidth: shop.desktopCardWidth ?? 320,
    desktopCardHeight: shop.desktopCardHeight ?? 220,
    desktopCardGap: shop.desktopCardGap ?? 20,
    desktopCardsVisible: shop.desktopCardsVisible ?? 3,
    mobileCardWidth: shop.mobileCardWidth ?? 280,
    mobileCardHeight: shop.mobileCardHeight ?? 200,
    mobileCardGap: shop.mobileCardGap ?? 12,
    mobileCardsVisible: shop.mobileCardsVisible ?? 1,
    accentColor: shop.accentColor ?? '#fe8403',
    cardBg: shop.cardBg ?? '#f6f6f8',
    cardTextColor: shop.cardTextColor ?? '#303030',
    widgetBg: shop.widgetBg ?? '#ffffff',
    maxReviews: shop.maxReviews ?? 10,
    autoplay: shop.autoplay ?? true,
    autoplaySpeed: shop.autoplaySpeed ?? 5000,
    showHeader: shop.showHeader ?? true,
    showWriteButton: shop.showWriteButton ?? true,
    rtl: shop.rtl ?? true,
    lastSyncedAt: shop.lastSyncedAt ?? null,
    lastSyncStatus: shop.lastSyncStatus ?? null,
    lastSyncError: shop.lastSyncError ?? null,
    rating: shop.rating ?? 0,
    userRatingTotal: shop.userRatingTotal ?? 0,
    createdAt: now,
    updatedAt: now,
  }
  db.shops.push(newRow)
  saveDB(db)
  return newRow
}

export function setShopReviews(
  shopId: string,
  reviews: Array<Omit<ReviewRow, 'id'>>
): number {
  const db = loadDB()
  // Remove existing reviews for this shop
  db.reviews = db.reviews.filter((r) => !r.id.startsWith(shopId + '_'))
  // Add new ones
  for (const r of reviews) {
    db.reviews.push({
      ...r,
      id: shopId + '_' + (r.id || makeId()),
    })
  }
  saveDB(db)
  return reviews.length
}

export function updateShopSyncState(
  shopId: string,
  state: {
    lastSyncedAt?: string
    lastSyncStatus?: string
    lastSyncError?: string | null
    rating?: number
    userRatingTotal?: number
  }
): void {
  const db = loadDB()
  const shop = db.shops.find((s) => s.id === shopId)
  if (!shop) return
  if (state.lastSyncedAt !== undefined) shop.lastSyncedAt = state.lastSyncedAt
  if (state.lastSyncStatus !== undefined) shop.lastSyncStatus = state.lastSyncStatus
  if (state.lastSyncError !== undefined) shop.lastSyncError = state.lastSyncError
  if (state.rating !== undefined) shop.rating = state.rating
  if (state.userRatingTotal !== undefined) shop.userRatingTotal = state.userRatingTotal
  shop.updatedAt = new Date().toISOString()
  saveDB(db)
}

// For tests / inspection
export function _reset(): void {
  cached = null
  cachedMtime = 0
  try { fs.unlinkSync(dbPath()) } catch {}
}
