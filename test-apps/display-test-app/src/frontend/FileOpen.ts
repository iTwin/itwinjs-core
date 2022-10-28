/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { OpenDialogOptions } from "electron";

export interface BrowserFileSelector {
  input: HTMLInputElement;
  directory: string;
}

async function sendMessageToMobile(handlerName: string): Promise<string | undefined> {
  const anyWindow = (window as any);
  const messageHandlers = anyWindow.webkit?.messageHandlers;
  if (!messageHandlers)
    return undefined;

  const handler = messageHandlers[handlerName];
  if (handler) {
    // formulate unique name for the resolver and pass it to the native code as a parameter
    const promiseName = `DTA_${handlerName}Resolver`;
    // create a promise that will be resolved by native code (via js injection)
    const messageResponse = new Promise<string | undefined>((resolve) => {
      anyWindow[promiseName] = resolve;
    });
    handler.postMessage(promiseName);
    const result = await messageResponse;
    delete anyWindow[promiseName];
    return null !== result ? result : undefined;
  }
  return undefined;
}

export async function selectFileName(selector: BrowserFileSelector | undefined): Promise<string | undefined> {
  if (ProcessDetector.isElectronAppFrontend) {
    const opts: OpenDialogOptions = {
      properties: ["openFile"],
      title: "Open iModel",
      filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],

    };
    const val = await ElectronApp.dialogIpc.showOpenDialog(opts);
    return val.canceled ? undefined : val.filePaths[0];
  }

  if (ProcessDetector.isMobileAppFrontend) {
    // send message to native code to open a model (iOS/webkit only for now)
    const filename = await sendMessageToMobile("openModel");
    return filename;
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  if (undefined === selector || !document.createEvent) {
    const filename = prompt("Enter absolute filename:");
    return null !== filename ? filename : undefined;
  }

  const evt = new MouseEvent("click", { bubbles: true, cancelable: false });
  selector.input.dispatchEvent(evt);

  return new Promise((resolve, reject) => {
    const handler = async () => {
      selector.input.removeEventListener("change", handler);
      try {
        const files = selector.input.files;
        if (files && files.length > 0)
          resolve(`${selector.directory}/${files[0].name}`);
        else
          resolve(undefined);
      } catch (e) {
        reject(e);
      }
    };

    selector.input.addEventListener("change", handler);
  });
}
