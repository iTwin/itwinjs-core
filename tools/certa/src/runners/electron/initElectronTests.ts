/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ipcRenderer, remote } from "electron";

// NB: This has to happen _before_ we import mocha!
window._CertaConsole = (name: string, args: any[] = [""]) => {
  if (args.length === 0)
    args.push("");

  return remote.getGlobal("console")[name].apply(remote.getGlobal("console"), args);
};
import "../../utils/initLogging";

import Mocha = require("mocha");

window.onerror = (_message: any, _source: any, _lineno: any, _colno: any, error: any) => {
  const { message, stack } = error || {};
  ipcRenderer.send("certa-error", { message, stack });
};

window.onunhandledrejection = (event: any) => {
  const { message, stack } = event.reason;
  ipcRenderer.send("certa-error", { message, stack });
};

// Initialize mocha
declare const window: any;
window.mocha = new Mocha();
import "../../utils/initMocha";

async function startCertaTests(entryPoint: string) {
  try {
    // Setup source maps
    window.sourceMapSupport = require("source-map-support");
    require("../../utils/initSourceMaps");

    // Load tests
    // Note that we need to use a script tag instead of `require` here - that way debuggers can break on the first statement and resolve breakpoints.
    const script = document.createElement("script");
    script.src = entryPoint;
    const loaded = new Promise((res, rej) => {
      script.onload = res;
      script.onerror = rej;
    });
    document.head.appendChild(script);
    await loaded;

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
