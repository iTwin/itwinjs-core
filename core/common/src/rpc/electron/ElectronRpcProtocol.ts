/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcProtocol } from "../core/RpcProtocol";
import { ElectronRpcConfiguration } from "./ElectronRpcManager";
import { ElectronRpcRequest } from "./ElectronRpcRequest";
import { ElectronIpcTransport, IpcTransportMessage, initializeIpc } from "./ElectronIpcTransport";

/** RPC interface protocol for an Electron-based application.
 * @beta
 */
export class ElectronRpcProtocol extends RpcProtocol {
  public static instances: Map<string, ElectronRpcProtocol> = new Map();

  /** The RPC request class for this protocol. */
  public readonly requestType = ElectronRpcRequest;

  /** Specifies where to break large binary request payloads. */
  public transferChunkThreshold = 48 * 1024 * 1024;

  /** @internal */
  public requests: Map<string, ElectronRpcRequest> = new Map();

  /** @internal */
  public readonly transport: ElectronIpcTransport<IpcTransportMessage, IpcTransportMessage>;

  /** Constructs an Electron protocol. */
  public constructor(configuration: ElectronRpcConfiguration) {
    super(configuration);
    const transport = initializeIpc(this);
    if (!transport)
      throw new IModelError(BentleyStatus.ERROR, `Failed to initialize electron IPC.`);

    this.transport = transport;
  }

  /** @internal */
  public onRpcClientInitialized(definition: RpcInterfaceDefinition, _client: RpcInterface): void {
    this.registerInterface(definition);
  }

  /** @internal */
  public onRpcImplInitialized(definition: RpcInterfaceDefinition, _impl: RpcInterface): void {
    this.registerInterface(definition);
  }

  /** @internal */
  public onRpcClientTerminated(definition: RpcInterfaceDefinition, _client: RpcInterface): void {
    this.purgeInterface(definition);
  }

  /** @internal */
  public onRpcImplTerminated(definition: RpcInterfaceDefinition, _impl: RpcInterface): void {
    this.purgeInterface(definition);
  }

  private registerInterface(definition: RpcInterfaceDefinition) {
    if (ElectronRpcProtocol.instances.has(definition.interfaceName))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.interfaceName}"" is already associated with a protocol.`);

    ElectronRpcProtocol.instances.set(definition.interfaceName, this);
  }

  private purgeInterface(definition: RpcInterfaceDefinition) {
    ElectronRpcProtocol.instances.delete(definition.interfaceName);
  }
}
