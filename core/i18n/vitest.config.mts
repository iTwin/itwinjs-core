import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";
import type { Plugin } from "vite";

// Vitest browser mode serves test pages at /__vitest_test__/..., so relative
// fetch("locales/en/Default.json") resolves to a nested path that hits vitest's
// catch-all HTML handler. This plugin intercepts any URL ending in /locales/*.json
// and serves the file directly from src/test/public/locales/.
function serveLocales(): Plugin {
  return {
    name: "serve-locales",
    enforce: "pre",
    configureServer(server) {
      // This runs BEFORE Vite's internal middleware
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          const match = req.url.match(/\/locales\/([^?]+\.json)(?:\?.*)?$/);
          if (match) {
            const filePath = path.resolve(__dirname, "src/test/public/locales", match[1]);
            if (fs.existsSync(filePath)) {
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  plugins: [serveLocales()],
  test: {
    dir: "src",
    testTimeout: 10000,
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [
        {
          browser: "chromium",
          launch: {
            args: ["--disable-web-security", "--no-sandbox"],
          },
        },
      ],
      headless: true,
      screenshotFailures: false,
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*"],
      exclude: ["src/test/**/*", "**/*.d.ts"],
      reporter: ["text-summary", "lcov", "cobertura"],
      reportsDirectory: "./lib/cjs/test/coverage",
    },
    reporters: ["default", ["junit", { outputFile: "lib/test/junit_results.xml" }]],
  },
  publicDir: "src/test/public",
});
