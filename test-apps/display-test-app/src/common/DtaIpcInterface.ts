/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IpcInterface } from "@bentley/imodeljs-common";
import { OpenDialogOptions, OpenDialogReturnValue } from "electron";

export enum DtaEnum {
  Channel = "dta",
  Version = "1.0.2",
}

export interface DtaIpcInterface extends IpcInterface {
  openFile: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
}
