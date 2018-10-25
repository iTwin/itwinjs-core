/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../../RpcInterface";
import { RpcManager, RpcInterfaceEndpoints } from "../../RpcManager";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcInvocation } from "./RpcInvocation";
import { RpcOperation } from "./RpcOperation";
import { RpcRegistry } from "./RpcRegistry";
import { IModelToken } from "../../IModel";
import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";

// tslint:disable:space-before-function-paren

/** An RPC operation control response. */
export abstract class RpcControlResponse {
}

/** A pending RPC operation response. */
export class RpcPendingResponse extends RpcControlResponse {
  /** Extended status regarding the pending operation. */
  public message: string;

  /** Constructs a pending response. */
  public constructor(message: string = "") {
    super();
    this.message = message;
  }
}

/** A RPC operation response . */
export class RpcNotFoundResponse extends RpcControlResponse {
}

/** Manages requests and responses for an RPC configuration. */
export class RpcControlChannel {
  /** @hidden */
  public static channels: RpcControlChannel[] = [];
  private static _obtainLock = 0;
  private _configuration: RpcConfiguration;
  private _initialized = false;
  private _clientActive = false;
  private _describeEndpoints: () => Promise<RpcInterfaceEndpoints[]> = undefined as any;

  private constructor(configuration: RpcConfiguration) {
    this._configuration = configuration;
    RpcControlChannel.channels.push(this);
  }

  /** @hidden */
  public describeEndpoints() {
    this.activateClient();
    return this._describeEndpoints();
  }

  /** @hidden */
  public static obtain(configuration: RpcConfiguration): RpcControlChannel {
    if (RpcControlChannel._obtainLock)
      return undefined as any;

    ++RpcControlChannel._obtainLock;
    const channel = new RpcControlChannel(configuration);
    --RpcControlChannel._obtainLock;

    return channel;
  }

  private _channelInterface = class extends RpcInterface {
    public static readonly version = "CONTROL";
    public static readonly types = () => [];
    public describeEndpoints(): Promise<RpcInterfaceEndpoints[]> { return this.forward.apply(this, arguments); }
  };

  private _channelImpl = class extends RpcInterface {
    public describeEndpoints(): Promise<RpcInterfaceEndpoints[]> {
      const endpoints: RpcInterfaceEndpoints[] = [];

      this.configuration.interfaces().forEach((definition) => {
        if (!RpcRegistry.instance.isRpcInterfaceInitialized(definition))
          return;

        const description: RpcInterfaceEndpoints = { interfaceName: definition.name, interfaceVersion: definition.version, operationNames: [], compatible: true };
        RpcOperation.forEach(definition, (operation) => description.operationNames.push(operation.operationName));
        endpoints.push(description);
      });

      return Promise.resolve(endpoints);
    }
  };

  private computeId(): string {
    const interfaces: string[] = [];
    this._configuration.interfaces().forEach((definition) => interfaces.push(`${definition.name}@${definition.version}`));
    const id = interfaces.sort().join(",");

    if (typeof (btoa) !== "undefined")
      return btoa(id);
    else if (typeof (Buffer) !== "undefined")
      return Buffer.from(id, "binary").toString("base64");
    else
      return id;
  }

  private activateClient() {
    if (this._clientActive)
      return;

    if (!this._initialized) {
      if (this._configuration.interfaces().length)
        throw new IModelError(BentleyStatus.ERROR, `Invalid state.`);

      this.initialize();
    }

    this._clientActive = true;
    RpcOperation.forEach(this._channelInterface, (operation) => operation.policy.token = (_request) => RpcOperation.fallbackToken || new IModelToken("none", "none", "none", "none", undefined));
    const client = RpcManager.getClientForInterface(this._channelInterface);
    this._describeEndpoints = () => client.describeEndpoints();
  }

  /** @hidden */
  public initialize() {
    if (this._initialized)
      throw new IModelError(BentleyStatus.ERROR, `Already initialized.`);

    this._initialized = true;

    const id = this.computeId();
    Object.defineProperty(this._channelInterface, "name", { value: id });
    Object.defineProperty(this._channelImpl, "name", { value: id });

    RpcConfiguration.assign(this._channelInterface, () => this._configuration.constructor as any);
    RpcManager.registerImpl(this._channelInterface, this._channelImpl);
    RpcManager.initializeInterface(this._channelInterface);
  }

  /** @hidden */
  public handleUnknownOperation(invocation: RpcInvocation, _error: any): boolean {
    const op = invocation.request.operation;
    if (op.interfaceVersion === "CONTROL" && op.operationName === "describeEndpoints") {
      op.interfaceDefinition = this._channelInterface.name;
      return true;
    }

    return false;
  }
}
