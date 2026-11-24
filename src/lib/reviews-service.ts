import {
  findShop,
  findShopReviewsByShopDomain,
  upsertShop,
  setShopReviews,
  updateShopSyncState,
  type ShopRow,
  type ReviewRow,
} from '@/lib/store'
import { fetchPlaceReviews } from '@/lib/google-places'

/**
 * Fetches fresh reviews from Google Places API and writes them into the store.
 * Returns a summary. Safe to call from cron or admin manual trigger.
 */
export async function refreshShopReviews(shopId: string): Promise<{
  ok: boolean
  fetched: number
  rating?: number
  userRatingTotal?: number
  error?: string
}> {
  // Find shop by id
  const allShops = listAllShops()
  const shop = allShops.find((s) => s.id === shopId)
  if (!shop) return { ok: false, fetched: 0, error: 'Shop not found' }
  if (!shop.placeId || !shop.googleApiKey)
    return { ok: false, fetched: 0, error: 'Missing placeId or googleApiKey' }

  try {
    const details = await fetchPlaceReviews(shop.placeId, shop.googleApiKey)

    const rows: Array<Omit<ReviewRow, 'id'>> = details.reviews.map((r) => ({
      id: r.googleId,
      author: r.authorName,
      photo: r.authorPhotoUri ?? null,
      rating: r.rating,
      text: r.text,
      language: r.languageCode ?? null,
      publishedAt: r.publishTime,
      authorUrl: r.authorUrl ?? null,
      placeId: shop.placeId!,
    }))

    setShopReviews(shop.id, rows)
    updateShopSyncState(shop.id, {
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'ok',
      lastSyncError: null,
      rating: details.rating ?? 0,
      userRatingTotal: details.userRatingCount ?? 0,
    })

    return {
      ok: true,
      fetched: details.reviews.length,
      rating: details.rating,
      userRatingTotal: details.userRatingCount,
    }
  } catch (e: any) {
    updateShopSyncState(shop.id, {
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'error',
      lastSyncError: (e?.message ?? String(e)).slice(0, 1000),
    })
    return { ok: false, fetched: 0, error: e?.message ?? String(e) }
  }
}

/**
 * Daily cron: refresh every shop that has both placeId and apiKey set.
 */
export async function refreshAllShops(): Promise<void> {
  const shops = listAllShops().filter((s) => s.placeId && s.googleApiKey)
  for (const s of shops) {
    try {
      await refreshShopReviews(s.id)
    } catch (e) {
      console.error(`refreshAllShops shop=${s.shopDomain} failed:`, e)
    }
  }
}

import { listAllShops } from '@/lib/store'

/**
 * Seed demo reviews so the widget is usable even before a Google API key is configured.
 */
const DEMO_REVIEWS = [
  {
    authorName: 'Leah Segal',
    rating: 5,
    text: 'חיפשתי סדנא מיוחדת לחופש הגדול לי ולבנות שלי 13 ו 8. היו המון אפשרויות. חשבתי על משהו שאני ממש אוהבת ואולי אקח את הבנות לקבל טעימה. ואז ראיתי פירסום של דנה מ noovi וידעתי שזה בדיוק מה שאני רוצה. השתתפנו בסדנא במעברות עם עוד 2 משתתפות מקסימות. אוירה מקסימה של לימוד, התנסות והמון סבלנות. לא האמנתי אבל הקטנה בת 8 תפרה את הבובה כמעט לבדה עם תמיכה של דנה. 4 שעות שעברו בטיל ויצירה באמת מופלאה של כל אחת מאיתנו ❤️',
    publishTime: '2026-08-24T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocJxypK_53frBXYDnc8gM5wavUtgxDOv9lRaj9QuW-RgNPQL-Q',
  },
  {
    authorName: 'Liz',
    rating: 5,
    text: 'סדנא נהדרת!! דנה מהממת ומלאת סבלנות, הגעתי בלי ידע מקדים בתפירה ויצאה לי בובה מושלמת בזכות ההדרכה שלה! תודה ענקית, חוויה מהנה ומומלצת בחום❤️',
    publishTime: '2026-08-13T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocIklDt0tteAb8aarTCYrbeVk6lhKJ6iXmH-quJio5A_B_IHfQ',
  },
  {
    authorName: 'יהודית לוי',
    rating: 5,
    text: 'סדנה יצירתית ומיוחדת בהובלה של דנה האלופה, מליאת כשרון וסבלנות, נועם והשראה, היה נפלא ממש מזמן לא נהניתי כך❤️',
    publishTime: '2026-08-13T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a-/ALV-UjWhEmv5DSf2qFQHG3GfCjRliNrHbBTNRzRncRSYz0eE8HuYf3E',
  },
  {
    authorName: 'Anat Monakier',
    rating: 5,
    text: 'דנה מהממת והסדנה היתה מרתקת ונתנה לי כלים וידע רב שאפשרו לי לחזור הביתה ולהתחיל לישם את מה שלמדתי. הייתי שמחה ללמוד איך להכין את הבד והבגדים כדי שהחוויה תהיה מושלמת. תודה דנה♡ ומחכה להמשך...',
    publishTime: '2026-08-02T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocIorp3xvxn8kTc0u8I_tR3eFm93F1FJ5JcLk-Bt4NYPeilvXw',
  },
  {
    authorName: 'hadassi82',
    rating: 5,
    text: 'השתתפנו בסדנה של דנה ליצירת בובות, וזו הייתה חוויה מקסימה מההתחלה ועד הסוף. דנה המהממת העבירה את הסדנה במקצועיות, בסבלנות ובאווירה נעימה וכיפית, וליוותה כל אחד מאיתנו צעד אחר צעד עד לתוצאה הסופית. מומלץ מכל הלב!',
    publishTime: '2026-08-02T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocIorp3xvxn8kTc0u8I_tR3eFm93F1FJ5JcLk-Bt4NYPeilvXw',
  },
  {
    authorName: 'Marina Ashdod',
    rating: 5,
    text: 'נהניתי מאוד מהסדנה! הייתה חוויה יצירתית, נעימה ומלמדת. דנה נתנה הדרכה מקצועית וסבלנית, ובסיום יצאתי עם בובה מקסימה שהכנתי בעצמי. תודה רבה על חוויה מיוחדת ומהנה, ממליצה בחום!🌷🧵🪡🐭',
    publishTime: '2026-06-21T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocKb6RDhThEpe5elaJk1-89ozuxJVZ_8BtkTuauI858kFC0MBg',
  },
  {
    authorName: 'noa erel',
    rating: 5,
    text: 'דנה תודה רבה על סדנא מושקעת. היו אלה שעות של התנתקות ועיסוק בעבודת יד מהנה. את סובלנית, מלמדת ביסודיות ומאוד נינוחה. מומלץ בחום!!!!',
    publishTime: '2026-06-14T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocLsPW16bx76S63d5_RzcDd_vZN1ExkElwJNq6SdbrWD8ns0Ig',
  },
  {
    authorName: 'Haddas Semel',
    rating: 5,
    text: 'ממליצה בחום על הסדנא של דנה',
    publishTime: '2026-06-12T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a-/ALV-UjVAq5cbc0qpc-fP5ztTFJhQKKtB-1lRJTc_61Iq2UIWSvFctJjvjw',
  },
  {
    authorName: 'Yam',
    rating: 5,
    text: 'סדנה מקסימה, דנה הסבירה מעולה ועזרה לי להתגבר על הפחד ממכונת תפירה! מדהים איזה בובות מתוקות יצאו בסדנה אחת, תוצר סופר שווה ומזכרת מהממת!',
    publishTime: '2026-02-25T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocKhTqkNaEfHLNRd1lh6JxWfFAevmfsBWprx6MIGFclWt_k7lg',
  },
  {
    authorName: 'Rina Gadri',
    rating: 5,
    text: 'סדנת הבובות בהדרכת דנה, היה בוקר מהנה ומיוחד. כייף גדול!',
    publishTime: '2025-11-23T00:00:00.000Z',
    authorPhoto:
      'https://lh3.googleusercontent.com/a/ACg8ocJiTycsW9y-xDIijUMtmquo5U4D-aymOXYeIoxg6i0xsk6klQ',
  },
]

export async function ensureDemoShop(): Promise<ShopRow> {
  const existing = findShop('noovi-co.myshopify.com')
  if (existing) return existing

  const shop = upsertShop({
    shopDomain: 'noovi-co.myshopify.com',
    businessName: 'Noovi.co',
    placeId: 'ChIJma3fi-NFHBURlbumr4zRmgQ', // their actual Google Place ID
    googleApiKey: null,
    rating: 5.0,
    userRatingTotal: 44,
    lastSyncedAt: new Date().toISOString(),
    lastSyncStatus: 'demo',
  })

  // Seed demo reviews
  const rows: Array<Omit<ReviewRow, 'id'>> = DEMO_REVIEWS.map((r) => ({
    id: 'demo_' + (r.authorName + r.publishTime).split('').reduce((a, c) => a + c.charCodeAt(0), 0).toString(36),
    author: r.authorName,
    photo: r.authorPhoto,
    rating: r.rating,
    text: r.text,
    language: 'he',
    publishedAt: r.publishTime,
    authorUrl: `https://search.google.com/local/reviews?placeid=${shop.placeId}`,
    placeId: shop.placeId,
  }))
  setShopReviews(shop.id, rows)

  return shop
}

export { findShop, findShopReviewsByShopDomain, upsertShop }
