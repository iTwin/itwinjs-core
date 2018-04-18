/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayProtocol, SerializedGatewayRequest } from "../core/GatewayProtocol";
import { GatewayElectronConfiguration } from "./GatewayElectronConfiguration";
import { GatewayElectronRequest } from "./GatewayElectronRequest";

/** @module Gateway */

/** @hidden @internal */
export const CHANNEL = "@bentley/imodeljs-common/GatewayElectronProtocol";

/** @hidden @internal */
export const interop = (() => {
  let electron = null;
  if (typeof (global) !== "undefined" && global && global.process && (global.process as any).type) {
    // tslint:disable-next-line:no-eval
    electron = eval("require")("electron");
  }

  return electron;
})();

/** IPC within an Electron application. */
export class GatewayElectronProtocol extends GatewayProtocol {
  /** The gateway request class for this protocol. */
  public readonly requestType = GatewayElectronRequest;

  /** Constructs an Electron protocol. */
  public constructor(configuration: GatewayElectronConfiguration) {
    super(configuration);

    if (interop.ipcMain) {
      interop.ipcMain.on(CHANNEL, async (evt: any, request: SerializedGatewayRequest) => {
        const response = await this.fulfill(request);
        evt.sender.send(`${CHANNEL}${request.id}`, response);
      });
    }
  }
}
