import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct URL (port 5432) for schema operations and migrations
    // Pooled URL (port 6543) is for runtime queries via Next.js
    url: process.env["DIRECT_URL"],
  },
});
