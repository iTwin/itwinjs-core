/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcProtocol, SerializedRpcRequest, RpcProtocolEvent, RpcRequestFulfillment } from "../core/RpcProtocol";
import { ElectronRpcConfiguration } from "./ElectronRpcManager";
import { ElectronRpcRequest } from "./ElectronRpcRequest";

const instances: Map<string, ElectronRpcProtocol> = new Map();

/** @hidden @internal */
export const CHANNEL = "@bentley/imodeljs-common/ElectronRpcProtocol";

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
    interop.ipcMain.on(CHANNEL, async (evt: any, request: SerializedRpcRequest) => {
      const protocol = instances.get(request.operation.interfaceDefinition) as ElectronRpcProtocol;
      const response = await protocol.fulfill(request);
      evt.sender.send(CHANNEL, response);
    });
  } else if (interop.ipcRenderer) {
    interop.ipcRenderer.on(CHANNEL, (_evt: any, fulfillment: RpcRequestFulfillment) => {
      const protocol = instances.get(fulfillment.interfaceName) as ElectronRpcProtocol;
      const request = protocol.configuration.controlChannel.requests.get(fulfillment.id) as ElectronRpcRequest;
      request.fulfillment = fulfillment;
      protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, request);
    });
  }
}

/** RPC interface protocol for an Electron-based application. */
export class ElectronRpcProtocol extends RpcProtocol {
  /** The RPC request class for this protocol. */
  public readonly requestType = ElectronRpcRequest;

  /** Constructs an Electron protocol. */
  public constructor(configuration: ElectronRpcConfiguration) {
    super(configuration);
  }

  /** @hidden @internal */
  public onRpcClientInitialized(definition: RpcInterfaceDefinition, _instance: RpcInterface): void {
    this.registerInterface(definition);
  }

  /** @hidden @internal */
  public onRpcImplInitialized(definition: RpcInterfaceDefinition, _instance: RpcInterface): void {
    this.registerInterface(definition);
  }

  private registerInterface(definition: RpcInterfaceDefinition) {
    if (instances.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.name}"" is already associated with a protocol.`);

    instances.set(definition.name, this);
  }
}
