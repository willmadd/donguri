import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// The DB is a remote Supabase pooler (ap-northeast-2) — every query pays
// real network RTT (~250-300ms measured from this dev machine), but a
// *fresh* connection to it costs roughly 10x that (TLS handshake + pooler
// negotiation, ~2s measured). pg.Pool's default `idleTimeoutMillis` (10s)
// was closing connections between ordinary navigations, so most page loads
// were re-paying that ~2s handshake tax on top of the unavoidable query
// RTT — this was the single biggest contributor to slow navigation. `min`
// keeps a couple of connections open persistently instead of dropping to
// zero between requests, and a much longer `idleTimeoutMillis` stops the
// rest from being torn down during normal browsing gaps. `keepAlive` sends
// TCP keepalives so nothing in between silently drops an idle connection
// before pg's own timeout would.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 10,
  idleTimeoutMillis: 5 * 60 * 1000,
  keepAlive: true,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
