# Noovi Google Reviews App

A self-hosted Google Reviews widget for Shopify that:

- **Fetches Google reviews once a day** via a cron-pinged endpoint (no per-page-load API calls = fast)
- **Configurable desktop & mobile card sizes** (width, height, gap, visible count — separate per breakpoint)
- **Shows profile picture, stars, name, date, and review text** on every card
- **Shows average star rating and total review count** in the widget header
- **RTL-aware** (defaults to on, matches noovi.co's Hebrew layout)
- **Replaces the slow entanglecommerce widget** with a 1-script embed that ships ~6 KB of JS

## What's included

- `embed.js` — the storefront script (paste into a Shopify Custom Liquid block)
- Admin dashboard at `/` — configure everything from a UI
- Backend API at `/api/reviews/public?shop=...` — cached payload, fast
- Cron endpoint at `/api/cron/refresh?token=YOUR_SECRET` — daily refresh trigger
- Search helper at `/api/admin/search-place` — find your Google Place ID by business name

## Setup (5 minutes)

### 1. Deploy this Next.js app

Deploy to Vercel, Render, Railway, or any Node host. Set env vars:

```
DATABASE_URL=file:./db/custom.db    # or a real Postgres URL
CRON_SECRET=your-random-secret-here
```

### 2. Get a Google Places API key

1. Open https://console.cloud.google.com/
2. Create a project → enable **Places API (New)**
3. Create an API key under Credentials

### 3. Find your Place ID

Open the deployed app's admin UI:

- Go to the **Config** tab
- In the **Find my Place ID** section, paste your API key and search "Your Business Name + City"
- Click the matching result — Place ID auto-fills

(For noovi.co, the Place ID is already set: `ChIJma3fi-NFHBURlbumr4zRmgQ`.)

### 4. Save & sync

- Click **Save config**
- Click **Sync now** — reviews load immediately from Google
- The widget preview on the **Preview** tab shows what shoppers will see

### 5. Install on Shopify

In Shopify admin:

1. **Online Store → Themes → Customize**
2. Add a **Custom Liquid** block where you want the reviews
3. Paste (the Install tab has a copy button with your real URL):

```html
<!-- Noovi Google Reviews -->
<div id="noovi-reviews-root"></div>
<script src="https://YOUR-APP-HOST/embed.js?shop=YOUR-SHOP.myshopify.com" async></script>
```

### 6. Set up the daily cron

Pick any cron provider and have it hit this URL once a day:

```
GET https://YOUR-APP-HOST/api/cron/refresh?token=YOUR_CRON_SECRET
```

Examples:

- **Vercel Cron** — add to `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/refresh?token=YOUR_CRON_SECRET", "schedule": "0 3 * * *" }] }
  ```
- **Render Cron Job** — URL ping, daily, 03:00
- **GitHub Actions** — scheduled workflow with `curl`

## Sizing controls (admin → Sizing tab)

- **Desktop** (screens > 767px): card width 220-500px, min-height 120-400px, gap 0-40px, 1-6 visible
- **Mobile** (screens ≤ 767px): card width 200-400px, min-height 120-400px, gap 0-30px, 1-3 visible

All sliders update the live preview instantly. **Save config** persists them; the storefront widget picks them up on next page load (or instantly if the customer's tab is open, since `embed.js` re-fetches every 5 minutes).

## Theme controls (admin → Theme tab)

- Accent color (stars + arrows) — default `#fe8403` (Google orange, matches noovi's current widget)
- Card background — default `#f6f6f8`
- Card text — default `#303030`
- Widget background — default `#ffffff`

## Behavior controls (admin → Config tab)

- Max reviews shown (1-50, default 10)
- Autoplay on/off + speed (1-15s, default 5s)
- Show/hide header (avg rating + total + write button)
- Show/hide "Write a review" button
- RTL on/off (default on for Hebrew)

## File map (this project)

- `src/app/page.tsx` — admin dashboard UI (5 tabs)
- `src/app/preview/route.ts` — iframe preview page (mounts `embed.js`)
- `src/app/api/reviews/public/route.ts` — public storefront JSON endpoint
- `src/app/api/admin/config/route.ts` — admin config GET/POST
- `src/app/api/admin/refresh/route.ts` — manual sync trigger
- `src/app/api/admin/search-place/route.ts` — Google Place ID finder
- `src/app/api/cron/refresh/route.ts` — daily cron entrypoint (token-protected)
- `src/lib/google-places.ts` — Google Places API v1 client
- `src/lib/reviews-service.ts` — refresh logic + demo seed
- `src/lib/types.ts` — shared TypeScript types
- `prisma/schema.prisma` — Shop + Review models
- `public/embed.js` — storefront widget script (also in `download/noovi-reviews-app/embed.js`)

## Replacing the current entanglecommerce widget

In your Shopify theme, find the section that currently outputs:

```html
<div id="shopify-section-google_reviews_plus_3FTrrV" class="shopify-section">
  <script shopify_url="noovi-co.myshopify.com" defer
    src="https://assets.entanglecommerce.com/google-review-assets/gr-extension.min.js"></script>
  <link href="https://assets.entanglecommerce.com/google-review-assets/gr-extension.min.css" rel="stylesheet">
  <div id="grp-entangle--root"></div>
</div>
```

Replace the inner content with:

```html
<div id="noovi-reviews-root"></div>
<script src="https://YOUR-APP-HOST/embed.js?shop=noovi-co.myshopify.com" async></script>
```

Uninstall the entanglecommerce app from your Shopify admin to stop paying for it.
