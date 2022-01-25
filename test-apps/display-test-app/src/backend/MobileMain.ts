/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHostOpts } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";

const dtaMobileMain = (async () => {
  const opts: MobileHostOpts = {
    mobileHost: {
      authConfig: {
        clientId: "imodeljs-electron-test",
        redirectUri: "imodeljs://app/signin-callback",
        scope: "openid email profile organization itwinjs",
      },
      rpcInterfaces: getRpcInterfaces(),
    },
  };

  // Initialize the backend
  await initializeDtaBackend(opts);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
