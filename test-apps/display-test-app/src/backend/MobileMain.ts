/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileRpcManager } from "@bentley/mobile-manager/lib/MobileFrontend";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";

const dtaMobileMain = (async () => {
  // Initialize the backend
  await initializeDtaBackend();
  MobileRpcManager.initializeImpl(getRpcInterfaces());
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
