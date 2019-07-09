/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";

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
    filters: [{name: "iModels", extensions: ["ibim", "bim"]}],
  };

  const filenames = remote.dialog.showOpenDialog(options);
  return undefined !== filenames ? filenames[0] : undefined;
}

export function selectFileName(): string | undefined {
  if (ElectronRpcConfiguration.isElectron)
    return selectForElectron();

  const filename = prompt("Enter absolute filename:");
  return null !== filename ? filename : undefined;
}
