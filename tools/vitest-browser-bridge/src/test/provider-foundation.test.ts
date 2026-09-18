/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as childProcess from "node:child_process";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createElectronBrowserProviderOption, ElectronBrowserProvider } from "../electron/provider.js";
import { createProviderWindowOptions } from "../electron/provider-session.js";

vi.mock("node:child_process", { spy: true });

const packageRoot = process.cwd();
const failureFixture = path.join(packageRoot, "src/test/fixtures/failure-and-wait.cjs");
const readyFixture = path.join(packageRoot, "src/test/fixtures/ready-and-wait.cjs");
const fakeProject = {
  config: {
    root: packageRoot,
    browser: { headless: true },
  },
};

function createProvider(electronArgs: string[], startupTimeout = 2_000): ElectronBrowserProvider {
  return new ElectronBrowserProvider(
    fakeProject,
    {},
    path.join(packageRoot, "does-not-need-to-exist.js"),
    {
      electronBinary: process.execPath,
      electronArgs,
      startupTimeout,
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

  it.each([
    { port: undefined, args: [] },
    { port: 9223, args: ["--remote-debugging-port=9223"] },
  ])("enables renderer debugging only when a port is configured: $port", async ({ port, args }) => {
    const spawn = vi.spyOn(childProcess, "spawn").mockImplementation(() => { throw new Error("spawn intercepted"); });
    try {
      const option = createElectronBrowserProviderOption({ remoteDebuggingPort: port }, "/tmp/provider-session.js");
      const provider = option.providerFactory(fakeProject as Parameters<typeof option.providerFactory>[0]);
      await expect(provider.openPage("inspector", "http://127.0.0.1:1", { parallel: false }))
        .rejects.toThrow("spawn intercepted");
      expect(spawn.mock.calls[0][1]).toEqual([...args, "/tmp/provider-session.js"]);
    } finally {
      spawn.mockRestore();
    }
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

  it("allows debugger startup without a readiness timeout", async () => {
    const provider = createProvider([readyFixture], 0);
    try {
      await provider.openPage("debug-startup", "http://127.0.0.1:1", { parallel: false });
    } finally {
      await provider.close();
    }
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
