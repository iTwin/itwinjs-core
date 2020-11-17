/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ipcRenderer, remote } from "electron";
import Mocha = require("mocha");

// Initialize mocha
declare const window: any;
window.mocha = new Mocha();
window._CertaConsole = (name: string, args: any[] = [""]) => {
  if (args.length === 0)
    args.push("");

  return remote.getGlobal("console")[name].apply(remote.getGlobal("console"), args);
};
import "../../utils/initMocha";

window.onunhandledrejection = (event: any) => {
  const { message, stack } = event.reason;
  ipcRenderer.send("certa-error", { message, stack });
};

async function startCertaTests(entryPoint: string) {
  try {
    // Setup source maps
    window.sourceMapSupport = require("source-map-support");
    require("../../utils/initSourceMaps");

    // Load tests
    require(entryPoint);

    // Execute tests
    mocha.run((failedCount) => ipcRenderer.send("certa-done", failedCount));
  } catch ({ message, stack }) {
    ipcRenderer.send("certa-error", { message, stack });
  }
}

const certaSendToBackend = async (name: string, args: any[]) => ipcRenderer.sendSync("certa-callback", { name, args });

// Expose some globals
window.startCertaTests = startCertaTests;
window._CertaSendToBackend = certaSendToBackend;
