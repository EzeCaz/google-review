// Database layer is now `src/lib/store.ts` (JSON-on-disk).
//
// Prisma was removed from the runtime path because the Prisma query engine
// binary doesn't bundle cleanly on Vercel serverless, and SQLite file locks
// misbehave when /tmp is per-instance.
//
// For a reviews widget that holds ~10 rows and is refreshed daily, JSON-on-disk
// is simpler, faster, has zero cold-start overhead, and works identically on
// Vercel, Render, Railway, and local dev.
//
// To switch to a real database later (e.g. Postgres on Neon/Vercel Postgres),
// replace `src/lib/store.ts` with a Prisma-backed implementation and set
// DATABASE_URL to your Postgres connection string.

export {}
