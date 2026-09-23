import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const role = process.argv[2];
if (role !== "admin" && role !== "user") {
  throw new Error("usage: node set-test-admin.mjs <admin|user>");
}

const res = await client.query(
  `update public.profiles p
   set role = $2
   from auth.users u
   where u.id = p.id and u.email = $1
   returning p.id, p.role`,
  [process.env.TEST_USER_EMAIL, role],
);
console.table(res.rows);
await client.end();
