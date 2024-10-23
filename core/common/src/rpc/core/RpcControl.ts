/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Base64 } from "js-base64";
import { IModelRpcProps } from "../../IModel";
import { RpcInterface } from "../../RpcInterface";
import { RpcInterfaceEndpoints, RpcManager } from "../../RpcManager";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcInvocation } from "./RpcInvocation";
import { RpcOperation } from "./RpcOperation";
import { RpcRegistry } from "./RpcRegistry";

/** An RPC operation control response.
 * @public
 */
export abstract class RpcControlResponse {
  public message = "RpcControlResponse";
}

/** A pending RPC operation response.
 * @public
 */
export class RpcPendingResponse extends RpcControlResponse {
  /** Extended status regarding the pending operation. */
  public override message: string;

  /** Constructs a pending response. */
  public constructor(message: string = "") {
    super();
    this.message = message;
  }
}

/** A RPC operation response.
 * @public
 */
export class RpcNotFoundResponse extends RpcControlResponse {
  public override message = "Not found";
}

/** Manages requests and responses for an RPC configuration.
 * @internal
 */
export class RpcControlChannel {
  /** @internal */
  public static channels: RpcControlChannel[] = [];
  private static _obtainLock = 0;
  private _configuration: RpcConfiguration;
  private _initialized = false;
  private _clientActive = false;
  private _describeEndpoints: () => Promise<RpcInterfaceEndpoints[]> = undefined as any;

  /** @internal */
  public static ensureInitialized() {
    this.channels.forEach((channel) => channel.initialize());
  }

  private constructor(configuration: RpcConfiguration) {
    this._configuration = configuration;
    RpcControlChannel.channels.push(this);
  }

  /** @internal */
  public async describeEndpoints() {
    this.activateClient();
    if (!this._channelInterface.interfaceName) {
      return [];
    }

    return this._describeEndpoints();
  }

  /** @internal */
  public static obtain(configuration: RpcConfiguration): RpcControlChannel {
    if (RpcControlChannel._obtainLock)
      return undefined as any;

    ++RpcControlChannel._obtainLock;
    const channel = new RpcControlChannel(configuration);
    --RpcControlChannel._obtainLock;

    return channel;
  }

  private _channelInterface = class extends RpcInterface {
    public static readonly interfaceVersion = "CONTROL";
    public static readonly interfaceName = "";
    public async describeEndpoints(): Promise<RpcInterfaceEndpoints[]> { return this.forward(arguments); }
  };

  private _channelImpl = class extends RpcInterface {
    public async describeEndpoints(): Promise<RpcInterfaceEndpoints[]> {
      const endpoints: RpcInterfaceEndpoints[] = [];

      this.configuration.interfaces().forEach((definition) => {
        if (!RpcRegistry.instance.isRpcInterfaceInitialized(definition))
          return;

        const description: RpcInterfaceEndpoints = { interfaceName: definition.interfaceName, interfaceVersion: definition.interfaceVersion, operationNames: [], compatible: true };
        RpcOperation.forEach(definition, (operation) => description.operationNames.push(operation.operationName));
        endpoints.push(description);
      });

      return endpoints;
    }
  };

  private computeId(): string {
    const interfaces: string[] = [];
    this._configuration.interfaces().forEach((definition) => interfaces.push(`${definition.interfaceName}@${definition.interfaceVersion}`));
    const id = interfaces.sort().join(",");

    return Base64.encode(id);
  }

  private activateClient() {
    if (this._clientActive)
      return;

    this.initialize();

    const token: IModelRpcProps = { key: "none", iTwinId: "none", iModelId: "none", changeset: { id: "none" } };
    RpcOperation.forEach(this._channelInterface, (operation) => operation.policy.token = (_request) => RpcOperation.fallbackToken ?? token);
    const client = RpcManager.getClientForInterface(this._channelInterface);
    this._describeEndpoints = async () => client.describeEndpoints();
    this._clientActive = true;
  }

  /** @internal */
  public initialize() {
    if (this._initialized) {
      return;
    }

    const id = this.computeId();
    Object.defineProperty(this._channelInterface, "interfaceName", { value: id });
    Object.defineProperty(this._channelImpl, "interfaceName", { value: id });

    RpcConfiguration.assign(this._channelInterface, () => this._configuration.constructor as any);
    RpcManager.registerImpl(this._channelInterface, this._channelImpl);
    RpcManager.initializeInterface(this._channelInterface);

    this._initialized = true;
  }

  /** @internal */
  public handleUnknownOperation(invocation: RpcInvocation, _error: any): boolean {
    this.initialize();

    const op = invocation.request.operation;
    if (op.interfaceVersion === "CONTROL" && op.operationName === "describeEndpoints") {
      if (this._channelInterface.interfaceName) {
        op.interfaceDefinition = this._channelInterface.interfaceName;
      }

      return true;
    }

    return false;
  }
}
