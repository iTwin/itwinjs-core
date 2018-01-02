/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "../common/IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { Gateway } from "../common/Gateway";
import { IModelToken } from "../common/IModel";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";

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
    const method = "post";
    const path = req.path;

    try {
      Logger.logInfo("BentleyCloudGatewayProtocol.backend.request", () => ({ method, path }));
      const operationIdentifier = this.getOperationFromOpenAPIPath(path);
      const operationParameters = this.deserializeOperationRequestParameters(req.body, path);
      const operationResult = await this.lookupGatewayImplementation(operationIdentifier).invoke(operationIdentifier.operation, ...operationParameters);
      const operationResponse = this.serializeOperationResult(operationIdentifier, operationResult);
      const status = 200;
      Logger.logInfo("BentleyCloudGatewayProtocol.backend.response", () => ({ method, path, status }));
      res.status(status).send(operationResponse);
    } catch (e) {
      const status = 500;
      Logger.logInfo("BentleyCloudGatewayProtocol.backend.error", () => ({ method, path, status }));
      res.status(status).send(e.toString());
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
    if (components.length !== 12)
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

  /** Whether a pending gateway operation request remains pending with the current response. */
  protected isPendingRequestPending(_request: Gateway.HttpProtocol.PendingOperationRequest, responseStatus: number) {
    return responseStatus === 202;
  }
}
