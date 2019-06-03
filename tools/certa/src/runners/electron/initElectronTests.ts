/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { remote, ipcRenderer } from "electron";
import Mocha = require("mocha");

// Initialize mocha
declare const window: any;
window.mocha = new Mocha();
window._CertaConsole = (name: string, args: any[]) => remote.getGlobal("console")[name].apply(remote.getGlobal("console"), args);
import "../../utils/initMocha";

function startCertaTests(entryPoint: string) {
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

const _CertaSendToBackend = async (name: string, args: any[]) => Promise.resolve(ipcRenderer.sendSync("certa-callback", { name, args }));

// Expose some globals
window.startCertaTests = startCertaTests;
window._CertaSendToBackend = _CertaSendToBackend;
