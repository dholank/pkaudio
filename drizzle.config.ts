import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.PKAUDIO_DB_PATH ?? "./data/pkaudio.sqlite",
  },
  verbose: true,
  strict: true,
});
