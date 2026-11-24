/**
 * Google Places API (New) client.
 *
 * Docs:
 *   Place Details (Text Search / Find Place from Query first to get placeId)
 *   https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * The new Places API (v1) endpoint:
 *   GET https://places.googleapis.com/v1/places/{placeId}?fields=...
 *
 * For reviews we need: displayName, rating, userRatingCount, reviews
 */

export interface GoogleReview {
  authorName: string
  authorPhotoUri?: string
  rating: number          // 1..5
  text: string
  languageCode?: string
  publishTime: string     // RFC3339
  // google doesn't expose a stable author id in Places API v1; we synthesize one
  // from authorName + publishTime so the same review is stable across fetches.
  googleId: string
  authorUrl?: string      // google maps contributor url (synthesized)
}

export interface PlaceDetails {
  placeId: string
  displayName?: string
  rating?: number
  userRatingCount?: number
  reviews: GoogleReview[]
  raw?: any
}

const PLACES_BASE = "https://places.googleapis.com/v1/places"

function synthesizeGoogleId(authorName: string, publishTime: string): string {
  // Stable hash (djb2). We don't need crypto-grade.
  const s = `${authorName}|${publishTime}`
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0
  }
  return `gr_${Math.abs(hash).toString(36)}`
}

function contributorUrl(authorName: string, placeId: string): string | undefined {
  if (!placeId) return undefined
  // The old widget used https://www.google.com/maps/contrib/<id>/place/<placeId>
  // We can't reliably get the contributor id from Places API v1, so we link to
  // the place's reviews page instead, which is the next best thing.
  return `https://search.google.com/local/reviews?placeid=${placeId}`
}

export async function fetchPlaceReviews(
  placeId: string,
  apiKey: string
): Promise<PlaceDetails> {
  const fields = [
    "displayName",
    "rating",
    "userRatingCount",
    "reviews",
  ].join(",")

  const url = `${PLACES_BASE}/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}&languageCode=he&reviewsSort=newest`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields,
    },
    // We can't use a key on the URL AND header safely; use the header only (recommended).
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Places API error ${res.status}: ${body.slice(0, 500)}`)
  }

  const json: any = await res.json()

  const rawReviews: any[] = json.reviews ?? []
  const reviews: GoogleReview[] = rawReviews.map((r) => {
    const publishTime: string = r.publishTime ?? new Date().toISOString()
    const authorName: string = r.authorAttribution?.displayName ?? r.authorName ?? "Anonymous"
    const authorPhotoUri: string | undefined =
      r.authorAttribution?.photoUri ?? r.authorAttribution?.profilePhotoUri
    return {
      authorName,
      authorPhotoUri,
      rating: typeof r.rating === "number" ? r.rating : Number(r.rating ?? 0),
      text: r.originalText?.text ?? r.text?.text ?? r.text ?? "",
      languageCode: r.originalText?.languageCode ?? r.text?.languageCode,
      publishTime,
      googleId: synthesizeGoogleId(authorName, publishTime),
      authorUrl: r.authorAttribution?.uri ?? contributorUrl(authorName, placeId),
    }
  })

  return {
    placeId,
    displayName: json.displayName,
    rating: typeof json.rating === "number" ? json.rating : undefined,
    userRatingCount: typeof json.userRatingCount === "number" ? json.userRatingCount : undefined,
    reviews,
    raw: json,
  }
}

/**
 * Find a Google Place ID by text query (e.g. "Noovi Ein Dor" or "noovi.co Israel").
 * Useful for the admin "search by name" flow.
 */
export async function findPlaceIdByText(
  query: string,
  apiKey: string
): Promise<{ placeId: string; displayName: string }[]> {
  const url = "https://places.googleapis.com/v1/places:searchText"
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "he" }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Places Search Text API error ${res.status}: ${body.slice(0, 500)}`)
  }
  const json: any = await res.json()
  const places: any[] = json.places ?? []
  return places.map((p) => ({
    placeId: p.id,
    displayName: p.displayName?.text ?? "",
  }))
}
