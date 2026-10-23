/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHost, MobileHostOpts } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";
import { setupTestQueryHandler } from "./QueriesTest";

const dtaMobileMain = (async () => {
  const opts: MobileHostOpts = {
    mobileHost: {
      rpcInterfaces: getRpcInterfaces(),
    },
  };

  // Initialize the backend
  await initializeDtaBackend(opts);

  // Vite build replaces `process.env` with an empty object. Destructuring avoids that.
  const { env } = process;
  if (env.IMJS_DTA_INTEGRATION_TEST === "true") {
    setupTestQueryHandler();
    MobileHost.device.sendQueryToNative("dtaBackendStarted", "", () => {});
  }
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
