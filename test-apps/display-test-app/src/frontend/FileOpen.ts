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

export class MobileMessenger {
  private static _anyWindow: any = window;

  public static getHandler(handlerName: string): ((data: string) => any) | undefined {
    const messageHandlers = ProcessDetector.isIOSAppFrontend ? this._anyWindow.webkit?.messageHandlers : this._anyWindow.DTA_Android;
    if (!messageHandlers) {
      console.log("No message handler found for this platform!"); // eslint-disable-line no-console
      return undefined;
    }

    const handler = messageHandlers[handlerName];
    if (!handler) {
      console.log(`No message handler found with name: ${handlerName}!`); // eslint-disable-line no-console
      return undefined;
    }

    if (ProcessDetector.isIOSAppFrontend) {
      return (data: string) => {
        handler.postMessage(data);
      };
    } else {
      return (data: string) => {
        // Calling handler(data) here doesn't work for some reason, gives this error: "Java bridge method can't be invoked on a non-injected object"
        this._anyWindow.DTA_Android[handlerName](data);
      };
    }
  }

  public static postMessage(handlerName: string, data: string): boolean {
    const handler = this.getHandler(handlerName);
    if (!handler)
      return false;
    handler(data);
    return true;
  }

  public static async sendMessage(handlerName: string): Promise<string | undefined> {
    const handler = this.getHandler(handlerName);
    if (!handler)
      return undefined;

    // formulate unique name for the promise resolver and pass it to the native code as a parameter
    const resolverName = `DTA_${handlerName}Resolver`;

    // create a promise that will be resolved by native code (via js injection)
    const messageResponse = new Promise<string | undefined>((resolve) => {
      this._anyWindow[resolverName] = resolve;
    });

    handler(resolverName);
    const result = await messageResponse;
    delete this._anyWindow[resolverName];
    return null !== result ? result : undefined;
  }
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
    // send message to native code to open a model
    const filename = await MobileMessenger.sendMessage("openModel");
    return filename;
  }

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
