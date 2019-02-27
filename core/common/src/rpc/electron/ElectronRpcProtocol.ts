/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcProtocol, SerializedRpcRequest } from "../core/RpcProtocol";
import { RpcRegistry } from "../core/RpcRegistry";
import { ElectronRpcConfiguration } from "./ElectronRpcManager";
import { ElectronRpcRequest } from "./ElectronRpcRequest";

/** RPC interface protocol for an Electron-based application. */
export class ElectronRpcProtocol extends RpcProtocol {
  public static instances: Map<string, ElectronRpcProtocol> = new Map();

  public static obtainInstance(request: SerializedRpcRequest) {
    const interfaceName = request.operation.interfaceDefinition;

    let protocol = ElectronRpcProtocol.instances.get(interfaceName) as ElectronRpcProtocol;
    if (!protocol) {
      RpcRegistry.instance.lookupImpl(interfaceName);
      protocol = ElectronRpcProtocol.instances.get(interfaceName) as ElectronRpcProtocol;
    }

    return protocol;
  }

  /** The RPC request class for this protocol. */
  public readonly requestType = ElectronRpcRequest;

  /** Specifies where to break large binary request payloads. */
  public transferChunkThreshold = 48 * 1024 * 1024;

  /** @hidden */
  public requests: Map<string, ElectronRpcRequest> = new Map();

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
    if (ElectronRpcProtocol.instances.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.name}"" is already associated with a protocol.`);

    ElectronRpcProtocol.instances.set(definition.name, this);
  }

  private purgeInterface(definition: RpcInterfaceDefinition) {
    ElectronRpcProtocol.instances.delete(definition.name);
  }
}
