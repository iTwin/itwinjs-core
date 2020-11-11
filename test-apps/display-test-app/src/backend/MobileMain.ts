/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileRpcManager } from "@bentley/imodeljs-common";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";
const dtaMobileMain = (async () => {
  // Initialize the backend
  await initializeDtaBackend();
  MobileRpcManager.initializeImpl(getRpcInterfaces("native"));
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
