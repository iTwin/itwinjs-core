/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcProtocol, RpcRequestFulfillment, RpcProtocolEvent } from "./RpcProtocol";
import { RpcRequest, RpcResponseType } from "./RpcRequest";
import { INSTANCE } from "./RpcRegistry";
import { RpcControlChannel } from "./RpcControl";

export type RpcConfigurationSupplier = () => { new(): RpcConfiguration };

/** A RpcConfiguration specifies how calls on an RPC interface will be marshalled, plus other operating parameters.
 * RpcConfiguration is the base class for specific configurations.
 */
export abstract class RpcConfiguration {
  /**
   * Whether development mode is enabled.
   * @note This parameter determines whether developer convenience features like backend stack traces are available.
   */
  public static developmentMode: boolean = false;

  /**
   * Whether strict mode is enabled.
   * This parameter determines system behaviors relating to strict checking:
   * - Whether an error is thrown if the type marshaling system encounters an unregistered type (only in strict mode).
   */
  public static strictMode: boolean = false;

  /** Sets the configuration supplier for an RPC interface class. */
  public static assign<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>, supplier: RpcConfigurationSupplier): void {
    definition.prototype.configurationSupplier = supplier;
  }

  /** Obtains the instance of an RPC configuration class. */
  public static obtain<T extends RpcConfiguration>(constructor: { new(): T }): T {
    let instance = (constructor as any)[INSTANCE] as T;
    if (!instance)
      instance = (constructor as any)[INSTANCE] = new constructor();

    return instance;
  }

  /** The protocol of the configuration. */
  public abstract readonly protocol: RpcProtocol;

  /** The RPC interfaces managed by the configuration. */
  public abstract readonly interfaces: () => RpcInterfaceDefinition[];

  /** Reserved for an application authorization key. */
  public applicationAuthorizationKey: string = "";

  /** Reserved for an application authorization value. */
  public applicationAuthorizationValue: string = "";

  /** The target interval (in milliseconds) between connection attempts for pending RPC operation requests. */
  public pendingOperationRetryInterval = 10000;

  /** The control channel for the configuration. */
  public readonly controlChannel = RpcControlChannel.obtain(this);

  /** Initializes the RPC interfaces managed by the configuration. */
  public static initializeInterfaces(configuration: RpcConfiguration) {
    configuration.interfaces().forEach((definition) => RpcManager.initializeInterface(definition));
    configuration.controlChannel.initialize();
  }

  /** @hidden */
  public static supply(definition: RpcInterface): RpcConfiguration {
    return RpcConfiguration.obtain(definition.configurationSupplier ? definition.configurationSupplier() : RpcDefaultConfiguration);
  }

  /** @hidden */
  public onRpcClientInitialized(definition: RpcInterfaceDefinition, client: RpcInterface): void {
    this.protocol.onRpcClientInitialized(definition, client);
  }

  /** @hidden */
  public onRpcImplInitialized(definition: RpcInterfaceDefinition, impl: RpcInterface): void {
    this.protocol.onRpcImplInitialized(definition, impl);
  }

  /** @hidden */
  public onRpcClientTerminated(definition: RpcInterfaceDefinition, client: RpcInterface): void {
    this.protocol.onRpcClientTerminated(definition, client);
  }

  /** @hidden */
  public onRpcImplTerminated(definition: RpcInterfaceDefinition, impl: RpcInterface): void {
    this.protocol.onRpcImplTerminated(definition, impl);
  }
}

// A default configuration that can be used for basic testing within a library.
export class RpcDefaultConfiguration extends RpcConfiguration {
  public interfaces = () => [];
  public protocol: RpcProtocol = new RpcDirectProtocol(this);
  public applicationAuthorizationKey = "Authorization";
  public applicationAuthorizationValue = "Basic Og==";
}

// A default protocol that can be used for basic testing within a library.
export class RpcDirectProtocol extends RpcProtocol {
  public readonly requestType = RpcDirectRequest;
}

// A default request type that can be used for basic testing within a library.
export class RpcDirectRequest extends RpcRequest {
  public headers: Map<string, string> = new Map();
  public fulfillment: RpcRequestFulfillment = { result: "", status: 0, id: "", interfaceName: "", type: RpcResponseType.Unknown };

  protected send(): void {
    const request = this.protocol.serialize(this);

    this.protocol.fulfill(request).then((fulfillment) => {
      const result = fulfillment.result;
      this.fulfillment = JSON.parse(JSON.stringify(fulfillment));
      if (result instanceof Uint8Array) {
        this.fulfillment.result = result;
      }

      this.protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, this);
    });
  }

  protected setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  public getResponseStatusCode(): number {
    return this.fulfillment.status;
  }

  public getResponseText(): string {
    const result = this.fulfillment.result;
    if (typeof (result) === "string") {
      return result;
    } else {
      return super.getResponseText();
    }
  }

  public getResponseBytes(): Uint8Array {
    const result = this.fulfillment.result;
    if (typeof (result) !== "string") {
      return result;
    } else {
      return super.getResponseBytes();
    }
  }

  public getResponseType(): RpcResponseType {
    return this.fulfillment.type;
  }
}
