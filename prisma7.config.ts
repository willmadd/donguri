// Prisma ORM CLI config (v7 renamed `prisma.config.ts` to a version-scoped
// filename — `prisma7.config.ts` — see prisma --version). Used by the CLI
// (generate, db pull, migrate, studio), not by the running app: the app
// reads DATABASE_URL itself via lib/prisma.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
