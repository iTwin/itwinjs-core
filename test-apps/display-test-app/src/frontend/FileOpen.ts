/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ProcessDetector } from "@bentley/bentleyjs-core";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { OpenDialogOptions } from "electron";

export interface BrowserFileSelector {
  input: HTMLInputElement;
  directory: string;
}

export async function selectFileName(selector: BrowserFileSelector | undefined): Promise<string | undefined> {
  if (ProcessDetector.isElectronAppFrontend) {
    const opts: OpenDialogOptions = {
      properties: ["openFile"],
      filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],

    };
    const val = await ElectronApp.callDialog("showOpenDialog", opts);
    return val.canceled ? undefined : val.filePaths[0];
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  if (undefined === selector || !document.createEvent) {
    const filename = prompt("Enter absolute filename:");
    return null !== filename ? filename : undefined;
  }

  const evt = document.createEvent("MouseEvents");
  evt.initEvent("click", true, false);
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
