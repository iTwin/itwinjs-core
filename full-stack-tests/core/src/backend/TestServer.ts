/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createHttpBackendCallbackHandler } from "@itwin/vitest-browser-bridge/callbacks/http";
import { WebEditServer } from "@itwin/express-server";
import { browserBackendCallbackPath } from "../common/testCallbacks";

/** WebEditServer with the callback endpoint used by the Vitest browser runner. */
export class TestServer extends WebEditServer {
  protected override _configureHeaders() {
    super._configureHeaders();
    this._app.post(browserBackendCallbackPath, createHttpBackendCallbackHandler());
  }
}
