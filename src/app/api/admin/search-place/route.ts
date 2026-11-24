import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { findPlaceIdByText } from "@/lib/google-places"

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  query: z.string().min(2).max(200),
  apiKey: z.string().min(10).max(300),
})

/**
 * POST /api/admin/search-place
 * Body: { query, apiKey }
 *
 * Returns up to 5 candidate { placeId, displayName } matches from Google.
 * Used by the admin UI's "Find my Place ID" feature.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  try {
    const places = await findPlaceIdByText(parsed.data.query, parsed.data.apiKey)
    return NextResponse.json({ places })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Google search failed" },
      { status: 502 }
    )
  }
}
