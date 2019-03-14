/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
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
  }

  public static async runTests(config: CertaConfig): Promise<void> {
    const { BrowserWindow, app, ipcMain } = require("electron");

    if (!app.isReady())
      await new Promise((resolve) => app.on("ready", resolve));

    const rendererWindow = new BrowserWindow({
      show: config.debug,
      webPreferences: {
        nodeIntegration: true,
      },
    });

    ipcMain.on("certa-done", (_e: any, count: number) => {
      rendererWindow.webContents.once("destroyed", () => app.exit(count));
      setImmediate(() => rendererWindow.close());
    });

    ipcMain.on("certa-error", (_e: any, { message, stack }: any) => {
      console.error("Uncaught Error in Tests: ", message);
      console.error(stack);
      rendererWindow.webContents.once("destroyed", () => app.exit(1));
      rendererWindow.close();
    });

    ipcMain.on("certa-callback", async (event: any, msg: any) => {
      event.returnValue = executeRegisteredCallback(msg.name, msg.args);
    });

    rendererWindow.loadFile(this.generateHtml(config));
    rendererWindow.webContents.once("did-finish-load", async () => {
      const startTests = async () => rendererWindow.webContents.executeJavaScript(`startCertaTests(${JSON.stringify(config.testBundle)});`);

      if (config.debug) {
        // For some reason, the VS Code chrome debugger doesn't work correctly unless we reload the window before running tests.
        await rendererWindow.webContents.executeJavaScript(`window.location.reload();`);
        // Note that we'll have to wait for the did-finish-load event again since we just reloaded.
        rendererWindow.webContents.once("did-finish-load", startTests);
        return;
      }

      await startTests();
    });
  }

  private static generateHtml(config: CertaConfig): string {
    const initScriptPath = require.resolve("./initElectronTests.js");
    const contents = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <script>
            var _CERTA_CONFIG = ${JSON.stringify(config)};
            require(${JSON.stringify(initScriptPath)});
          </script>
        </head>
      </html>`;
    const filename = path.join(__dirname, "test.html");
    fs.writeFileSync(filename, contents);
    return filename;
  }
}
