/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { ClientRequestContext, SerializedClientRequestContext } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcControlChannel } from "./RpcControl";
import { RpcProtocol, RpcRequestFulfillment, SerializedRpcRequest } from "./RpcProtocol";
import { INSTANCE } from "./RpcRegistry";
import { RpcRequest } from "./RpcRequest";
import { RpcRequestContext } from "./RpcRequestContext";

/** @public */
export type RpcConfigurationSupplier = () => { new(): RpcConfiguration };

/** A RpcConfiguration specifies how calls on an RPC interface will be marshalled, plus other operating parameters.
 * RpcConfiguration is the base class for specific configurations.
 * @public
 */
export abstract class RpcConfiguration {
  /** Whether development mode is enabled.
   * @note This parameter determines whether developer convenience features like backend stack traces are available.
   */
  public static developmentMode: boolean = false;

  /** Whether strict mode is enabled.
   * This parameter determines system behaviors relating to strict checking:
   * - Whether an error is thrown if the type marshaling system encounters an unregistered type (only in strict mode).
   */
  public static strictMode: boolean = false;

  /**
   * Whether to throw an error when the IModelToken in the operation parameter list differs from the token in the URL.
   * @note By default, a warning is loggged and the operation is allowed to proceed.
   * @note The parameter token is always replaced by the url token (unless RpcOperationPolicy.allowTokenMismatch is set).
   */
  public static throwOnTokenMismatch = false;

  /** Sets the configuration supplier for an RPC interface class. */
  public static assign<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>, supplier: RpcConfigurationSupplier): void {
    definition.prototype.configurationSupplier = supplier;
  }

  /** Obtains the instance of an RPC configuration class. */
  public static obtain<T extends RpcConfiguration>(configurationConstructor: { new(): T }): T {
    let instance = (configurationConstructor as any)[INSTANCE] as T;
    if (!instance)
      instance = (configurationConstructor as any)[INSTANCE] = new configurationConstructor();

    return instance;
  }

  /** Enables passing of application-specific context with each RPC request. */
  public static requestContext: RpcRequestContext = {
    getId: (_request: RpcRequest): string => "",
    serialize: async (_request: RpcRequest): Promise<SerializedClientRequestContext> => ({
      id: "",
      applicationId: "",
      applicationVersion: "",
      sessionId: "",
      authorization: "",
      userId: "",
    }),
    deserialize: async (_request: SerializedRpcRequest): Promise<ClientRequestContext> => new ClientRequestContext(""),
  };

  /** The protocol of the configuration. */
  public abstract readonly protocol: RpcProtocol;

  /** The RPC interfaces managed by the configuration. */
  public abstract readonly interfaces: () => RpcInterfaceDefinition[];

  /** The target interval (in milliseconds) between connection attempts for pending RPC operation requests. */
  public pendingOperationRetryInterval = 10000;

  /** The control channel for the configuration. */
  public readonly controlChannel = RpcControlChannel.obtain(this);

  /** Initializes the RPC interfaces managed by the configuration. */
  public static initializeInterfaces(configuration: RpcConfiguration) {
    configuration.interfaces().forEach((definition) => RpcManager.initializeInterface(definition));
    configuration.controlChannel.initialize();
  }

  /** @internal */
  public static supply(definition: RpcInterface): RpcConfiguration {
    return RpcConfiguration.obtain(definition.configurationSupplier ? definition.configurationSupplier() : RpcDefaultConfiguration);
  }

  /** @internal */
  public onRpcClientInitialized(definition: RpcInterfaceDefinition, client: RpcInterface): void {
    this.protocol.onRpcClientInitialized(definition, client);
  }

  /** @internal */
  public onRpcImplInitialized(definition: RpcInterfaceDefinition, impl: RpcInterface): void {
    this.protocol.onRpcImplInitialized(definition, impl);
  }

  /** @internal */
  public onRpcClientTerminated(definition: RpcInterfaceDefinition, client: RpcInterface): void {
    this.protocol.onRpcClientTerminated(definition, client);
  }

  /** @internal */
  public onRpcImplTerminated(definition: RpcInterfaceDefinition, impl: RpcInterface): void {
    this.protocol.onRpcImplTerminated(definition, impl);
  }
}

/** A default configuration that can be used for basic testing within a library.
 * @internal
 */
export class RpcDefaultConfiguration extends RpcConfiguration {
  public interfaces = () => [];
  public protocol: RpcProtocol = new RpcDirectProtocol(this);
}

/** A default protocol that can be used for basic testing within a library.
 * @internal
 */
export class RpcDirectProtocol extends RpcProtocol {
  public readonly requestType = RpcDirectRequest;
}

/** A default request type that can be used for basic testing within a library.
 * @internal
 */
export class RpcDirectRequest extends RpcRequest {
  public headers: Map<string, string> = new Map();
  public fulfillment: RpcRequestFulfillment | undefined = undefined;

  protected async send() {
    const request = await this.protocol.serialize(this);
    return new Promise<number>(async (resolve, reject) => {
      try {
        this.fulfillment = await this.protocol.fulfill(request);
        resolve(this.fulfillment.status);
      } catch (err) {
        reject(err);
      }
    });
  }

  protected setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  protected async load() {
    return Promise.resolve(this.fulfillment!.result);
  }
}
