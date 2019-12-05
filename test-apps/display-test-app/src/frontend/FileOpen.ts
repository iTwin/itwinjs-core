/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";

export interface BrowserFileSelector {
  input: HTMLInputElement;
  directory: string;
}

// Only want the following imports if we are using electron and not a browser -----
// tslint:disable-next-line:variable-name
let remote: any;
if (ElectronRpcConfiguration.isElectron) {
  // tslint:disable-next-line:no-var-requires
  remote = require("electron").remote;
}

function selectForElectron(): string | undefined {
  const options = {
    properties: ["openFile"],
    filters: [{ name: "iModels", extensions: ["ibim", "bim"] }],
  };

  const filenames = remote.dialog.showOpenDialogSync(options);
  return undefined !== filenames ? filenames[0] : undefined;
}

export async function selectFileName(selector: BrowserFileSelector | undefined): Promise<string | undefined> {
  if (ElectronRpcConfiguration.isElectron)
    return Promise.resolve(selectForElectron());

  if (undefined === selector || !document.createEvent) {
    const filename = prompt("Enter absolute filename:");
    return Promise.resolve(null !== filename ? filename : undefined);
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
          resolve(selector.directory + "/" + files[0].name);
        else
          resolve(undefined);
      } catch (e) {
        reject(e);
      }
    };

    selector.input.addEventListener("change", handler);
  });
}
