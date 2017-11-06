/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "./IModelError";
import { Logger } from "./Logger";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

const INSTANCE = Symbol("instance");
const registry: Map<GatewayDefinition<Gateway>, GatewayImplementation<Gateway>> = new Map();

export interface GatewayConstructor<T extends Gateway> { new(): T; }

export type GatewayImplementation<T extends Gateway> = GatewayConstructor<T>;
export interface GatewayDefinition<T extends Gateway> { prototype: T; name: string; }
export type GatewayConfigurationSupplier = () => { new(gateway: Gateway): Gateway.Configuration };

/** A set of related asynchronous APIs that operate over configurable protocols across multiple platforms. */
export abstract class Gateway {
  /** Returns the gateway proxy instance for the frontend. */
  public static getProxyForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    const instance = Gateway.getInstance(definition);
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is not initialized.`);

    return instance;
  }

  /** Returns the gateway implementation instance for the backend. */
  public static getImplementationForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    if (!registry.has(definition))
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not registered.`);

    const implementation = registry.get(definition) as GatewayImplementation<T>;
    const instance = Gateway.getInstance(implementation);
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not initialized.`);

    return instance;
  }

  /** Registers the gateway implementation class for the backend. */
  public static registerImplementation<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, implementation: GatewayImplementation<TImplementation>) {
    if (registry.has(definition))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${definition.name}" is already registered.`);

    registry.set(definition, implementation);
  }

  /**
   * Initializes a gateway class.
   * @note This function must be called on the frontend and on the backend for each gateway class used by an application.
   */
  public static initialize<T extends Gateway>(definition: GatewayDefinition<T>) {
    let directProtocol = false;

    const registeredImplementation = registry.get(definition) as GatewayImplementation<T>;
    if (registeredImplementation) {
      if (Gateway.getInstance(registeredImplementation))
        throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is already initialized.`);

      const implementation = Gateway.makeInstance(registeredImplementation);
      implementation.setupImplementationInstance();

      directProtocol = implementation.configuration.protocol instanceof Gateway.DirectProtocol;
    }

    if (!registeredImplementation || directProtocol) {
      if (Gateway.getInstance(definition))
        throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is already initialized.`);

      const proxy = Gateway.makeInstance(definition as GatewayConstructor<T>);
      proxy.setupProxyInstance();
    }
  }

  /** Sets the application-supplied configuration for a gateway class. */
  public static setConfiguration<T extends Gateway>(gateway: GatewayDefinition<T>, supplier: GatewayConfigurationSupplier) {
    gateway.prototype.applicationConfigurationSupplier = supplier;
  }

  /** The configuration for the gateway. */
  public configuration = this.supplyConfiguration();

  /** The default configuration for a gateway class. */
  public defaultConfigurationSupplier: GatewayConfigurationSupplier;

  /** The application-supplied configuration for a gateway class. */
  public applicationConfigurationSupplier: GatewayConfigurationSupplier | undefined;

  /** Invokes the backend implementation of a gateway operation by name. */
  public async invoke<T>(operation: string, parameters: any[]): Promise<T> {
    const implementation = (this as any)[operation];
    if (!implementation || typeof (implementation) !== "function")
      throw new IModelError(BentleyStatus.ERROR, `Gateway class "${this.constructor.name}" does not implement operation "${operation}".`, Logger.logError);

    return await implementation.apply(this, parameters);
  }

  /** Returns the configuration for the gateway. */
  protected supplyConfiguration(): Gateway.Configuration {
    const supplier = this.applicationConfigurationSupplier || this.defaultConfigurationSupplier;
    return new (supplier())(this);
  }

  /** Obtains the implementation result for a gateway operation. */
  protected forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    return this.configuration.protocol.obtainGatewayImplementationResult<T>(operation, parameters);
  }

  /** Configures a gateway proxy. */
  protected setupProxyInstance() {
    const operations = Object.getPrototypeOf(this);
    Object.getOwnPropertyNames(operations).forEach((operation) => this.makeOperationForwarder(operation));
  }

  /** Configures a gateway implementation. */
  protected setupImplementationInstance() {
    // No default setup
  }

  /** Creates a proxy forwarder for a gateway API operation. */
  protected makeOperationForwarder(operation: string) {
    if (operation === "constructor")
      return;

    const object = this as any;
    object[operation] = object[operation].bind(object, operation);
  }

  /** Returns the instance of a gateway class if it exists. */
  private static getInstance<T extends Gateway>(definition: GatewayDefinition<T> | GatewayImplementation<T>) {
    if (!definition.hasOwnProperty(INSTANCE))
      return undefined;

    return (definition as any)[INSTANCE] as T;
  }

  /** Creates and returns the instance of a gateway class. */
  private static makeInstance<T extends Gateway>(constructor: GatewayConstructor<T>) {
    return (constructor as any)[INSTANCE] = new constructor();
  }
}

Gateway.prototype.defaultConfigurationSupplier = () => Gateway.Configuration.Default;
Gateway.prototype.applicationConfigurationSupplier = undefined;

export namespace Gateway {
  /** Operating parameters for a gateway. */
  export abstract class Configuration {
    public gateway: Gateway;

    constructor(gateway: Gateway) {
      this.gateway = gateway;
    }

    /** The protocol for the gateway. */
    public abstract protocol: Gateway.Protocol;
  }

  /** An application protocol for a gateway. */
  export abstract class Protocol {
    public gateway: Gateway;

    constructor(gateway: Gateway) {
      this.gateway = gateway;
    }

    /** Obtains the implementation result for a gateway operation. */
    public abstract obtainGatewayImplementationResult<T>(operation: string, parameters: any[]): Promise<T>;
  }

  /** The HTTP application protocol. */
  export abstract class HttpProtocol extends Protocol {
    public abstract openApiInfo: HttpProtocol.OpenApiInfo;
    public openApiPaths: HttpProtocol.OpenApiPaths = {};

    /** A Swagger / OpenAPI 3.0 description of the RESTful API that is exposed through this protocol. */
    public generateOpenApiDescription(): HttpProtocol.OpenApiDocument {
      return {
        openapi: "3.0.0",
        info: this.openApiInfo,
        paths: this.openApiPaths,
      };
    }
  }

  export namespace HttpProtocol {
    /** An OpenAPI 3.0 root document object. */
    export interface OpenApiDocument {
      openapi: "3.0.0";
      info: OpenApiInfo;
      paths: OpenApiPaths;
    }

    /** An OpenAPI 3.0 info object. */
    export interface OpenApiInfo {
      title: string;
      description?: string;
      version: string;
    }

    /** An OpenAPI 3.0 paths object. */
    export interface OpenApiPaths {
      [index: string]: OpenApiPathItem;
    }

    /** An OpenAPI 3.0 path item object. */
    export interface OpenApiPathItem {
      summary?: string;
      description?: string;
      get?: OpenApiOperation;
      put?: OpenApiOperation;
      post?: OpenApiOperation;
      delete?: OpenApiOperation;
      options?: OpenApiOperation;
      head?: OpenApiOperation;
      patch?: OpenApiOperation;
      trace?: OpenApiOperation;
    }

    /** An OpenAPI 3.0 operation object. */
    export interface OpenApiOperation {
      tags?: string[];
      summary?: string;
      description?: string;
      operationId?: string;
      parameters?: OpenApiParameter[];
      requestBody?: OpenApiRequestBody;
      responses: OpenApiResponses;
    }

    /** An OpenAPI 3.0 parameter object. */
    export interface OpenApiParameter {
      name: string;
      in: "query" | "header" | "path" | "cookie";
      description?: string;
      required?: boolean;
      allowEmptyValue?: boolean;
      style?: "matrix" | "label" | "form" | "simple" | "spaceDelimited" | "pipeDelimited" | "deepObject";
      explode?: boolean;
      allowReserved?: boolean;
      content?: { [index: string]: OpenApiMediaType };
    }

    /** An OpenAPI 3.0 media type object. */
    export interface OpenApiMediaType {
      schema?: OpenApiSchema;
    }

    /** An OpenAPI 3.0 schema object. */
    export interface OpenApiSchema {
      type?: "boolean" | "object" | "array" | "number" | "string";
      nullable?: boolean;
      description?: string;
    }

    /** An OpenAPI 3.0 encoding object. */
    export interface OpenApiEncoding {
      contentType?: string;
      style?: string;
      explode?: boolean;
      allowReserved?: boolean;
    }

    /** An OpenAPI 3.0 parameter object. */
    export interface OpenApiRequestBody {
      description?: string;
      content: { [index: string]: OpenApiMediaType };
      required?: boolean;
    }

    /** An OpenAPI 3.0 responses object. */
    export interface OpenApiResponses {
      default?: OpenApiResponse;
      "200"?: OpenApiResponse;
      "301"?: OpenApiResponse;
      "302"?: OpenApiResponse;
      "400"?: OpenApiResponse;
      "404"?: OpenApiResponse;
      "500"?: OpenApiResponse;
    }

    /** An OpenAPI 3.0 response object. */
    export interface OpenApiResponse {
      description: string;
      content?: { [index: string]: OpenApiMediaType };
    }
  }

  /** IPC within an Electron application. */
  export abstract class ElectronProtocol extends Protocol {

  }

  /** Direct function call protocol within a single JavaScript context (suitable for testing). */
  export class DirectProtocol extends Protocol {
    public obtainGatewayImplementationResult<T>(operation: string, parameters: any[]): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        try {
          const impl = Gateway.getImplementationForGateway<Gateway>(this.gateway.constructor);
          const result = await impl.invoke<T>(operation, parameters);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }
  }

  export namespace Configuration {
    export class Default extends Configuration {
      public protocol = new DirectProtocol(this.gateway);
    }
  }
}
