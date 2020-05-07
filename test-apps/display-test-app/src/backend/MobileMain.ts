/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileRpcManager } from "@bentley/imodeljs-common";
import { getRpcInterfaces, initializeBackend } from "./backend";

(async () => {
  // Initialize the backend
  await initializeBackend();
  MobileRpcManager.initializeImpl(getRpcInterfaces("native"));
})(); // tslint:disable-line:no-floating-promises
