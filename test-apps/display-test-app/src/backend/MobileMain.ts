/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHostOpts } from "@bentley/mobile-manager/lib/MobileBackend";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";

const dtaMobileMain = (async () => {
  const opts: MobileHostOpts = {
    mobileHost: {
      authConfig: {
        clientId: "imodeljs-electron-test",
        redirectUri: "imodeljs://app/signin-callback",
        scope: "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party imodel-extension-service-api imodeljs-router offline_access",
      },
      rpcInterfaces: getRpcInterfaces(),
    },
  };

  // Initialize the backend
  await initializeDtaBackend(opts);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
