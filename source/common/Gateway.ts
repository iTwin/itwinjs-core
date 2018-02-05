/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "./IModelError";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

// tslint:disable:ban-types
let marshalingScope = "";
const INSTANCE = Symbol.for("instance");

class Registry {
  private static GATEWAY = Symbol.for("@bentley/imodeljs-core/common/Gateway");
  private static _instance: Registry;

  public static get instance() {
    if (!Registry._instance) {
      const globalObj: any = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

      if (!globalObj[Registry.GATEWAY])
        globalObj[Registry.GATEWAY] = new Registry();

      Registry._instance = globalObj[Registry.GATEWAY];
    }

    return Registry._instance;
  }

  public proxies: Map<string, Gateway> = new Map();
  public implementations: Map<string, Gateway> = new Map();
  public implementationClasses: Map<string, GatewayImplementation> = new Map();
  public types: Map<string, Function> = new Map();
}

export type GatewayImplementation<T extends Gateway = Gateway> = new () => T;
export interface GatewayDefinition<T extends Gateway = Gateway> { prototype: T; name: string; version: string; types: () => Function[]; }
export type GatewayConfigurationSupplier = () => { new(): GatewayConfiguration };

/** A set of related asynchronous APIs that operate over configurable protocols across multiple platforms. */
export abstract class Gateway {
  /** The name of the marshaling type identification property.  */
  public static MARSHALING_NAME_PROPERTY = "__$__";

  /** The name of the marshaling custom JSON representation property.  */
  public static MARSHALING_CUSTOM_JSON_PROPERTY = "__JSON__";

  /** The name of the marshaling undefined members property.  */
  public static MARSHALING_UNDEFINED_MEMBERS_PROPERTY = "__undefined__";

  /** Returns the gateway proxy instance for the frontend. */
  public static getProxyForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    const instance = Registry.instance.proxies.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is not initialized.`);

    return instance;
  }

  /** Returns the gateway implementation instance for the backend. */
  public static getImplementationForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    if (!Registry.instance.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not registered.`);

    const instance = Registry.instance.implementations.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not initialized.`);

    return instance;
  }

  /** Registers the gateway implementation class for the backend. */
  public static registerImplementation<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, implementation: GatewayImplementation<TImplementation>) {
    if (Registry.instance.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${definition.name}" is already registered.`);

    Registry.instance.implementationClasses.set(definition.name, implementation);
  }

  /**
   * Initializes a gateway class.
   * @note This function must be called on the frontend and on the backend for each gateway class used by an application.
   */
  public static initialize<T extends Gateway>(definition: GatewayDefinition<T>) {
    let directProtocol = false;

    definition.types().forEach((type) => {
      const name = `${definition.name}_${type.name}`;
      if (Registry.instance.types.has(name))
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is already registered for gateway type marshaling.`);

      Registry.instance.types.set(name, type);
    });

    const registeredImplementation = Registry.instance.implementationClasses.get(definition.name) as GatewayImplementation<T>;
    if (registeredImplementation) {
      if (Registry.instance.implementations.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is already initialized.`);

      if (definition.prototype.applicationConfigurationSupplier)
        registeredImplementation.prototype.applicationConfigurationSupplier = definition.prototype.applicationConfigurationSupplier;

      const implementation = new registeredImplementation();
      Registry.instance.implementations.set(definition.name, implementation);
      directProtocol = implementation.configuration.protocol instanceof GatewayDirectProtocol;
    }

    if (!registeredImplementation || directProtocol) {
      if (Registry.instance.proxies.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is already initialized.`);

      const proxy = new (definition as any)();
      Registry.instance.proxies.set(definition.name, proxy);
      Gateway.forEachOperation(definition, (operation) => proxy[operation] = proxy[operation].bind(proxy, operation));
    }
  }

  /** Sets the application-supplied configuration for a gateway class. */
  public static setConfiguration<T extends Gateway>(gateway: GatewayDefinition<T>, supplier: GatewayConfigurationSupplier) {
    gateway.prototype.applicationConfigurationSupplier = supplier;
  }

  /** Iterates the operation function names of a gateway class. */
  public static forEachOperation<T extends Gateway>(gateway: GatewayDefinition<T>, callback: (operation: string) => void) {
    const operations = gateway.prototype;
    Object.getOwnPropertyNames(operations).forEach((operation) => {
      if (operation !== "constructor")
        callback(operation);
    });
  }

  /** JSON.stringify replacer callback that marshals JavaScript class instances. */
  public static marshal(this: any, key: string, value: any) {
    let originalValue = value;
    let wasCustomized = false;
    if (this[key] !== value && (typeof (value) !== "object" || value === null || Array.isArray(value))) {
      wasCustomized = true;
      originalValue = this[key];
    }

    if (typeof (originalValue) === "object" && originalValue !== null && !Array.isArray(originalValue) && originalValue.constructor !== Object) {
      const name = `${marshalingScope}_${originalValue.constructor.name}`;
      if (!Registry.instance.types.has(name))
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is not registered for gateway type marshaling.`);

      if (wasCustomized) {
        return { [Gateway.MARSHALING_NAME_PROPERTY]: name, [Gateway.MARSHALING_CUSTOM_JSON_PROPERTY]: value };
      } else {
        value[Gateway.MARSHALING_NAME_PROPERTY] = name;

        const undefineds = [];
        for (const prop in value) {
          if (value.hasOwnProperty(prop) && value[prop] === undefined)
            undefineds.push(prop);
        }

        if (undefineds.length)
          value[Gateway.MARSHALING_UNDEFINED_MEMBERS_PROPERTY] = undefineds;
      }
    }

    return value;
  }

  /** JSON.parse reviver callback that unmarshals JavaScript class instances. */
  public static unmarshal(_key: string, value: any) {
    if (typeof (value) === "object" && value !== null && value[Gateway.MARSHALING_NAME_PROPERTY]) {
      const name = value[Gateway.MARSHALING_NAME_PROPERTY];
      delete value[Gateway.MARSHALING_NAME_PROPERTY];
      const type = Registry.instance.types.get(name);
      if (!type)
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is not registered for gateway type marshaling.`);

      const customJSON = value[Gateway.MARSHALING_CUSTOM_JSON_PROPERTY];
      if (customJSON) {
        const typeFromJSON = (type as any).fromJSON;
        if (typeFromJSON)
          return typeFromJSON(customJSON);
        else
          return new (type as any)(customJSON);
      } else {
        const undefineds = value[Gateway.MARSHALING_UNDEFINED_MEMBERS_PROPERTY];
        if (undefineds)
          delete value[Gateway.MARSHALING_UNDEFINED_MEMBERS_PROPERTY];

        const descriptors: { [index: string]: PropertyDescriptor } = {};
        const props = Object.keys(value);
        for (const prop of props)
          descriptors[prop] = Object.getOwnPropertyDescriptor(value, prop) as PropertyDescriptor;

        if (undefineds) {
          for (const prop of undefineds)
            descriptors[prop] = { configurable: true, enumerable: true, writable: true, value: undefined };
        }

        return Object.create(type.prototype, descriptors);
      }
    }

    return value;
  }

  /** The configuration for the gateway. */
  public configuration = this.supplyConfiguration();

  /** The default configuration for a gateway class. */
  public defaultConfigurationSupplier: GatewayConfigurationSupplier;

  /** The application-supplied configuration for a gateway class. */
  public applicationConfigurationSupplier: GatewayConfigurationSupplier | undefined;

  /** Invokes the backend implementation of a gateway operation by name. */
  public async invoke<T>(operation: string, ...parameters: any[]): Promise<T> {
    const implementation = (this as any)[operation];
    if (!implementation || typeof (implementation) !== "function")
      throw new IModelError(BentleyStatus.ERROR, `Gateway class "${this.constructor.name}" does not implement operation "${operation}".`, Logger.logError);

    return await implementation.call(this, ...parameters);
  }

  /** Returns the configuration for the gateway. */
  public supplyConfiguration(): GatewayConfiguration {
    const supplier = this.applicationConfigurationSupplier || this.defaultConfigurationSupplier;
    return GatewayConfiguration.getInstance(supplier());
  }

  /** Obtains the implementation result for a gateway operation. */
  public forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    return this.configuration.protocol.obtainGatewayImplementationResult<T>(this.constructor as any, operation, ...parameters);
  }
}

Gateway.prototype.defaultConfigurationSupplier = () => GatewayDefaultConfiguration;
Gateway.prototype.applicationConfigurationSupplier = undefined;

/** An application protocol for a gateway. */
export abstract class GatewayProtocol {
  /** The configuration for the protocol. */
  public configuration: GatewayConfiguration;

  /** Creates a protocol. */
  public constructor(configuration: GatewayConfiguration) {
    this.configuration = configuration;
  }

  /** Obtains the implementation result for a gateway operation. */
  public abstract obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T>;

  public serializeOperationValue(gatewayName: string, value: any) {
    marshalingScope = gatewayName;
    return JSON.stringify(value, Gateway.marshal);
  }
}

/** Direct function call protocol within a single JavaScript context (suitable for testing). */
export class GatewayDirectProtocol extends GatewayProtocol {
  public obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      try {
        const impl = Gateway.getImplementationForGateway(gateway);
        const result = await impl.invoke<T>(operation, ...parameters);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  }
}

/** Operating parameters for a gateway. */
export abstract class GatewayConfiguration {
  /** The protocol of the configuration. */
  public abstract protocol: GatewayProtocol;

  /** The gateways managed by the configuration. */
  public abstract gateways: () => GatewayDefinition[];

  /** Reserved for an application authorization key. */
  public applicationAuthorizationKey: string;

  /** Reserved for an application authorization value. */
  public applicationAuthorizationValue: string;

  /** The target interval (in milliseconds) between connection attempts for pending gateway operation requests. */
  public pendingOperationRetryInterval = 10000;

  /** Returns the instance of a configuration class. */
  public static getInstance<T extends GatewayConfiguration>(constructor: { new(): T }): T {
    let instance = (constructor as any)[INSTANCE] as T;
    if (!instance)
      instance = (constructor as any)[INSTANCE] = new constructor();

    return instance;
  }

  /** Initializes the gateways managed by the configuration. */
  public initializeGateways() {
    this.gateways().forEach((gateway) => Gateway.initialize(gateway));
  }
}

/** A default gateway configuration (suitable for testing). */
export class GatewayDefaultConfiguration extends GatewayConfiguration {
  public gateways = () => [];
  public protocol: GatewayProtocol = new GatewayDirectProtocol(this);
}
