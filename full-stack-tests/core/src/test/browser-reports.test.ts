/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import type { ViteUserConfig } from "vitest/config" with { "resolution-mode": "import" };

it("keeps Chrome and Electron JUnit reports in separate files", async () => {
  const browser = await vi.importActual<{ default: ViteUserConfig }>(resolve(__dirname, "../../vitest.browser.config.mts"));
  const electron = await vi.importActual<{ default: ViteUserConfig }>(resolve(__dirname, "../../vitest.electron.config.mts"));
  expect(browser.default.test?.reporters).toContainEqual(["junit", { outputFile: "lib/test/chrome_junit_results.xml" }]);
  expect(electron.default.test?.reporters).toContainEqual(["junit", { outputFile: "lib/test/electron_junit_results.xml" }]);
});
