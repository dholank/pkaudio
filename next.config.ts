import type { NextConfig } from "next";

const tracedSourceExcludes = [
  "./app/**/*",
  "./components/**/*",
  "./docs/**/*",
  "./scripts/**/*",
  "./README.md",
  "./components.json",
  "./next.config.ts",
  "./tsconfig.json",
  "./tailwind.config.*",
  "./postcss.config.*",
  "./eslint.config.*",
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingExcludes: {
    "/settings": tracedSourceExcludes,
    "/api/backups": tracedSourceExcludes,
    "/api/backups/[id]": tracedSourceExcludes,
    "/api/backups/[id]/restore": tracedSourceExcludes,
    "/api/system": tracedSourceExcludes,
    "/api/system/doctor": tracedSourceExcludes,
  },
};

export default nextConfig;
