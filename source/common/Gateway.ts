/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "./IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

const INSTANCE = Symbol("instance");
const registry: { [index: string]: GatewayConstructor<Gateway> } = {};

interface PromiseCallbacks<T> { resolve: (value?: T | PromiseLike<T>) => void; reject: (reason?: any) => void; }
export interface GatewayConstructor<T extends Gateway> { new(): T; }

export type GatewayImplementation<T extends Gateway> = GatewayConstructor<T>;
export interface GatewayDefinition<T extends Gateway> { prototype: T; }
export type GatewayProtocolSupplier = () => { new(gateway: Gateway): Gateway.Protocol };
export type GatewayConfigurationSupplier = () => { new(gateway: Gateway): Gateway.Configuration };

/** A set of related asynchronous APIs that operate over configurable protocols across multiple platforms. */
export abstract class Gateway {
  /** Returns the gateway proxy instance for the frontend. */
  public static getProxyForGateway<T extends Gateway>(definitionClass: GatewayDefinition<T>) {
    let instance = Gateway.getInstance(definitionClass);
    if (!instance) {
      instance = Gateway.makeInstance(definitionClass as GatewayConstructor<T>);
      instance.setupProxyInstance();
    }

    return instance;
  }

  /** Registers the gateway implementation class for the backend. */
  public static registerImplementation<T extends Gateway>(definitionClass: GatewayDefinition<T>, implementationConstructor: GatewayImplementation<T>) {
    const name = (definitionClass as any).name;
    if (registry.hasOwnProperty(name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${name}" is already registered.`);

    registry[name] = implementationConstructor;
  }

  /** Invokes a gateway operation on the backend. */
  public static invokeOperation(request: any, gateway: string, operation: string, parameters: any[]) {
    const gatewayImplClass = Gateway.lookupGatewayClass(gateway);

    let gatewayImpl = Gateway.getInstance(gatewayImplClass);
    if (!gatewayImpl) {
      gatewayImpl = Gateway.makeInstance(gatewayImplClass);
      gatewayImpl.setupImplementationInstance();
    }

    const operationFunction = (gatewayImpl as any)[operation];
    if (!operationFunction)
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${gateway}" does not support operation "${operation}".`);

    operationFunction.apply(request, parameters);
  }

  /** Sets the protocol for a gateway class. */
  public static setProtocol<T extends Gateway>(gateway: GatewayDefinition<T>, supplier: GatewayProtocolSupplier) {
    gateway.prototype.applicationProtocolSupplier = supplier;
  }

  /** Sets the protocol for a gateway class. */
  public static setConfiguration<T extends Gateway>(gateway: GatewayDefinition<T>, supplier: GatewayConfigurationSupplier) {
    gateway.prototype.applicationConfigurationSupplier = supplier;
  }

  /** The protocol for the gateway. */
  public protocol = this.supplyProtocol();

  /** The configuration for the gateway. */
  public configuration = this.supplyConfiguration();

  /** The default protocol for a gateway class. */
  public defaultProtocolSupplier: GatewayProtocolSupplier;

  /** The default configuration for a gateway class. */
  public defaultConfigurationSupplier: GatewayConfigurationSupplier;

  /** The application-supplied protocol for a gateway class. */
  public applicationProtocolSupplier: GatewayProtocolSupplier | undefined;

  /** The application-supplied configuration for a gateway class. */
  public applicationConfigurationSupplier: GatewayConfigurationSupplier | undefined;

  /** Returns the protocol for the gateway. */
  protected supplyProtocol(): Gateway.Protocol {
    const supplier = this.applicationProtocolSupplier || this.defaultProtocolSupplier;
    return new (supplier())(this);
  }

  /** Returns the configuration for the gateway. */
  protected supplyConfiguration(): Gateway.Configuration {
    const supplier = this.applicationConfigurationSupplier || this.defaultConfigurationSupplier;
    return new (supplier())(this);
  }

  /** Sends a gateway operation request to the backend. */
  protected forward<T>(operation: string, ...parameters: any[]) {
    return this.protocol.sendRequestToBackend<T>(operation, parameters);
  }

  /** Sends the response for a gateway operation request to the frontend. */
  protected respond(request: any, operation: string, result: any, error: boolean) {
    this.protocol.sendResponseToFrontend(request, operation, result, error);
  }

  /** Configures a gateway proxy. */
  protected setupProxyInstance() {
    const operations = Object.getPrototypeOf(this);
    Object.getOwnPropertyNames(operations).forEach((operation) => this.makeOperationForwarder(operation));
  }

  /** Configures a gateway implementation. */
  protected setupImplementationInstance() {
    const operations = Object.getPrototypeOf(this);
    Object.getOwnPropertyNames(operations).forEach((operation) => this.makeOperationResponder(operation));
  }

  /** Creates a proxy forwarder for a gateway API operation. */
  protected makeOperationForwarder(operation: string) {
    if (operation === "constructor")
      return;

    const object = this as any;
    object[operation] = object[operation].bind(object, operation);
  }

  /** Creates an implementation responder for a gateway API operation. */
  protected makeOperationResponder(operation: string) {
    const gateway = this;
    const object = gateway as any;
    const implementation = object[operation];

    object[operation] = async function() {
      try {
        const result = await implementation.apply(gateway, arguments);
        gateway.respond(this, operation, result, false);
      } catch (e) {
        gateway.respond(this, operation, e, true);
      }
    };
  }

  /** Returns the instance of a gateway class if it exists. */
  private static getInstance<T extends Gateway>(definition: GatewayDefinition<T>) {
    if (!definition.hasOwnProperty(INSTANCE))
      return undefined;

    return (definition as any)[INSTANCE] as T;
  }

  /** Creates and returns the instance of a gateway class. */
  private static makeInstance<T extends Gateway>(constructor: GatewayConstructor<T>) {
    return (constructor as any)[INSTANCE] = new constructor();
  }

  /** Returns a gateway implementation class by name. */
  private static lookupGatewayClass(name: string) {
    const gateway = registry[name];
    if (!gateway)
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${name}" is not registered.`);

    return gateway;
  }
}

Gateway.prototype.defaultProtocolSupplier = () => Gateway.DirectProtocol;
Gateway.prototype.defaultConfigurationSupplier = () => Gateway.Configuration.Default;
Gateway.prototype.applicationProtocolSupplier = undefined;
Gateway.prototype.applicationConfigurationSupplier = undefined;

export namespace Gateway {
  /** An application protocol for a gateway. */
  export abstract class Protocol {
    public gateway: Gateway;

    constructor(gateway: Gateway) {
      this.gateway = gateway;
    }

    public abstract sendRequestToBackend<T>(operation: string, parameters: any[]): Promise<T>;
    public abstract sendResponseToFrontend(request: any, operation: string, result: any, error: boolean): void;
  }

  /** The HTTP application protocol. */
  export abstract class HttpProtocol extends Protocol {

  }

  /** IPC within an Electron application. */
  export abstract class ElectronProtocol extends Protocol {

  }

  /** Direct function call protocol within a single JavaScript context (suitable for testing). */
  export class DirectProtocol extends Protocol {
    public sendRequestToBackend<T>(operation: string, parameters: any[]): Promise<T> {
      return new Promise((resolve, reject) => {
        Gateway.invokeOperation({ resolve, reject }, this.gateway.constructor.name, operation, parameters);
      });
    }

    public sendResponseToFrontend(request: any, _operation: string, result: any, error: boolean): void {
      const promise = request as PromiseCallbacks<any>;
      if (error)
        promise.reject(result);
      else
        promise.resolve(result);
    }
  }

  /** Operating parameters for a gateway. */
  export abstract class Configuration {
    public gateway: Gateway;

    constructor(gateway: Gateway) {
      this.gateway = gateway;
    }
  }

  export namespace Configuration {
    export class Default extends Configuration {
    }
  }
}
