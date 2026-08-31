This is **Donguri**, a [Next.js](https://nextjs.org) app bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app), using [Supabase](https://supabase.com) for auth and [Prisma](https://www.prisma.io) for typed database access.

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql) — it creates the `profiles` table (with a `user` / `admin` `role` column), row-level security policies, and a trigger that auto-creates a profile whenever someone signs up. **This SQL file is the source of truth for the schema**, not Prisma Migrate — Supabase-managed things like the `auth.users` link, RLS policies, and triggers aren't something Prisma models.
3. Copy `.env.example` to `.env` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API**.
   - `DATABASE_URL` / `DIRECT_URL` from **Project Settings → Database → Connection string** (see the comments in `.env.example` for which pooling mode each needs).
4. Run `npx prisma generate` (also runs automatically on `npm install` via the `postinstall` script) to generate the Prisma Client into `generated/prisma`.
5. If you change `supabase/schema.sql` later, re-run it in the SQL Editor, then run `npm run db:pull` to resync `prisma/schema.prisma`, followed by `npm run db:generate`.
6. To make someone an admin, run in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'someone@example.com';
   ```
   There is no public sign-up path to admin — new accounts always start as `user`.

Note: Prisma connects to Postgres directly with its own role, so it does not carry the caller's Supabase session — RLS policies don't apply to it the way they do to `supabase-js` queries. `lib/dal.ts` is the authorization boundary for Prisma reads (it always scopes queries to the verified session's user id).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
