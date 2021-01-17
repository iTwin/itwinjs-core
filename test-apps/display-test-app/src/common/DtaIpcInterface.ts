/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { OpenDialogOptions, OpenDialogReturnValue } from "electron";

export const dtaChannel = "dta";

export interface DtaIpcInterface {
  openFile: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
}
