/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHostConfiguration } from "@itwin/core-backend";
import { MobileAuthorizationBackend, MobileHostOpts } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";

const dtaMobileMain = (async () => {
  const authBackend = new MobileAuthorizationBackend({
    clientId: process.env.IMJS_OIDC_MOBILE_TEST_CLIENT_ID ?? "",
    redirectUri: process.env.IMJS_OIDC_MOBILE_TEST_REDIRECT_URI ?? "",
    scope: process.env.IMJS_OIDC_MOBILE_TEST_SCOPES ?? "",
  });

  const config = new IModelHostConfiguration();
  config.authorizationClient = authBackend;

  const opts: MobileHostOpts = {
    iModelHost: config,
    mobileHost: {
      rpcInterfaces: getRpcInterfaces(),
    },
  };

  // Initialize the backend
  await initializeDtaBackend(opts);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaMobileMain();
