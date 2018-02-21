/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayDefinition } from "../common/Gateway";
import { GatewayProtocol } from "./GatewayProtocol";
import { GatewayConfiguration } from "./GatewayConfiguration";
import { ServerError } from "../common/IModelError";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";

const loggingCategory = "imodeljs-gateway.GatewayHttpProtocol";
// tslint:disable:space-before-function-paren

/** The HTTP application protocol. */
export abstract class GatewayHttpProtocol extends GatewayProtocol {
  private _pending: GatewayHttpProtocol.PendingOperationRequest[] = [];
  protected _pendingInterval: any = undefined;

  /** Listeners for status information regarding pending gateway operation requests. */
  public pendingOperationRequestListeners: GatewayHttpProtocol.PendingOperationRequestListener[] = [];

  /** Associates the gateways for the protocol with unique names. */
  protected gatewayRegistry: Map<string, GatewayDefinition> = new Map();

  /** Returns the registered backend implementation for a gateway operation. */
  public lookupGatewayImplementation(operation: GatewayHttpProtocol.GatewayOperationIdentifier): Gateway {
    const gateway = this.gatewayRegistry.get(operation.gateway) as GatewayDefinition;
    return Gateway.getImplementationForGateway(gateway);
  }

  /** Returns the operation specified by an OpenAPI gateway path. */
  public abstract getOperationFromOpenAPIPath(path: string): GatewayHttpProtocol.GatewayOperationIdentifier;

  /** Returns deserialized gateway operation request parameters. */
  public deserializeOperationRequestParameters(request: string, _path: string): any[] {
    return this.deserializeOperationValue(request);
  }

  /** Returns a serialized gateway operation result. */
  public serializeOperationResult(operation: GatewayHttpProtocol.GatewayOperationIdentifier, result: any): string {
    return this.serializeOperationValue(operation.gateway, result);
  }

  /** The OpenAPI info object for the protocol. */
  protected abstract openAPIInfo: () => GatewayHttpProtocol.OpenAPIInfo;

  /** Generates an OpenAPI path for a gateway operation. */
  protected abstract generateOpenAPIPathForOperation(operation: GatewayHttpProtocol.GatewayOperationIdentifier, request: GatewayHttpProtocol.OperationRequest | undefined): string;

  /** Returns the HTTP verb for a gateway operation. */
  protected supplyHttpVerbForOperation(_identifier: GatewayHttpProtocol.GatewayOperationIdentifier): "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace" {
    return "post";
  }

  /** Returns the OpenAPI path parameters for a gateway operation. */
  protected supplyOpenAPIPathParametersForOperation(_identifier: GatewayHttpProtocol.GatewayOperationIdentifier): GatewayHttpProtocol.OpenAPIParameter[] {
    return [];
  }

  /** Obtains the implementation result for a gateway operation. */
  public obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request = new GatewayHttpProtocol.PendingOperationRequest(gateway, operation, parameters, resolve, reject, this.requestCleanupHandler);
      request.retryInterval = this.configuration.pendingOperationRetryInterval;

      this.reportPendingRequestStatus(request);

      if (request.active) {
        request.lastAttempted = new Date().getTime();
        this.performGatewayOperationRequest(request);
      }
    });
  }

  /** Performs a request for a gateway operation. */
  protected performGatewayOperationRequest(request: GatewayHttpProtocol.PendingOperationRequest) {
    try {
      const identifier = {
        gateway: this.obtainGatewayName(request.gateway),
        version: request.gateway.version,
        operation: request.operation,
      };

      const path = this.generateOpenAPIPathForOperation(identifier, new GatewayHttpProtocol.OperationRequest(...request.parameters));
      const connection = this.generateConnectionForOperationRequest();
      const method = this.supplyHttpVerbForOperation(identifier);
      connection.open(method, path, true);
      Logger.logTrace(loggingCategory, "Gateway.frontend.request", () => ({ method, path }));

      connection.addEventListener("load", () => {
        if (!request.active)
          return;

        const status = connection.status;
        Logger.logTrace(loggingCategory, "Gateway.frontend.response", () => ({ method, path, status }));

        if (this.canResolvePendingRequest(request, status)) {
          const result = this.deserializeOperationResult(connection.responseText);
          request.resolve(result);
        } else if (this.isPendingRequestPending(request, status)) {
          this.registerPendingRequest(request);
          request.currentStatus = connection.responseText;
          this.reportPendingRequestStatus(request);
        } else if (this.shouldRejectPendingRequest(request, status)) {
          const error = new ServerError(status, connection.responseText);
          request.reject(error);
        } else {
          throw new ServerError(status, "Unhandled response.");
        }
      });

      connection.addEventListener("error", () => {
        if (!request.active)
          return;

        Logger.logInfo(loggingCategory, "Gateway.frontend.connectionError", () => ({ method, path }));
        request.reject(new ServerError(-1, "Connection error."));
      });

      connection.addEventListener("abort", () => {
        if (!request.active)
          return;

        Logger.logInfo(loggingCategory, "Gateway.frontend.connectionAborted", () => ({ method, path }));
        request.reject(new ServerError(-1, "Connection aborted."));
      });

      this.setOperationRequestHeaders(connection);

      const payload = this.serializeParametersForOperationRequest(identifier, ...request.parameters);
      connection.send(payload);
    } catch (e) {
      if (!request.active)
        return;

      request.reject(e);
    }
  }

  /** Returns an XMLHttpRequest instance for a gateway operation request. */
  protected generateConnectionForOperationRequest(): XMLHttpRequest {
    return new XMLHttpRequest();
  }

  /** Whether a pending gateway operation request can be resolved with the current response. */
  protected canResolvePendingRequest(_request: GatewayHttpProtocol.PendingOperationRequest, responseStatus: number) {
    return responseStatus === 200;
  }

  /** Whether a pending gateway operation request remains pending with the current response. */
  protected isPendingRequestPending(_request: GatewayHttpProtocol.PendingOperationRequest, _responseStatus: number) {
    return false;
  }

  /** Whether a pending gateway operation request should be rejected with the current response. */
  protected shouldRejectPendingRequest(request: GatewayHttpProtocol.PendingOperationRequest, responseStatus: number) {
    return !this.canResolvePendingRequest(request, responseStatus) && !this.isPendingRequestPending(request, responseStatus);
  }

  /** Sets application headers for a gateway operation request. */
  protected setOperationRequestHeaders(_connection: XMLHttpRequest) {
    // No default headers
  }

  /** Returns a string serialization of the parameters for a gateway operation request. */
  protected serializeParametersForOperationRequest(operation: GatewayHttpProtocol.GatewayOperationIdentifier, ...parameters: any[]): string {
    return this.serializeOperationValue(operation.gateway, Array.from(parameters));
  }

  /** Returns a deserialized gateway operation result. */
  protected deserializeOperationResult(response: string): any {
    return this.deserializeOperationValue(response);
  }

  /** Registers a pending gateway operation request. */
  protected registerPendingRequest(request: GatewayHttpProtocol.PendingOperationRequest) {
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
  protected reportPendingRequestStatus(request: GatewayHttpProtocol.PendingOperationRequest) {
    for (const listener of this.pendingOperationRequestListeners) {
      if (!request.active)
        break;

      listener(request);
    }
  }

  /** Cleanup handler for PendingOperationRequest. */
  protected requestCleanupHandler = function (this: GatewayHttpProtocol, request: GatewayHttpProtocol.PendingOperationRequest) {
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
  protected pendingIntervalHandler = function (this: GatewayHttpProtocol) {
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
  protected openAPIPaths = (): GatewayHttpProtocol.OpenAPIPaths => {
    const paths: GatewayHttpProtocol.OpenAPIPaths = {};

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
  constructor(configuration: GatewayConfiguration) {
    super(configuration);
    this.registerGateways();
  }

  /** Generates an OpenAPI 3.0 (Swagger) description of the RESTful API that is exposed through this protocol. */
  public generateOpenAPIDescription(): GatewayHttpProtocol.OpenAPIDocument {
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
        throw new ServerError(-1, `Gateway "${name}" is already registered within this protocol.`);

      this.gatewayRegistry.set(name, gateway);
    });
  }

  /** Generates an OpenAPI description of a gateway operation. */
  protected generateOpenAPIDescriptionForOperation(operation: GatewayHttpProtocol.GatewayOperationIdentifier): GatewayHttpProtocol.OpenAPIPathItem {
    const requestContent: GatewayHttpProtocol.OpenAPIContentMap = { "application/json": { schema: { type: "array" } } };
    const responseContent: GatewayHttpProtocol.OpenAPIContentMap = { "application/json": { schema: { type: "object" } } };

    const description: GatewayHttpProtocol.OpenAPIPathItem = {};

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

export namespace GatewayHttpProtocol {
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
      this.reject(new ServerError(-1, "Cancelled by application."));
    }

    /** Resolves this request. */
    public resolve(value: any) {
      if (!this._active)
        throw new ServerError(-1, "Request is not active.");

      this._active = false;
      this._cleanup(this);
      this._resolve(value);
    }

    /** Rejects this request. */
    public reject(reason: any) {
      if (!this._active)
        throw new ServerError(-1, "Request is not active.");

      this._active = false;
      this._cleanup(this);
      this._reject(reason);
    }
  }

  /** Receives status information regarding pending gateway operation requests. */
  export type PendingOperationRequestListener = (request: GatewayHttpProtocol.PendingOperationRequest) => void;

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
    public findParameterOfType<T>(constructor: { new(...args: any[]): T }): T | undefined {
      for (const param of this.parameters) {
        if (param instanceof constructor)
          return param;
      }

      return undefined;
    }
  }
}
