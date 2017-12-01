/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "../common/IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { Gateway } from "../common/Gateway";
import { IModelToken } from "../common/IModel";

/** An http server request object. */
export interface HttpServerRequest {
  body: any;
  path: any;
}

/** An http server response object. */
export interface HttpServerResponse {
  send(body?: any): HttpServerResponse;
  status(code: number): HttpServerResponse;
}

/** An http protocol for Bentley cloud gateway deployments. */
export abstract class BentleyCloudGatewayProtocol extends Gateway.HttpProtocol {
  /** An optional prefix for gateway operation paths. */
  public openAPIPathPrefix = () => "";

  /** Handles a gateway operation post request for an http server. */
  public async handleOperationPostRequest(req: HttpServerRequest, res: HttpServerResponse) {
    try {
      const operationIdentifier = this.getOperationFromOpenAPIPath(req.path);
      const operationParameters = this.deserializeOperationRequestParameters(req.body, req.path);
      const operationResult = await this.lookupGatewayImplementation(operationIdentifier).invoke(operationIdentifier.operation, ...operationParameters);
      res.send(this.serializeOperationResult(operationResult));
    } catch (e) {
      res.status(500).send(e.toString());
    }
  }

  /** Handles an OpenAPI description request for an http server. */
  public handleOpenApiDescriptionRequest(_req: HttpServerRequest, res: HttpServerResponse) {
    const description = this.generateOpenAPIDescription();
    res.send(JSON.stringify(description));
  }

  /** Returns the operation specified by an OpenAPI gateway path. */
  public getOperationFromOpenAPIPath(path: string): Gateway.HttpProtocol.GatewayOperationIdentifier {
    const components = path.split("/");
    if (components.length !== 11)
      throw new IModelError(BentleyStatus.ERROR, "Invalid path.");

    const [gateway, version, operation] = components.slice(-3);
    return { gateway, version, operation };
  }

  /** Generates an OpenAPI path for a gateway operation. */
  protected generateOpenAPIPathForOperation(operation: Gateway.HttpProtocol.GatewayOperationIdentifier, request: Gateway.HttpProtocol.OperationRequest | undefined) {
    const prefix = this.openAPIPathPrefix();
    const info = this.openAPIInfo();

    const token = request ? request.findParameterOfType(IModelToken) : undefined;
    const contextId = (token && token.contextId) ? encodeURIComponent(token.contextId) : "{contextId}";
    const iModelId = (token && token.iModelId) ? encodeURIComponent(token.iModelId) : "{iModelId}";
    const versionId = (token && token.changeSetId) ? encodeURIComponent(token.changeSetId) : "{versionId}";

    return `${prefix}/${info.title}/${info.version}/Context/${contextId}/iModel/${iModelId}/Version/${versionId}/${operation.gateway}/${operation.version}/${operation.operation}`;
  }

  /** Returns the OpenAPI path parameters for a gateway operation. */
  protected supplyOpenAPIPathParametersForOperation(_identifier: Gateway.HttpProtocol.GatewayOperationIdentifier): Gateway.HttpProtocol.OpenAPIParameter[] {
    return [
      { name: "contextId", in: "path", required: true, schema: { type: "string" } },
      { name: "iModelId", in: "path", required: true, schema: { type: "string" } },
      { name: "versionId", in: "path", required: true, schema: { type: "string" } },
    ];
  }

  /** Sets application headers for a gateway operation request. */
  protected setOperationRequestHeaders(connection: XMLHttpRequest) {
    connection.setRequestHeader(this.configuration.applicationAuthorizationKey, this.configuration.applicationAuthorizationValue);
  }
}
