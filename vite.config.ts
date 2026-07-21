import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
  ],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    exclude: [
      "@tanstack/react-start",
      "@tanstack/start-server-core",
      "@tanstack/react-router"
    ],
  },
  server: {
    host: "::",
    port: 8080,
    // Don't watch the Playwright test artifacts directory. Each test
    // run writes screenshots / traces / videos into
    // `tests/output/...`; if Vite treats those as source changes it
    // will issue a full page reload in the middle of an interaction
    // (e.g. opening a Select dropdown), which makes the test flaky.
    // We also exclude the spec files themselves and the prisma
    // directory, which holds the dev SQLite DB.
    watch: {
      ignored: [
        "**/tests/output/**",
        "**/tests/**/*.{spec,test}.{ts,tsx,mjs,js}",
        "**/prisma/**",
        "**/.git/**",
        "**/node_modules/**",
      ],
    },
  },
});
