/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../../RpcInterface";
import { RpcProtocolEvent, SerializedRpcRequest } from "../core/RpcProtocol";
import { RpcRequest } from "../core/RpcRequest";
import { WebAppRpcProtocol, HttpServerRequest } from "./WebAppRpcProtocol";

export type HttpMethod_T = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";

export class WebAppRpcRequest extends RpcRequest {
  private _loading: boolean = false;

  /** The underlying HTTP request object. */
  public connection: XMLHttpRequest | undefined;

  /** The URI path component for this request. */
  public path: string;

  /** The HTTP method for this request. */
  public method: HttpMethod_T;

  /** Convenience access to the protocol of this request. */
  public readonly protocol: WebAppRpcProtocol = this.client.configuration.protocol as any;

  /** Deserializes a request. */
  public static deserialize(protocol: WebAppRpcProtocol, req: HttpServerRequest): SerializedRpcRequest {
    const operation = protocol.getOperationFromPath(req.path);

    const id = req.header(protocol.requestIdHeaderName);
    if (!id)
      throw new IModelError(BentleyStatus.ERROR, `Invalid request.`);

    const authorization = req.header(protocol.authorizationHeaderName) || "";

    return {
      id,
      authorization,
      operation: {
        interfaceDefinition: operation.interfaceDefinition,
        operationName: operation.operationName,
        interfaceVersion: operation.interfaceVersion,
      },
      method: req.method,
      path: req.path,
      parameters: req.body,
    };
  }

  /** Constructs a web application request. */
  public constructor(client: RpcInterface, operation: string, parameters: any[]) {
    super(client, operation, parameters);
    this.path = this.protocol.supplyPathForOperation(this.operation, this);
    this.method = this.protocol.supplyMethodForOperation(this.operation);
  }

  /** Initializes the request communication channel. */
  protected initializeChannel(): void {
    if (this._loading)
      throw new IModelError(BentleyStatus.ERROR, `Loading in progress.`);

    this.connection = this.protocol.supplyConnectionForRequest();
    this.connection.open(this.method, this.path, true);

    this.connection.addEventListener("load", () => {
      if (!this._loading)
        return;

      if (this.connection!.readyState === 4) {
        this._loading = false;
        this.setLastUpdatedTime();
        this.protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, this);
      } else {
        this.protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoading, this);
      }
    });

    this.connection.addEventListener("error", () => {
      if (!this._loading)
        return;

      this._loading = false;
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionErrorReceived, this);
    });

    this.connection.addEventListener("abort", () => {
      if (!this._loading)
        return;

      this._loading = false;
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionAborted, this);
    });
  }

  /** Sets request header values. */
  protected setHeader(name: string, value: string): void {
    this.connection!.setRequestHeader(name, value);
  }

  /** Sends the request. */
  protected send(): void {
    this._loading = true;
    this.connection!.send(this.protocol.serialize(this).parameters);
  }

  /** Supplies response status code. */
  public getResponseStatusCode(): number {
    return this.connection!.status;
  }

  /** Supplies response text. */
  public getResponseText(): string {
    return this.connection!.responseText;
  }
}
