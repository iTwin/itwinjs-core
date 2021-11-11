/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { WebAppRpcProtocol } from "@itwin/core-common";
import { LocalhostIpcHost } from "@itwin/core-backend";
import { IModelJsExpressServer } from "./ExpressServer";
import * as enableWs from "express-ws";

/**
 * @alpha
 */
export class WebEditServer extends IModelJsExpressServer {
  protected override _configureRoutes() {
    (this._app as any).ws("/ipc", (ws: any, _req: any) => LocalhostIpcHost.connect(ws));
    super._configureRoutes();
  }

  constructor(protocol: WebAppRpcProtocol, config = IModelJsExpressServer.defaults) {
    super(protocol, config);
    enableWs(this._app);
  }
}
