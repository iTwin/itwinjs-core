/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { Gateway, GatewayDefinition } from "../../Gateway";
import { GatewayProtocol, SerializedGatewayRequest, GatewayProtocolEvent, GatewayRequestFulfillment } from "../core/GatewayProtocol";
import { GatewayElectronConfiguration } from "./GatewayElectronConfiguration";
import { GatewayElectronRequest } from "./GatewayElectronRequest";

const instances: Map<string, GatewayElectronProtocol> = new Map();

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

if (interop) {
  if (interop.ipcMain) {
    interop.ipcMain.on(CHANNEL, async (evt: any, request: SerializedGatewayRequest) => {
      const protocol = instances.get(request.operation.gateway) as GatewayElectronProtocol;
      const response = await protocol.fulfill(request);
      evt.sender.send(CHANNEL, response);
    });
  } else if (interop.ipcRenderer) {
    interop.ipcRenderer.on(CHANNEL, (_evt: any, fulfillment: GatewayRequestFulfillment) => {
      const protocol = instances.get(fulfillment.gateway) as GatewayElectronProtocol;
      const request = protocol.configuration.controlChannel.requests.get(fulfillment.id) as GatewayElectronRequest;
      request.fulfillment = fulfillment;
      protocol.events.raiseEvent(GatewayProtocolEvent.ResponseLoaded, request);
    });
  }
}

/** IPC within an Electron application. */
export class GatewayElectronProtocol extends GatewayProtocol {
  /** The gateway request class for this protocol. */
  public readonly requestType = GatewayElectronRequest;

  /** Constructs an Electron protocol. */
  public constructor(configuration: GatewayElectronConfiguration) {
    super(configuration);
  }

  /** @hidden @internal */
  public onGatewayProxyInitialized(definition: GatewayDefinition, _instance: Gateway): void {
    this.registerGateway(definition);
  }

  /** @hidden @internal */
  public onGatewayImplementationInitialized(definition: GatewayDefinition, _instance: Gateway): void {
    this.registerGateway(definition);
  }

  private registerGateway(definition: GatewayDefinition) {
    if (instances.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${definition.name}"" is already associated with a protocol.`);

    instances.set(definition.name, this);
  }
}
