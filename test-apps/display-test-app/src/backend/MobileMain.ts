/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHostOpts } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";

// const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));

const dtaMobileMain = (async () => {
  // await sleep(10000);
  // debugger; // eslint-disable-line no-debugger

  const opts: MobileHostOpts = {
    mobileHost: {
      rpcInterfaces: getRpcInterfaces(),
    },
  };

  // Initialize the backend
  await initializeDtaBackend(opts);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
