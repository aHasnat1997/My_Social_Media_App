import dotenv from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

// In Docker the DATABASE_URL comes from env vars directly, .env file may not exist
dotenv.config({ path: "../../apps/server/.env" });

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  ...(process.env.DATABASE_URL && {
    datasource: {
      url: process.env.DATABASE_URL,
    },
  }),
});
