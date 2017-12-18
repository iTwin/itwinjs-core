/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "./IModelError";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

const INSTANCE = Symbol("instance");
const NAME = Symbol("name");
const registry: Map<GatewayDefinition, GatewayImplementation> = new Map();
// tslint:disable-next-line:ban-types
const types: Map<string, Function> = new Map();

// tslint:disable-next-line:ban-types
export interface GatewayConstructor<T extends Gateway> { new(): T; version: string; types: () => Function[]; }

export type GatewayImplementation<T extends Gateway = Gateway> = GatewayConstructor<T>;
// tslint:disable-next-line:ban-types
export interface GatewayDefinition<T extends Gateway = Gateway> { prototype: T; name: string; version: string; types: () => Function[]; }
export type GatewayConfigurationSupplier = () => { new(): Gateway.Configuration };

/** A set of related asynchronous APIs that operate over configurable protocols across multiple platforms. */
export abstract class Gateway {
  /** The name of the marshaling type identification property.  */
  public static MARSHALING_NAME_PROPERTY = "__$__";

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

    Gateway.initializeCommon(definition);

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

  /** Iterates the operation function names of a gateway class. */
  public static forEachOperation<T extends Gateway>(gateway: GatewayDefinition<T>, callback: (operation: string) => void) {
    const operations = gateway.prototype;
    Object.getOwnPropertyNames(operations).forEach((operation) => {
      if (operation !== "constructor")
        callback(operation);
    });
  }

  /** JSON.stringify replacer callback that marshals JavaScript class instances. */
  public static marshal(_key: string, value: any) {
    if (typeof (value) === "object" && value !== null && value.constructor !== Array && value.constructor !== Object) {
      const name: string = value.constructor[NAME];
      if (!name)
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is not registered for gateway type marshaling.`);

      value[Gateway.MARSHALING_NAME_PROPERTY] = name;
    }

    return value;
  }

  /** JSON.parse reviver callback that unmarshals JavaScript class instances. */
  public static unmarshal(_key: string, value: any) {
    if (typeof (value) === "object" && value !== null && value[Gateway.MARSHALING_NAME_PROPERTY]) {
      const name = value[Gateway.MARSHALING_NAME_PROPERTY];
      delete value[Gateway.MARSHALING_NAME_PROPERTY];
      const type = types.get(name);
      if (!type)
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is not registered for gateway type marshaling.`);

      const descriptors: { [index: string]: PropertyDescriptor } = {};
      const props = Object.keys(value);
      for (const prop of props)
        descriptors[prop] = Object.getOwnPropertyDescriptor(value, prop) as PropertyDescriptor;

      return Object.create(type.prototype, descriptors);
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
  protected supplyConfiguration(): Gateway.Configuration {
    const supplier = this.applicationConfigurationSupplier || this.defaultConfigurationSupplier;
    return Gateway.Configuration.getInstance(supplier());
  }

  /** Obtains the implementation result for a gateway operation. */
  protected forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    return this.configuration.protocol.obtainGatewayImplementationResult<T>(this.constructor as GatewayConstructor<Gateway>, operation, ...parameters);
  }

  /** Configures a gateway proxy. */
  protected setupProxyInstance() {
    Gateway.forEachOperation(this.constructor as GatewayConstructor<Gateway>, (operation) => this.makeOperationForwarder(operation));
  }

  /** Configures a gateway implementation. */
  protected setupImplementationInstance() {
    // No default setup
  }

  /** Creates a proxy forwarder for a gateway API operation. */
  protected makeOperationForwarder(operation: string) {
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

  /** Common configuration. */
  private static initializeCommon<T extends Gateway>(definition: GatewayDefinition<T>) {
    definition.types().forEach((type) => {
      const name = `${definition.name}_${type.name}`;
      if (types.has(name))
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is already registered for gateway type marshaling.`);

      types.set(name, type);
      (type as any)[NAME] = name;
    });
  }
}

Gateway.prototype.defaultConfigurationSupplier = () => Gateway.Configuration.Default;
Gateway.prototype.applicationConfigurationSupplier = undefined;

export namespace Gateway {
  /** Operating parameters for a gateway. */
  export abstract class Configuration {
    /** The protocol of the configuration. */
    public abstract protocol: Gateway.Protocol;

    /** The gateways managed by the configuration. */
    public abstract gateways: () => GatewayDefinition[];

    /** Reserved for an application authorization key. */
    public applicationAuthorizationKey: string;

    /** Reserved for an application authorization value. */
    public applicationAuthorizationValue: string;

    /** The target interval (in milliseconds) between connection attempts for pending gateway operation requests. */
    public pendingOperationRetryInterval = 10000;

    /** Returns the instance of a configuration class. */
    public static getInstance<T extends Configuration>(constructor: { new(): T }): T {
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

  /** An application protocol for a gateway. */
  export abstract class Protocol {
    /** The configuration for the protocol. */
    protected configuration: Configuration;

    /** Creates a protocol. */
    public constructor(configuration: Configuration) {
      this.configuration = configuration;
    }

    /** Obtains the implementation result for a gateway operation. */
    public abstract obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T>;
  }

  /** The HTTP application protocol. */
  export abstract class HttpProtocol extends Protocol {
    private _pending: HttpProtocol.PendingOperationRequest[] = [];
    protected _pendingInterval: any = undefined;

    /** Listeners for status information regarding pending gateway operation requests. */
    public pendingOperationRequestListeners: HttpProtocol.PendingOperationRequestListener[] = [];

    /** Associates the gateways for the protocol with unique names. */
    protected gatewayRegistry: Map<string, GatewayDefinition> = new Map();

    /** Returns the registered backend implementation for a gateway operation. */
    public lookupGatewayImplementation(operation: HttpProtocol.GatewayOperationIdentifier): Gateway {
      const gateway = this.gatewayRegistry.get(operation.gateway) as GatewayDefinition;
      return Gateway.getImplementationForGateway(gateway);
    }

    /** Returns the operation specified by an OpenAPI gateway path. */
    public abstract getOperationFromOpenAPIPath(path: string): HttpProtocol.GatewayOperationIdentifier;

    /** Returns deserialized gateway operation request parameters. */
    public deserializeOperationRequestParameters(request: string, _path: string): any[] {
      return JSON.parse(request, Gateway.unmarshal);
    }

    /** Returns a serialized gateway operation result. */
    public serializeOperationResult(result: any): string {
      return JSON.stringify(result, Gateway.marshal);
    }

    /** The OpenAPI info object for the protocol. */
    protected abstract openAPIInfo: () => HttpProtocol.OpenAPIInfo;

    /** Generates an OpenAPI path for a gateway operation. */
    protected abstract generateOpenAPIPathForOperation(operation: HttpProtocol.GatewayOperationIdentifier, request: HttpProtocol.OperationRequest | undefined): string;

    /** Returns the HTTP verb for a gateway operation. */
    protected supplyHttpVerbForOperation(_identifier: HttpProtocol.GatewayOperationIdentifier): "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace" {
      return "post";
    }

    /** Returns the OpenAPI path parameters for a gateway operation. */
    protected supplyOpenAPIPathParametersForOperation(_identifier: HttpProtocol.GatewayOperationIdentifier): HttpProtocol.OpenAPIParameter[] {
      return [];
    }

    /** Obtains the implementation result for a gateway operation. */
    public obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const request = new HttpProtocol.PendingOperationRequest(gateway, operation, parameters, resolve, reject, this.requestCleanupHandler);
        request.retryInterval = this.configuration.pendingOperationRetryInterval;

        this.reportPendingRequestStatus(request);

        if (request.active) {
          request.lastAttempted = new Date().getTime();
          this.performGatewayOperationRequest(request);
        }
      });
    }

    /** Performs a request for a gateway operation. */
    protected performGatewayOperationRequest(request: HttpProtocol.PendingOperationRequest) {
      try {
        const identifier = {
          gateway: this.obtainGatewayName(request.gateway),
          version: request.gateway.version,
          operation: request.operation,
        };

        const path = this.generateOpenAPIPathForOperation(identifier, new HttpProtocol.OperationRequest(...request.parameters));
        const connection = this.generateConnectionForOperationRequest();
        connection.open(this.supplyHttpVerbForOperation(identifier), path, true);

        connection.addEventListener("load", () => {
          if (!request.active)
            return;

          if (this.canResolvePendingRequest(request, connection.status)) {
            const result = this.deserializeOperationResult(connection.responseText);
            request.resolve(result);
          } else if (this.isPendingRequestPending(request, connection.status)) {
            this.registerPendingRequest(request);
            request.currentStatus = connection.responseText;
            this.reportPendingRequestStatus(request);
          } else if (this.shouldRejectPendingRequest(request, connection.status)) {
            const error = new IModelError(BentleyStatus.ERROR, `Server error: ${connection.status} ${connection.responseText}`);
            request.reject(error);
          } else {
            throw new IModelError(BentleyStatus.ERROR, "Unhandled response.");
          }
        });

        connection.addEventListener("error", () => {
          if (!request.active)
            return;

          request.reject(new IModelError(BentleyStatus.ERROR, "Connection error."));
        });

        connection.addEventListener("abort", () => {
          if (!request.active)
            return;

          request.reject(new IModelError(BentleyStatus.ERROR, "Connection aborted."));
        });

        this.setOperationRequestHeaders(connection);

        const payload = this.serializeParametersForOperationRequest(identifier, ...request.parameters);
        connection.send(payload);
      } catch (e) {
        if (!request.active)
          return;

        request.reject(new IModelError(BentleyStatus.ERROR, e));
      }
    }

    /** Returns an XMLHttpRequest instance for a gateway operation request. */
    protected generateConnectionForOperationRequest(): XMLHttpRequest {
      return new XMLHttpRequest();
    }

    /** Whether a pending gateway operation request can be resolved with the current response. */
    protected canResolvePendingRequest(_request: HttpProtocol.PendingOperationRequest, responseStatus: number) {
      return responseStatus === 200;
    }

    /** Whether a pending gateway operation request remains pending with the current response. */
    protected isPendingRequestPending(_request: HttpProtocol.PendingOperationRequest, _responseStatus: number) {
      return false;
    }

    /** Whether a pending gateway operation request should be rejected with the current response. */
    protected shouldRejectPendingRequest(request: HttpProtocol.PendingOperationRequest, responseStatus: number) {
      return !this.canResolvePendingRequest(request, responseStatus) && !this.isPendingRequestPending(request, responseStatus);
    }

    /** Sets application headers for a gateway operation request. */
    protected setOperationRequestHeaders(_connection: XMLHttpRequest) {
      // No default headers
    }

    /** Returns a string serialization of the parameters for a gateway operation request. */
    protected serializeParametersForOperationRequest(_operation: HttpProtocol.GatewayOperationIdentifier, ...parameters: any[]): string {
      return JSON.stringify(Array.from(parameters), Gateway.marshal);
    }

    /** Returns a deserialized gateway operation result. */
    protected deserializeOperationResult(response: string): any {
      return JSON.parse(response, Gateway.unmarshal);
    }

    /** Registers a pending gateway operation request. */
    protected registerPendingRequest(request: HttpProtocol.PendingOperationRequest) {
      if (this._pending.indexOf(request) !== -1)
        return;

      this._pending.push(request);

      if (!this._pendingInterval)
        this.setPendingInterval();
    }

    /** Registers pendingIntervalHandler. */
    protected setPendingInterval() {
      this._pendingInterval = setInterval(this.pendingIntervalHandler, 0);
    }

    /** Clears pendingIntervalHandler. */
    protected clearPendingInterval() {
      clearInterval(this._pendingInterval);
      this._pendingInterval = undefined;
    }

    /** Reports the status of a pending gateway operation request. */
    protected reportPendingRequestStatus(request: HttpProtocol.PendingOperationRequest) {
      for (const listener of this.pendingOperationRequestListeners) {
        if (!request.active)
          break;

        listener(request);
      }
    }

    /** Cleanup handler for PendingOperationRequest. */
    protected requestCleanupHandler = function(this: HttpProtocol, request: HttpProtocol.PendingOperationRequest) {
      for (; ;) {
        const i = this._pending.indexOf(request);
        if (i === -1)
          break;

        this._pending.splice(i, 1);
      }

      if (!this._pending.length)
        this.clearPendingInterval();
    }.bind(this);

    /** Pending gateway operation request interval handler. */
    protected pendingIntervalHandler = function(this: HttpProtocol) {
      const now = new Date().getTime();

      for (let i = 0; i !== this._pending.length; ++i) {
        const pending = this._pending[i];
        if ((pending.lastAttempted + pending.retryInterval) > now)
          continue;

        pending.lastAttempted = now;
        this.performGatewayOperationRequest(pending);
      }
    }.bind(this);

    /** The OpenAPI paths object for the protocol. */
    protected openAPIPaths = (): HttpProtocol.OpenAPIPaths => {
      const paths: HttpProtocol.OpenAPIPaths = {};

      this.configuration.gateways().forEach((gateway) => {
        Gateway.forEachOperation(gateway, (operation) => {
          const identifier = { gateway: this.obtainGatewayName(gateway), version: gateway.version, operation };
          const path = this.generateOpenAPIPathForOperation(identifier, undefined);
          paths[path] = this.generateOpenAPIDescriptionForOperation(identifier);
        });
      });

      return paths;
    }

    /** Constructs an http protocol. */
    constructor(configuration: Configuration) {
      super(configuration);
      this.registerGateways();
    }

    /** Generates an OpenAPI 3.0 (Swagger) description of the RESTful API that is exposed through this protocol. */
    public generateOpenAPIDescription(): HttpProtocol.OpenAPIDocument {
      return {
        openapi: "3.0.0",
        info: this.openAPIInfo(),
        paths: this.openAPIPaths(),
      };
    }

    /** Returns a name for a gateway that is unique within the scope of the protocol. */
    protected obtainGatewayName<T extends Gateway>(gateway: GatewayDefinition<T>): string {
      return gateway.name;
    }

    /** Registers the gateways for this protocol. */
    protected registerGateways() {
      this.configuration.gateways().forEach((gateway) => {
        const name = this.obtainGatewayName(gateway);
        if (this.gatewayRegistry.has(name))
          throw new IModelError(BentleyStatus.ERROR, `Gateway "${name}" is already registered within this protocol.`);

        this.gatewayRegistry.set(name, gateway);
      });
    }

    /** Generates an OpenAPI description of a gateway operation. */
    protected generateOpenAPIDescriptionForOperation(operation: HttpProtocol.GatewayOperationIdentifier): HttpProtocol.OpenAPIPathItem {
      const requestContent: HttpProtocol.OpenAPIContentMap = { "application/json": { schema: { type: "array" } } };
      const responseContent: HttpProtocol.OpenAPIContentMap = { "application/json": { schema: { type: "object" } } };

      const description: HttpProtocol.OpenAPIPathItem = {};

      description[this.supplyHttpVerbForOperation(operation)] = {
        requestBody: { content: requestContent, required: true },
        responses: {
          200: { description: "Success", content: responseContent },
          default: { description: "Error", content: responseContent },
        },
      };

      const parameters = this.supplyOpenAPIPathParametersForOperation(operation);
      if (parameters.length)
        description.parameters = parameters;

      return description;
    }
  }

  export namespace HttpProtocol {
    /** Identifies a gateway and operation. */
    export interface GatewayOperationIdentifier {
      gateway: string;
      version: string;
      operation: string;
    }

    /** A pending gateway operation request. */
    export class PendingOperationRequest {
      private _resolve: (value?: any | PromiseLike<any> | undefined) => void;
      private _reject: (reason?: any) => void;
      private _cleanup: (request: PendingOperationRequest) => void;
      private _active = true;

      /** The gateway for this request. */
      public gateway: GatewayDefinition;

      /** The operation for this request. */
      public operation: string;

      /** The parameters for this request. */
      public parameters: any[];

      /** Extended status information for this request (if available). */
      public currentStatus = "";

      /** The last connection attempt time for this request. */
      public lastAttempted = 0;

      /** The target interval (in milliseconds) between connection attempts for this request. */
      public retryInterval = 0;

      /** Reserved for application data associated with this request. */
      public applicationData?: any;

      /** Whether this request is active. */
      public get active() {
        return this._active;
      }

      /** Creates a pending request object. */
      constructor(gateway: GatewayDefinition, operation: string, parameters: any[], resolve: (value?: any | PromiseLike<any> | undefined) => void, reject: (reason?: any) => void, cleanup: (request: PendingOperationRequest) => void) {
        this.gateway = gateway;
        this.operation = operation;
        this.parameters = parameters;
        this._resolve = resolve;
        this._reject = reject;
        this._cleanup = cleanup;
      }

      /** Cancels further connection attempts for this request and rejects the underlying operation promise. */
      public cancel() {
        this.reject(new IModelError(BentleyStatus.ERROR, "Cancelled by application."));
      }

      /** Resolves this request. */
      public resolve(value: any) {
        if (!this._active)
          throw new IModelError(BentleyStatus.ERROR, "Request is not active.");

        this._active = false;
        this._cleanup(this);
        this._resolve(value);
      }

      /** Rejects this request. */
      public reject(reason: any) {
        if (!this._active)
          throw new IModelError(BentleyStatus.ERROR, "Request is not active.");

        this._active = false;
        this._cleanup(this);
        this._reject(reason);
      }
    }

    /** Receives status information regarding pending gateway operation requests. */
    export type PendingOperationRequestListener = (request: HttpProtocol.PendingOperationRequest) => void;

    /** An OpenAPI 3.0 root document object. */
    export interface OpenAPIDocument {
      openapi: "3.0.0";
      info: OpenAPIInfo;
      paths: OpenAPIPaths;
    }

    /** An OpenAPI 3.0 info object. */
    export interface OpenAPIInfo {
      title: string;
      version: string;
    }

    /** An OpenAPI 3.0 paths object. */
    export interface OpenAPIPaths {
      [index: string]: OpenAPIPathItem;
    }

    /** An OpenAPI 3.0 path item object. */
    export interface OpenAPIPathItem {
      summary?: string;
      get?: OpenAPIOperation;
      put?: OpenAPIOperation;
      post?: OpenAPIOperation;
      delete?: OpenAPIOperation;
      options?: OpenAPIOperation;
      head?: OpenAPIOperation;
      patch?: OpenAPIOperation;
      trace?: OpenAPIOperation;
      parameters?: OpenAPIParameter[];
    }

    /** An OpenAPI 3.0 operation object. */
    export interface OpenAPIOperation {
      summary?: string;
      operationId?: string;
      parameters?: OpenAPIParameter[];
      requestBody?: OpenAPIRequestBody;
      responses: OpenAPIResponses;
    }

    /** An OpenAPI 3.0 content map. */
    export interface OpenAPIContentMap {
      [index: string]: OpenAPIMediaType;
    }

    /** An OpenAPI 3.0 parameter object. */
    export interface OpenAPIParameter {
      name: string;
      in: "query" | "header" | "path" | "cookie";
      description?: string;
      required?: boolean;
      allowEmptyValue?: boolean;
      style?: "matrix" | "label" | "form" | "simple" | "spaceDelimited" | "pipeDelimited" | "deepObject";
      explode?: boolean;
      allowReserved?: boolean;
      schema?: OpenAPISchema;
      content?: OpenAPIContentMap;
    }

    /** An OpenAPI 3.0 media type object. */
    export interface OpenAPIMediaType {
      schema?: OpenAPISchema;
    }

    /** An OpenAPI 3.0 schema object. */
    export interface OpenAPISchema {
      type?: "boolean" | "object" | "array" | "number" | "string";
      nullable?: boolean;
      description?: string;
    }

    /** An OpenAPI 3.0 encoding object. */
    export interface OpenAPIEncoding {
      contentType?: string;
      style?: string;
      explode?: boolean;
      allowReserved?: boolean;
    }

    /** An OpenAPI 3.0 parameter object. */
    export interface OpenAPIRequestBody {
      description?: string;
      content: OpenAPIContentMap;
      required?: boolean;
    }

    /** An OpenAPI 3.0 responses object. */
    export interface OpenAPIResponses {
      default?: OpenAPIResponse;
      "200"?: OpenAPIResponse;
      "301"?: OpenAPIResponse;
      "302"?: OpenAPIResponse;
      "400"?: OpenAPIResponse;
      "404"?: OpenAPIResponse;
      "500"?: OpenAPIResponse;
    }

    /** An OpenAPI 3.0 response object. */
    export interface OpenAPIResponse {
      description: string;
      content?: { [index: string]: OpenAPIMediaType };
    }

    /** A gateway operation request. */
    export class OperationRequest {
      /** The parameters of the operation request. */
      public parameters: any[];

      /** Creates an operation request. */
      constructor(...parameters: any[]) {
        this.parameters = parameters;
      }

      /** Finds the first parameter of a given type if present. */
      public findParameterOfType<T>(constructor: { new(): T }): T | undefined {
        for (const param of this.parameters) {
          if (param instanceof constructor)
            return param;
        }

        return undefined;
      }
    }
  }

  /** IPC within an Electron application. */
  export abstract class ElectronProtocol extends Protocol {

  }

  /** Direct function call protocol within a single JavaScript context (suitable for testing). */
  export class DirectProtocol extends Protocol {
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

  export namespace Configuration {
    /** A default gateway configuration (suitable for testing). */
    export class Default extends Configuration {
      public gateways = () => [];
      public protocol: Protocol = new DirectProtocol(this);
    }
  }
}
