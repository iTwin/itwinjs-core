/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createElectronBrowserProviderOption, ElectronBrowserProvider } from "../electron/provider.js";
import { createProviderWindowOptions } from "../electron/provider-session.js";

const packageRoot = process.cwd();
const failureFixture = path.join(packageRoot, "src/test/fixtures/failure-and-wait.cjs");
const readyFixture = path.join(packageRoot, "src/test/fixtures/ready-and-wait.cjs");
const fakeProject = {
  config: {
    root: packageRoot,
    browser: { headless: true },
  },
};

function createProvider(electronArgs: string[]): ElectronBrowserProvider {
  return new ElectronBrowserProvider(
    fakeProject,
    {},
    path.join(packageRoot, "does-not-need-to-exist.js"),
    {
      electronBinary: process.execPath,
      electronArgs,
      startupTimeout: 2_000,
      closeTimeout: 2_000,
    },
  );
}

describe("Electron provider foundation", () => {
  it("uses secure BrowserWindow settings and propagates the consumer preload to Vitest's iframe", () => {
    const options = createProviderWindowOptions("/tmp/consumer-preload.cjs", true);
    expect(options.show).toBe(false);
    expect(options.webPreferences).toMatchObject({
      preload: "/tmp/consumer-preload.cjs",
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
    });
  });

  it("creates a Vitest 4 provider with parallelism disabled", () => {
    const option = createElectronBrowserProviderOption({}, "/tmp/provider-session.js");
    expect(option.name).toBe("electron");
    expect(option.supportedBrowser).toEqual(["electron"]);
    const provider = option.providerFactory(fakeProject as Parameters<typeof option.providerFactory>[0]);
    expect(provider.supportsParallelism).toBe(false);
    expect(provider.getCommandsContext("session")).toEqual({});
  });

  it("reports an Electron process that exits before the session is ready", async () => {
    const provider = createProvider(["--version"]);
    await expect(provider.openPage("early-exit", "http://127.0.0.1:1", { parallel: false }))
      .rejects.toThrow(/exited before ready/);
    await provider.close();
  });

  it("handles an IPC disconnect while cleaning up a failed session", async () => {
    const provider = createProvider([failureFixture]);
    await expect(provider.openPage("startup-failure", "http://127.0.0.1:1", { parallel: false }))
      .rejects.toThrow("fixture startup failure");
    await provider.close();
  });

  it("terminates the provider-owned process during teardown", async () => {
    const provider = createProvider([readyFixture]);
    await provider.openPage("teardown", "http://127.0.0.1:1", { parallel: false });
    await provider.close();
    await provider.close();
  });

  it("does not finish opening after teardown starts", async () => {
    const provider = createProvider([readyFixture]);
    const opening = provider.openPage("cancel-startup", "http://127.0.0.1:1", { parallel: false });
    const openingExpectation = expect(opening).rejects.toThrow("BrowserProvider is closing");

    await provider.close();
    await openingExpectation;
  });

  it("rejects parallel sessions instead of silently sharding them", async () => {
    const provider = createProvider([readyFixture]);
    await expect(provider.openPage("parallel", "http://127.0.0.1:1", { parallel: true }))
      .rejects.toThrow("does not support parallel sessions");
    await provider.close();
  });
});
