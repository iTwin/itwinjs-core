/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "./IModelError";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { GatewayRegistry, GatewayDirectProtocol } from "./gateway/GatewayProtocol";
import { GatewayConfiguration, GatewayDefaultConfiguration } from "./gateway/GatewayConfiguration";

const registry = GatewayRegistry.instance(Symbol.for("@bentley/imodeljs-core/common/Gateway"));

export type GatewayImplementation<T extends Gateway = Gateway> = new () => T;
// tslint:disable-next-line:ban-types
export interface GatewayDefinition<T extends Gateway = Gateway> { prototype: T; name: string; version: string; types: () => Function[]; }
export type GatewayConfigurationSupplier = () => { new(): GatewayConfiguration };

/** Runtime information related to the operation load of one or more gateways. */
export interface GatewayOperationsProfile {
  readonly lastRequest: number;
  readonly lastResponse: number;
}

/** A set of related asynchronous APIs that operate over configurable protocols across multiple platforms. */
export abstract class Gateway {
  /** The aggregate operation load of all active gateways. */
  public static get aggregateLoad(): GatewayOperationsProfile {
    return Gateway._aggregateLoad;
  }

  /** Returns the gateway proxy instance for the frontend. */
  public static getProxyForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    const instance = registry.proxies.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is not initialized.`);

    return instance;
  }

  /** Returns the gateway implementation instance for the backend. */
  public static getImplementationForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    if (!registry.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not registered.`);

    const instance = registry.implementations.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not initialized.`);

    return instance;
  }

  /** Registers the gateway implementation class for the backend. */
  public static registerImplementation<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, implementation: GatewayImplementation<TImplementation>) {
    if (registry.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${definition.name}" is already registered.`);

    registry.implementationClasses.set(definition.name, implementation);
  }

  /**
   * Initializes a gateway class.
   * @note This function must be called on the frontend and on the backend for each gateway class used by an application.
   */
  public static initialize<T extends Gateway>(definition: GatewayDefinition<T>) {
    let directProtocol = false;

    definition.types().forEach((type) => {
      const name = `${definition.name}_${type.name}`;
      if (registry.types.has(name))
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is already registered for gateway type marshaling.`);

      registry.types.set(name, type);
    });

    const registeredImplementation = registry.implementationClasses.get(definition.name) as GatewayImplementation<T>;
    if (registeredImplementation) {
      if (registry.implementations.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is already initialized.`);

      if (definition.prototype.applicationConfigurationSupplier)
        registeredImplementation.prototype.applicationConfigurationSupplier = definition.prototype.applicationConfigurationSupplier;

      const implementation = new registeredImplementation();
      registry.implementations.set(definition.name, implementation);
      directProtocol = implementation.configuration.protocol instanceof GatewayDirectProtocol;
    }

    if (!registeredImplementation || directProtocol) {
      if (registry.proxies.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is already initialized.`);

      const proxy = new (definition as any)();
      registry.proxies.set(definition.name, proxy);
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

  /** The configuration for the gateway. */
  public configuration = this.supplyConfiguration();

  /** The default configuration for a gateway class. */
  public defaultConfigurationSupplier: GatewayConfigurationSupplier;

  /** The application-supplied configuration for a gateway class. */
  public applicationConfigurationSupplier: GatewayConfigurationSupplier | undefined;

  /** Invokes the backend implementation of a gateway operation by name. */
  public async invoke<T>(operation: string, ...parameters: any[]): Promise<T> {
    Gateway.recordRequest();

    const implementation = (this as any)[operation];
    if (!implementation || typeof (implementation) !== "function")
      throw new IModelError(BentleyStatus.ERROR, `Gateway class "${this.constructor.name}" does not implement operation "${operation}".`, Logger.logError, "imodeljs-backend.Gateway");

    const result = await implementation.call(this, ...parameters);
    Gateway.recordResponse();
    return result;
  }

  /** Returns the configuration for the gateway. */
  public supplyConfiguration(): GatewayConfiguration {
    const supplier = this.applicationConfigurationSupplier || this.defaultConfigurationSupplier;
    return GatewayConfiguration.getInstance(supplier());
  }

  /** Obtains the implementation result for a gateway operation. */
  public forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    Gateway.recordRequest();
    return this.configuration.protocol.obtainGatewayImplementationResult<T>(this.constructor as any, operation, ...parameters);
  }

  /** @internal */
  private static _aggregateLoad = {
    lastRequest: 0,
    lastResponse: 0,
  };

  /** @internal */
  public static recordRequest() {
    Gateway._aggregateLoad.lastRequest = new Date().getTime();
  }

  /** @internal */
  public static recordResponse() {
    Gateway._aggregateLoad.lastResponse = new Date().getTime();
  }
}

Gateway.prototype.defaultConfigurationSupplier = () => GatewayDefaultConfiguration;
Gateway.prototype.applicationConfigurationSupplier = undefined;
