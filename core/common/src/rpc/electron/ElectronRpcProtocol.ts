/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcProtocol, SerializedRpcRequest, RpcProtocolEvent, RpcRequestFulfillment } from "../core/RpcProtocol";
import { RpcRegistry } from "../core/RpcRegistry";
import { ElectronRpcConfiguration } from "./ElectronRpcManager";
import { ElectronRpcRequest } from "./ElectronRpcRequest";

const instances: Map<string, ElectronRpcProtocol> = new Map();

const lookupInstance = (request: SerializedRpcRequest) => {
  const interfaceName = request.operation.interfaceDefinition;

  let protocol = instances.get(interfaceName) as ElectronRpcProtocol;
  if (!protocol) {
    RpcRegistry.instance.lookupImpl(interfaceName);
    protocol = instances.get(interfaceName) as ElectronRpcProtocol;
  }

  return protocol;
};

/** @hidden */
export const CHANNEL = "@bentley/imodeljs-common/ElectronRpcProtocol";

/** @hidden */
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
      let response: RpcRequestFulfillment;
      try {
        const protocol = lookupInstance(request);
        response = await protocol.fulfill(request);
      } catch (err) {
        response = RpcRequestFulfillment.forUnknownError(request, err);
      }

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

  /** @hidden */
  public onRpcClientInitialized(definition: RpcInterfaceDefinition, _client: RpcInterface): void {
    this.registerInterface(definition);
  }

  /** @hidden */
  public onRpcImplInitialized(definition: RpcInterfaceDefinition, _impl: RpcInterface): void {
    this.registerInterface(definition);
  }

  /** @hidden */
  public onRpcClientTerminated(definition: RpcInterfaceDefinition, _client: RpcInterface): void {
    this.purgeInterface(definition);
  }

  /** @hidden */
  public onRpcImplTerminated(definition: RpcInterfaceDefinition, _impl: RpcInterface): void {
    this.purgeInterface(definition);
  }

  private registerInterface(definition: RpcInterfaceDefinition) {
    if (instances.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.name}"" is already associated with a protocol.`);

    instances.set(definition.name, this);
  }

  private purgeInterface(definition: RpcInterfaceDefinition) {
    instances.delete(definition.name);
  }
}
