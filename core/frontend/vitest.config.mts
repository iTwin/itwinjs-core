import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import * as packageJson from "./package.json";

const includePackages: string[] = [];

Object.keys(packageJson.peerDependencies).forEach((pkgName) => {
  if (pkgName.startsWith("@itwin") || pkgName.startsWith("@bentley")) {
    try {
      includePackages.push(pkgName);
    } catch (e) { }
  }
});

Object.keys(packageJson.dependencies).forEach((pkgName) => {
  if (pkgName.startsWith("@itwin") || pkgName.startsWith("@bentley")) {
    try {
      includePackages.push(pkgName);
    } catch (e) { }
  }
});

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    setupFiles: "./src/test/setupTests.ts",
    // include: ["**/<insert-file-name-here>.test.ts"],
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [
        { browser: "chromium" }
      ],
      headless: true,
      screenshotFailures: false
    },
    coverage: {
      provider: "v8",
      include: [
        "src/**/*"
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/test/**/*",
        "**/*.d.ts",
        "**/*.d.tsx"
      ],
      reporter: [
        "text-summary",
        "lcov",
        "cobertura"
      ],
      reportsDirectory: "./lib/cjs/test/coverage",
    },
    minWorkers: 1,
    maxWorkers: 3
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'lib/test/test-worker.js',
          dest: '.'
        },
        {
          src: 'lib/public/*',
          dest: '.'
        },
        {
          src: 'src/test/public/*',
          dest: '.'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      "../../package.json": "../package.json",
    }
  },
  optimizeDeps: {
    include: includePackages,
    force: true,
  },
})
