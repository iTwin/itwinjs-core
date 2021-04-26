/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
import * as path from "path";
import { executeRegisteredCallback } from "../../utils/CallbackUtils";
import { relaunchInElectron } from "../../utils/SpawnUtils";
import { CertaConfig } from "../../CertaConfig";

export class ElectronTestRunner {
  public static readonly supportsCoverage = false;
  public static async initialize(config: CertaConfig): Promise<void> {
    // Restart under electron if we're running in node
    if (!("electron" in process.versions))
      return process.exit(await relaunchInElectron());

    // If we are running in electron, we need to append any chromium CLI switches ***before*** the 'ready' event of the app module is emitted.
    const { app } = require("electron");
    if (config.debug)
      app.commandLine.appendSwitch("remote-debugging-port", String(config.ports.frontendDebugging));

    const timeout = new Promise((_resolve, reject) => setTimeout(() => reject("Timed out after 2 minutes when starting electron"), 2 * 60 * 1000));
    await Promise.race([app.whenReady(), timeout]);
  }

  public static async runTests(config: CertaConfig): Promise<void> {
    const { BrowserWindow, app, ipcMain } = require("electron"); // eslint-disable-line @typescript-eslint/naming-convention

    const rendererWindow = new BrowserWindow({
      show: config.debug,
      webPreferences: {
        nodeIntegration: true,
        enableRemoteModule: true,
      },
    });

    const exitElectronApp = (exitCode: number) => {
      // Passing exit code to parent process doesn't seem to work anymore with electron 10 - sending message with status instead
      // See note in SpawnUtils.onExitElectronApp
      if (process.send)
        process.send({ exitCode });
      app.exit(exitCode);
    };

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
