import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Database file resolution:
 * - Local dev: DATABASE_URL env var, defaults to file:./db/custom.db
 * - Vercel: write the SQLite file into /tmp (the only writable dir on serverless).
 *   Each cold start gets a fresh /tmp; ensureDemoShop() auto-seeds demo reviews
 *   and the daily cron re-fetches real Google reviews into the same file.
 *
 * To use a persistent Postgres instead (recommended for production multi-instance),
 * set DATABASE_URL to a postgres connection string and switch the provider in
 * prisma/schema.prisma to "postgresql".
 */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  // Vercel serverless: writable /tmp
  if (process.env.VERCEL) {
    const tmpDir = '/tmp'
    try { fs.mkdirSync(tmpDir, { recursive: true }) } catch {}
    return `file:${path.join(tmpDir, 'noovi-reviews.db')}`
  }
  // Local dev fallback
  return 'file:./db/custom.db'
}

const databaseUrl = resolveDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db