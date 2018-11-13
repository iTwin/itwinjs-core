/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import { IOidcFrontendClient, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import { OidcBrowserClient } from "./OidcBrowserClient";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";

let OidcClient: any; // tslint:disable-line:variable-name
if (ElectronRpcConfiguration.isElectron) {
  // TODO: Need to figure a way to load a module that contains OidcDeviceClient, and
  // eventually migrate that to a separate imodeljs-clients-device package.
  OidcClient = OidcBrowserClient; // eval("require")("@bentley/imodeljs-clients-backend").OidcDeviceClient; // tslint:disable-line:no-eval
} else {
  OidcClient = OidcBrowserClient;
}

/** @hidden */
export class OidcClientWrapper {

  private static _oidcClient: IOidcFrontendClient;

  public static get oidcClient(): IOidcFrontendClient {
    return this._oidcClient;
  }

  public static async initialize(config: OidcFrontendClientConfiguration) {
    this._oidcClient = new OidcClient(config);
    await this._oidcClient.initialize(new ActivityLoggingContext(""));
  }
}
