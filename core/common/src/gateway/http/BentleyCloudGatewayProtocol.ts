/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { GatewayHttpProtocol } from "./GatewayHttpProtocol";
import { OpenAPIParameter } from "./OpenAPI";
import { SerializedGatewayOperation } from "../core/GatewayProtocol";
import { GatewayOperation } from "../core/GatewayOperation";
import { GatewayRequest } from "../core/GatewayRequest";
import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { Logger } from "@bentley/bentleyjs-core";

/** An http protocol for Bentley cloud gateway deployments. */
export abstract class BentleyCloudGatewayProtocol extends GatewayHttpProtocol {
  /** The name of the HTTP request header  */
  public requestIdHeaderName = "X-CorrelationId";

  /** Returns the operation specified by an OpenAPI-compatible URI path. */
  public getOperationFromPath(path: string): SerializedGatewayOperation {
    const components = path.split("/");
    const operationComponent = components.slice(-1)[0];
    const [gateway, version, name] = operationComponent.split("-");
    return { gateway, name, version };
  }

  /** Supplies the OpenAPI-compatible URI path for a gateway operation. */
  public supplyPathForOperation(operation: GatewayOperation, request: GatewayRequest | undefined) {
    const prefix = this.pathPrefix;
    const appTitle = this.info.title;
    const appVersion = this.info.version;
    const operationId = `${operation.gateway.name}-${operation.version}-${operation.name}`;

    let appMode: string;
    let contextId: string;
    let iModelId: string;
    let changeSetId: string;

    if (request === undefined) {
      appMode = "{modeId}";
      contextId = "{contextId}";
      iModelId = "{iModelId}";
      changeSetId = "{changeSetId}";
    } else {
      const token = operation.policy.token(request);
      if (!token || !token.contextId || !token.iModelId) {
        throw new IModelError(BentleyStatus.ERROR, "Invalid iModelToken for gateway operation request", Logger.logError, "imodeljs-frontend.BentleyCloudGatewayProtocol");
      }

      appMode = "1"; // WIP: need to determine appMode from iModelToken - hard-coded to 1 which means "milestone review" for now...
      contextId = encodeURIComponent(token.contextId);
      iModelId = encodeURIComponent(token.iModelId);
      changeSetId = token.changeSetId ? encodeURIComponent(token.changeSetId) : "0"; // if changeSetId not provided, use 0 to indicate initial iModel state (before any changeSets)
    }

    // WIP: if appMode === 2 (WorkGroupEdit) then changeset should not be included
    return `${prefix}/${appTitle}/${appVersion}/mode/${appMode}/context/${contextId}/imodel/${iModelId}/changeset/${changeSetId}/${operationId}`;
  }

  /** Returns the OpenAPI-compatible URI path parameters for a gateway operation. */
  public supplyPathParametersForOperation(_operation: GatewayOperation): OpenAPIParameter[] {
    return [
      { name: "modeId", in: "path", required: true, schema: { type: "string" } },
      { name: "contextId", in: "path", required: true, schema: { type: "string" } },
      { name: "iModelId", in: "path", required: true, schema: { type: "string" } },
      { name: "changeSetId", in: "path", required: false, schema: { type: "string" } },
    ];
  }
}
