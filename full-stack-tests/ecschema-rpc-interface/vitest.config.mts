/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import * as dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { TestUtility, type TestBrowserAuthorizationClientConfiguration, type TestUserCredentials } from "@itwin/oidc-signin-tool";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

const envFile = path.join(packageDir, ".env");
if (fs.existsSync(envFile))
  dotenvExpand(dotenv.config({ path: envFile }));

// Sign-in and settings run in Node, where the credentials are; the browser asks for the results by name.
const getEnv: BrowserCommand<[]> = () => JSON.stringify(process.env);

const getAccessToken: BrowserCommand<[user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration]> = async (_context, user, oidcConfig) => {
  const token = oidcConfig
    ? await TestUtility.getAuthorizationClient(user, oidcConfig).getAccessToken()
    : await TestUtility.getAccessToken(user);
  if (!token)
    throw new Error("Failed to get access token");
  return token;
};

export default defineConfig({
  esbuild: {
    target: "es2022",
  },
  test: {
    dir: "src",
    include: ["frontend/**/*.test.ts"],
    testTimeout: 90000,
    hookTimeout: 90000,
    // Like Certa's single bundle: one page, files in sequence, so TestContext signs in and finds the iModel once.
    fileParallelism: false,
    isolate: false,
    browser: {
      provider: playwright({
        // The backend on port 5011 is a different origin from the test page.
        launchOptions: { args: ["--disable-web-security"] },
      }),
      enabled: true,
      instances: [
        { browser: "chromium" },
      ],
      headless: true,
      screenshotFailures: false,
      commands: { getEnv, getAccessToken },
    },
    reporters: ["default", "junit"],
    outputFile: {
      junit: "ecschema-rpcinterface-tests-result/ecschema-rpcinterface-tests-result.xml",
    },
  },
  optimizeDeps: {
    force: true,
    // Pre-bundling imodels-access-frontend would give it its own copy of core-frontend.
    include: ["chai"],
    exclude: ["@itwin/imodels-access-frontend"],
    esbuildOptions: {
      target: "es2022",
      alias: {
        "@itwin/core-frontend": path.resolve(packageDir, "../../core/frontend/lib/esm/core-frontend.js"),
      },
    },
  },
});
