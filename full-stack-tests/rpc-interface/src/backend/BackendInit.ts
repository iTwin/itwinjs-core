/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config } from "@bentley/imodeljs-clients";

import { exposeBackendCallbacks } from "../common/SideChannels";
import { Settings } from "../common/Settings";

// tslint:disable:no-console

module.exports = (async () => {
  IModelJsConfig.init(true, true, Config.App);

  // Need to create a new one on the backend to properly setup dotenv
  new Settings(process.env);

  exposeBackendCallbacks();
})();
