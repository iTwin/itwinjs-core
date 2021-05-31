/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */
import { ClientRequestContext, SerializedClientRequestContext } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcControlChannel } from "./RpcControl";
import { RpcProtocol, RpcRequestFulfillment, SerializedRpcRequest } from "./RpcProtocol";
import { INSTANCE } from "./RpcRegistry";
import { RpcRequest } from "./RpcRequest";
import { RpcRequestContext } from "./RpcRequestContext";
import { RpcRoutingToken } from "./RpcRoutingToken";

/** @public */
export type RpcConfigurationSupplier = (routing?: RpcRoutingToken) => { new(): RpcConfiguration }; // eslint-disable-line @typescript-eslint/prefer-function-type

/** @alpha */
export interface RpcRoutingMap extends RpcConfigurationSupplier { configurations: Map<number, RpcConfigurationSupplier> }

/** @alpha */
export namespace RpcRoutingMap {
  export function create(): RpcRoutingMap {
    const configurations = new Map();
    return Object.assign((routing?: RpcRoutingToken) => configurations.get(routing!.id)(), { configurations });
  }
}

/** A RpcConfiguration specifies how calls on an RPC interface will be marshalled, plus other operating parameters.
 * RpcConfiguration is the base class for specific configurations.
 * @public
 */
export abstract class RpcConfiguration {
  /** Whether development mode is enabled.
   * @note This parameter determines whether developer convenience features like backend stack traces are available.
   */
  public static developmentMode: boolean = false;

  /** Whether frontend checks that are relevant in a cloud-hosted routing scenario are disabled. */
  public static disableRoutingValidation: boolean = false;

  /** Whether strict mode is enabled.
   * This parameter determines system behaviors relating to strict checking:
   * - Whether an error is thrown if the type marshaling system encounters an unregistered type (only in strict mode).
   */
  public static strictMode: boolean = false;

  /**
   * Whether to throw an error when the IModelRpcProps in the operation parameter list differs from the token in the URL.
   * @note By default, a warning is logged and the operation is allowed to proceed.
   * @note The parameter token is always replaced by the url token (unless RpcOperationPolicy.allowTokenMismatch is set).
   */
  public static throwOnTokenMismatch = false;

  /** Sets the configuration supplier for an RPC interface class. */
  public static assign<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>, supplier: RpcConfigurationSupplier): void {
    const map = definition.prototype.configurationSupplier as RpcRoutingMap | undefined;
    if (!map || typeof (map.configurations) === "undefined") {
      definition.prototype.configurationSupplier = supplier;
    } else {
      map.configurations.set(RpcRoutingToken.default.id, supplier);
    }
  }

  /** Sets the configuration supplier for an RPC interface class for a given routing. */
  public static assignWithRouting<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>, routing: RpcRoutingToken, configuration: new () => RpcConfiguration): void {
    if (!definition.prototype.configurationSupplier) {
      RpcConfiguration.assign(definition, RpcRoutingMap.create());
    }

    let map = definition.prototype.configurationSupplier as RpcRoutingMap;
    if (typeof (map.configurations) === "undefined") {
      const existing = map as RpcConfigurationSupplier;
      map = RpcRoutingMap.create();
      RpcConfiguration.assign(definition, map);
      map.configurations.set(RpcRoutingToken.default.id, existing);
    }

    const supplier = () => configuration;
    map.configurations.set(routing.id, supplier);
  }

  /** Obtains the instance of an RPC configuration class. */
  public static obtain<T extends RpcConfiguration>(configurationConstructor: new () => T): T {
    let instance = (configurationConstructor as any)[INSTANCE] as T;
    if (!instance)
      instance = (configurationConstructor as any)[INSTANCE] = new configurationConstructor();

    return instance;
  }

  /** Enables passing of application-specific context with each RPC request. */
  public static requestContext: RpcRequestContext = {
    getId: (_request: RpcRequest): string => "",
    serialize: async (_request: RpcRequest): Promise<SerializedClientRequestContext> => ({
      id: _request.id,
      applicationId: "",
      applicationVersion: "",
      sessionId: "",
      authorization: "",
      userId: "",
    }),
    deserialize: async (_request: SerializedRpcRequest): Promise<ClientRequestContext> => new ClientRequestContext(""),
  };

  /** @internal */
  public attached: RpcInterfaceDefinition[] = [];

  /** The protocol of the configuration. */
  public abstract readonly protocol: RpcProtocol;

  /** The RPC interfaces managed by the configuration. */
  public abstract readonly interfaces: () => RpcInterfaceDefinition[];

  /** @alpha */
  public allowAttachedInterfaces: boolean = true;

  /** @alpha */
  public get attachedInterfaces(): ReadonlyArray<RpcInterfaceDefinition> { return this.attached; }

  /** The target interval (in milliseconds) between connection attempts for pending RPC operation requests. */
  public pendingOperationRetryInterval = 10000;

  /** The maximum number of transient faults permitted before request failure. */
  public transientFaultLimit = 3;

  /** @alpha */
  public readonly routing: RpcRoutingToken = RpcRoutingToken.default;

  /** The control channel for the configuration.
   * @internal
   */
  public readonly controlChannel = RpcControlChannel.obtain(this);

  /** @alpha */
  public attach<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void {
    if (!this.allowAttachedInterfaces) {
      return;
    }

    if (this.interfaces().indexOf(definition) !== -1 || this.attached.indexOf(definition) !== -1) {
      return;
    }

    this.attached.push(definition);
    RpcConfiguration.assign(definition, () => this.constructor as any);
    RpcManager.initializeInterface(definition);
  }

  /** Initializes the RPC interfaces managed by the configuration. */
  public static initializeInterfaces(configuration: RpcConfiguration) {
    configuration.interfaces().forEach((definition) => RpcManager.initializeInterface(definition));
    configuration.controlChannel.initialize();
  }

  /** @internal */
  public static supply(definition: RpcInterface): RpcConfiguration {
    return RpcConfiguration.obtain(definition.configurationSupplier ? definition.configurationSupplier(definition.routing) : RpcDefaultConfiguration);
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
    return this.fulfillment!.result;
  }
}
