/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayHttpProtocol } from "./GatewayHttpProtocol";
import { IModelToken } from "../common/IModel";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";

const loggingCategory = "imodeljs-backend.BentleyCloudGatewayProtocol";

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
export abstract class BentleyCloudGatewayProtocol extends GatewayHttpProtocol {
  /** An optional prefix for gateway operation paths. */
  public openAPIPathPrefix = () => "";

  /** Handles a gateway operation post request for an http server. */
  public async handleOperationPostRequest(req: HttpServerRequest, res: HttpServerResponse) {
    const method = "post";
    const path = req.path;

    try {
      Logger.logTrace(loggingCategory, "BentleyCloudGatewayProtocol.backend.request", () => ({ method, path }));
      const operationIdentifier = this.getOperationFromOpenAPIPath(path);
      const operationParameters = this.deserializeOperationRequestParameters(req.body, path);
      const operationResult = await this.lookupGatewayImplementation(operationIdentifier).invoke(operationIdentifier.operation, ...operationParameters);
      const operationResponse = this.serializeOperationResult(operationIdentifier, operationResult);
      const status = 200;
      Logger.logTrace(loggingCategory, "BentleyCloudGatewayProtocol.backend.response", () => ({ method, path, status }));
      res.status(status).send(operationResponse);
    } catch (error) {
      const status = 500;
      Logger.logInfo(loggingCategory, "BentleyCloudGatewayProtocol.backend.error", () => ({ method, path, status, error }));
      const errstr = (error instanceof Error) ? `${error.toString()} ${error.stack}`
                   : error.hasOwnMember("message") ? error.message
                   : JSON.stringify(error);
      res.status(status).send(errstr);
    }
  }

  /** Handles an OpenAPI description request for an http server. */
  public handleOpenApiDescriptionRequest(_req: HttpServerRequest, res: HttpServerResponse) {
    const description = this.generateOpenAPIDescription();
    res.send(JSON.stringify(description));
  }

  /** Returns the operation specified by an OpenAPI gateway path. */
  public getOperationFromOpenAPIPath(path: string): GatewayHttpProtocol.GatewayOperationIdentifier {
    const components = path.split("/");
    const operationComponent: string = components.slice(-1)[0];
    const [gateway, version, operation] = operationComponent.split("-");
    return { gateway, version, operation };
  }

  /** Generates an OpenAPI path for a gateway operation. */
  protected generateOpenAPIPathForOperation(operation: GatewayHttpProtocol.GatewayOperationIdentifier, request: GatewayHttpProtocol.OperationRequest | undefined) {
    const prefix = this.openAPIPathPrefix();
    const appInfo = this.openAPIInfo();
    const appMode = 1; // WIP: need to determine appMode from iModelToken - hard-coded to 1 which means "milestone review" for now...

    const token = request ? request.findParameterOfType(IModelToken) : undefined;
    const contextId = (token && token.contextId) ? encodeURIComponent(token.contextId) : "{contextId}";
    const iModelId = (token && token.iModelId) ? encodeURIComponent(token.iModelId) : "{iModelId}";
    const changeSetId = (token && token.changeSetId) ? encodeURIComponent(token.changeSetId) : "{changeSetId}";

    // WIP: if appMode === 2 (WorkGroupEdit) then changeset should not be included
    return `${prefix}/${appInfo.title}/${appInfo.version}/mode/${appMode}/context/${contextId}/imodel/${iModelId}/changeset/${changeSetId}/${operation.gateway}-${operation.version}-${operation.operation}`;
  }

  /** Returns the OpenAPI path parameters for a gateway operation. */
  protected supplyOpenAPIPathParametersForOperation(_identifier: GatewayHttpProtocol.GatewayOperationIdentifier): GatewayHttpProtocol.OpenAPIParameter[] {
    return [
      { name: "modeId", in: "path", required: true, schema: { type: "string" } },
      { name: "contextId", in: "path", required: true, schema: { type: "string" } },
      { name: "iModelId", in: "path", required: true, schema: { type: "string" } },
      { name: "changeSetId", in: "path", required: false, schema: { type: "string" } },
    ];
  }

  /** Sets application headers for a gateway operation request. */
  protected setOperationRequestHeaders(connection: XMLHttpRequest) {
    connection.setRequestHeader(this.configuration.applicationAuthorizationKey, this.configuration.applicationAuthorizationValue);
  }

  /** Whether a pending gateway operation request remains pending with the current response. */
  protected isPendingRequestPending(_request: GatewayHttpProtocol.PendingOperationRequest, responseStatus: number) {
    return responseStatus === 202;
  }
}
