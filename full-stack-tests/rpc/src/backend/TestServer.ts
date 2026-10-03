/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Application } from "express";
import { WebAppRpcProtocol } from "@itwin/core-common";
import { IModelJsExpressServer } from "@itwin/express-server";
import { createHttpBackendCallbackHandler } from "@itwin/vitest-browser-bridge/callbacks/http";
import { browserBackendCallbackPath } from "../common/SideChannels";
import { rpcBackendIdentityHeader } from "./notifyReady";

/** Routes shared by the HTTP and websocket browser test backends.
 * Only loopback callers that present this run's `callbackToken` may invoke backend callbacks.
 */
export function installBrowserTestRoutes(app: Application, callbackToken: string): void {
  app.use((_request, response, next) => {
    response.setHeader(rpcBackendIdentityHeader, process.env.VITEST_RPC_BACKEND_ID ?? "");
    next();
  });
  app.post(browserBackendCallbackPath, createHttpBackendCallbackHandler({ token: callbackToken }));
}

export class TestServer extends IModelJsExpressServer {
  private readonly _callbackToken: string;

  public constructor(protocol: WebAppRpcProtocol, callbackToken: string) {
    super(protocol);
    this._callbackToken = callbackToken;
  }

  protected override _configureHeaders() {
    super._configureHeaders();
    installBrowserTestRoutes(this._app, this._callbackToken);

    this._app.all("/**", (req, res, next) => {
      if (req.path.indexOf("-startCSRFTest") !== -1) {
        res.cookie("XSRF-TOKEN", "test");
      }

      if (req.path.indexOf("-stopCSRFTest") !== -1) {
        res.clearCookie("XSRF-TOKEN");
      }

      if (req.path.indexOf("-csrfTestEnabled") !== -1 && req.header("X-XSRF-TOKEN") !== "test") {
        throw new Error("CSRF is not enabled.");
      }

      if (req.path.indexOf("-csrfTestDisabled") !== -1 && req.header("X-XSRF-TOKEN")) {
        throw new Error("CSRF is not disabled.");
      }

      next();
    });
  }
}
