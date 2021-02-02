/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export const dtaChannel = "dta";

export interface DtaIpcInterface {
  sayHello: () => Promise<string>;
}
