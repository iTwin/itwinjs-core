/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { init as initOidc } from "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config } from "@bentley/imodeljs-clients";

import { exposeBackendCallbacks } from "../common/SideChannels";
import { Settings } from "../common/Settings";

// tslint:disable:no-console

module.exports = (async () => {
  IModelJsConfig.init(true, true, Config.App);

  // Need to create a new one on the backend to properly setup dotenv
  new Settings(process.env);

  await initOidc();

  exposeBackendCallbacks();
})();
