/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { isElectronRenderer } from "@bentley/bentleyjs-core";
import { ElectronFrontend } from "@bentley/electron-manager/lib/ElectronFrontend";
import { FrontendIpc } from "@bentley/imodeljs-common";
import { dtaChannel, DtaIpcInterface } from "../common/DtaIpcInterface";

export interface BrowserFileSelector {
  input: HTMLInputElement;
  directory: string;
}

export class DtaIpc {
  public static callBackend<T extends keyof DtaIpcInterface>(methodName: T, ...args: Parameters<DtaIpcInterface[T]>): ReturnType<DtaIpcInterface[T]> {
    return FrontendIpc.callBackend(dtaChannel, methodName, ...args) as ReturnType<DtaIpcInterface[T]>;
  }

  public static async selectFileElectron() {
    const val = await ElectronFrontend.callDialog("showOpenDialog", {
      properties: ["openFile"],
      filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],
    });

    return val.canceled ? undefined : val.filePaths[0];
  };
}

export async function selectFileName(selector: BrowserFileSelector | undefined): Promise<string | undefined> {
  if (isElectronRenderer)
    return DtaIpc.selectFileElectron();

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
