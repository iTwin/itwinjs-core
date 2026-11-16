/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
import * as path from "path";
import { Details, WebPreferences } from "electron";
import { executeRegisteredCallback } from "../../utils/CallbackUtils";
import { relaunchInElectron } from "../../utils/SpawnUtils";
import { CertaConfig } from "../../CertaConfig";

export class ElectronTestRunner {
  public static readonly supportsCoverage = false;
  public static readonly supportsCleanup = false;
  public static async initialize(config: CertaConfig): Promise<void> {
    // Restart under electron if we're running in node
    if (!("electron" in process.versions))
      return process.exit(await relaunchInElectron());

    // If we are running in electron, we need to append any chromium CLI switches ***before*** the 'ready' event of the app module is emitted.
    const { app } = require("electron");
    if (config.debug)
      app.commandLine.appendSwitch("remote-debugging-port", String(config.ports.frontendDebugging));

    // Chromium no longer fallbacks to SwiftShader by default when no GPU is available, so we need to explicitly enable it.
    // Since headless Electron tests run with xvfb, GPU is not reachable even if it is available on the host machine.
    // More info: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md
    app.commandLine.appendSwitch("enable-unsafe-swiftshader");
    // Under xvfb, Electron's first GPU process always fails to initialize ("Exiting GPU process due to errors during
    // initialization") and Chromium relaunches it on SwiftShader. That failure can take up to ~18s, so a WebGL context
    // created before it happens is bound to the doomed GPU process and is permanently lost. Start on SwiftShader directly
    // so there is no failing first GPU process to race. Skipped in debug mode so a visible window can use a real GPU.
    // Note the GPU watchdog then applies: a single software-rendered frame over ~15s kills the GPU process, so rendering
    // tests must keep per-frame work bounded.
    if (process.platform === "linux" && !config.debug)
      app.commandLine.appendSwitch("use-angle", "swiftshader");

    // A dead GPU process otherwise only surfaces as a lost WebGL context in whichever test runs next.
    app.on("child-process-gone", (_event: unknown, details: Details) => {
      if (details.type === "GPU")
        console.error(`CERTA: Electron GPU process gone (reason: ${details.reason}, exitCode: ${details.exitCode})`);
    });

    const timeout = new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Timed out after 2 minutes when starting electron")), 2 * 60 * 1000));
    await Promise.race([app.whenReady(), timeout]);
  }

  public static async runTests(config: CertaConfig): Promise<void> {
    const { BrowserWindow, app, ipcMain } = require("electron");

    const webPreferences: WebPreferences = {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    };

    const rendererWindow = new BrowserWindow({
      show: config.debug,
      webPreferences,
    });

    const exitElectronApp = (exitCode: number) => {
      // Passing exit code to parent process doesn't seem to work anymore with electron 10 - sending message with status instead
      // See note in SpawnUtils.onExitElectronApp
      if (process.send)
        process.send({ exitCode });
      app.exit(exitCode);
    };

    ipcMain.on("certa-console", async (e: any, op: "log" | "error" | "dir", ...args: any[]) => {
      console[op](...args);
      e.returnValue = undefined; // ipcRenderer.sendSync() will hang without this
    });

    ipcMain.on("certa-done", (_e: any, count: number) => {
      rendererWindow.webContents.once("destroyed", () => {
        exitElectronApp(count);
      });
      setImmediate(() => rendererWindow.close());
    });

    ipcMain.on("certa-error", (_e: any, { message, stack }: any) => {
      console.error("Uncaught Error in Tests: ", message);
      console.error(stack);
      rendererWindow.webContents.once("destroyed", () => {
        exitElectronApp(1);
      });
      rendererWindow.close();
    });

    ipcMain.on("certa-callback", async (event: any, msg: any) => {
      event.returnValue = await executeRegisteredCallback(msg.name, msg.args);
    });

    rendererWindow.webContents.once("did-finish-load", async () => {
      const initScriptPath = require.resolve("./initElectronTests.js");
      const startTests = async () => rendererWindow.webContents.executeJavaScript(`
        var _CERTA_CONFIG = ${JSON.stringify(config)};
        require(${JSON.stringify(initScriptPath)});
        startCertaTests(${JSON.stringify(config.testBundle)});`);

      await startTests();
    });
    await rendererWindow.loadFile(path.join(__dirname, "../../../public/index.html"));
  }
}
