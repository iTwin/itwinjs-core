/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createHttpBackendCallbackHandler } from "@itwin/vitest-browser-bridge/callbacks/http";
import { WebAppRpcProtocol } from "@itwin/core-common";
import { WebEditServer } from "@itwin/express-server";
import { browserBackendCallbackPath } from "../common/testCallbacks";
import { chromeBackendIdentityHeader } from "../common/ChromeTestBackend";

/** WebEditServer with the callback endpoint used by the Vitest browser runner.
 * Only loopback callers that present this run's callback token may invoke backend callbacks.
 */
export class TestServer extends WebEditServer {
  public backendId?: string;
  private readonly _callbackToken: string;

  public constructor(protocol: WebAppRpcProtocol, callbackToken: string) {
    super(protocol);
    this._callbackToken = callbackToken;
  }

  protected override _configureHeaders() {
    super._configureHeaders();
    this._app.post(browserBackendCallbackPath, createHttpBackendCallbackHandler({ token: this._callbackToken }));
    this._app.get("/v3/swagger.json", (_request, response, next) => {
      if (this.backendId !== undefined) {
        response.setHeader(chromeBackendIdentityHeader, this.backendId);
        response.append("Access-Control-Expose-Headers", chromeBackendIdentityHeader);
      }
      next();
    });
  }
}
