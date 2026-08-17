/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { TestProject } from "vitest/node";
import { composeElectronPreloadSource } from "../callbacks/electron.js";
import { createElectronBrowserProviderOption, ElectronBrowserProvider } from "../electron/provider.js";
import { createProviderWindowOptions } from "../electron/provider-session.js";

const packageRoot = process.cwd();
const readyFixture = path.join(packageRoot, "src/test/fixtures/ready-and-wait.cjs");
const fakeProject = {
  config: {
    root: packageRoot,
    browser: { headless: true },
  },
} as unknown as TestProject;

function createProvider(electronArgs: string[]): ElectronBrowserProvider {
  return new ElectronBrowserProvider(fakeProject, {
    electronBinary: process.execPath,
    electronArgs,
    startupTimeout: 2_000,
    closeTimeout: 2_000,
  }, path.join(packageRoot, "does-not-need-to-exist.js"));
}

describe("Electron provider foundation", () => {
  it("uses secure BrowserWindow settings and propagates the Vitest iframe preload", () => {
    const options = createProviderWindowOptions("/tmp/provider-preload.cjs", true);
    expect(options.show).toBe(false);
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
    });
  });

  it("composes a consumer preload before the callback bridge", () => {
    const source = composeElectronPreloadSource({
      token: "session-token",
      userPreloadModule: "/tmp/consumer-preload.cjs",
    });
    expect(source.indexOf("consumer-preload.cjs")).toBeLessThan(source.indexOf("contextBridge.exposeInMainWorld"));
    expect(source).toContain("session-token");
  });

  it("creates a Vitest 4 provider with parallelism disabled", () => {
    const option = createElectronBrowserProviderOption({}, "/tmp/provider-session.js");
    expect(option.name).toBe("electron");
    expect(option.supportedBrowser).toEqual(["electron"]);
    const provider = option.providerFactory(fakeProject);
    expect(provider.supportsParallelism).toBe(false);
    expect(provider.getCommandsContext("session")).toEqual({});
  });

  it("reports an Electron process that exits before the session is ready", async () => {
    const provider = new ElectronBrowserProvider(fakeProject, {
      electronArgs: ["--version"],
      startupTimeout: 2_000,
      closeTimeout: 2_000,
    }, path.join(packageRoot, "does-not-need-to-exist.js"));
    await expect(provider.openPage("early-exit", "http://127.0.0.1:1", { parallel: false }))
      .rejects.toThrow(/exited before ready/);
    await provider.close();
  });

  it("terminates the provider-owned process during teardown", async () => {
    const provider = createProvider([readyFixture]);
    await provider.openPage("teardown", "http://127.0.0.1:1", { parallel: false });
    await provider.close();
    await provider.close();
  });

  it("rejects parallel sessions instead of silently sharding them", async () => {
    const provider = createProvider([readyFixture]);
    await expect(provider.openPage("parallel", "http://127.0.0.1:1", { parallel: true }))
      .rejects.toThrow("does not support parallel sessions");
    await provider.close();
  });
});
