/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { IModelRpcProps } from "../../IModel";
import { IModelError } from "../../IModelError";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { RpcOperation } from "../core/RpcOperation";
import { SerializedRpcOperation, SerializedRpcRequest } from "../core/RpcProtocol";
import { RpcRequest } from "../core/RpcRequest";
import { OpenAPIParameter } from "./OpenAPI";
import { WebAppRpcProtocol } from "./WebAppRpcProtocol";
import { SerializedRpcActivity } from "../core/RpcInvocation";

enum AppMode {
  MilestoneReview = "1",
}

/** An http protocol for Bentley cloud RPC interface deployments.
 * @internal
 */
export abstract class BentleyCloudRpcProtocol extends WebAppRpcProtocol {
  public override checkToken = true;

  /** The name of various HTTP request headers based on client's request context */
  public override serializedClientRequestContextHeaderNames: SerializedRpcActivity = {
    /** The name of the HTTP request id header. */
    id: "X-Correlation-Id",

    /** The name of the HTTP application id header. */
    applicationId: "X-Application-Id",

    /** The name of the HTTP application version header. */
    applicationVersion: "X-Application-Version",

    /** The name of the HTTP session id header. */
    sessionId: "X-Session-Id",

    /** The name of the HTTP authorization header. */
    authorization: "Authorization",
  };

  /** The name of the RPC protocol version header. */
  public override protocolVersionHeaderName = "X-Protocol-Version";

  /** Returns the operation specified by an OpenAPI-compatible URI path. */
  public override getOperationFromPath(path: string): SerializedRpcOperation {
    const url = new URL(path, "https://localhost/");
    const components = url.pathname.split("/").filter((x) => x); // filter out empty segments

    const operationComponent = components.slice(-1)[0];
    const encodedRequest = url.searchParams.get("parameters") || "";

    // The encodedRequest should be base64 - fail now if any other characters detected.
    if (/[^a-zA-Z0-9=+\/$]/.test(encodedRequest))
      throw new IModelError(BentleyStatus.ERROR, `Invalid request: Malformed URL parameters detected.`);

    const firstHyphen = operationComponent.indexOf("-");
    const lastHyphen = operationComponent.lastIndexOf("-");
    const interfaceDefinition = operationComponent.slice(0, firstHyphen);
    const interfaceVersion = operationComponent.slice(firstHyphen + 1, lastHyphen);
    const operationName = operationComponent.slice(lastHyphen + 1);

    return { interfaceDefinition, operationName, interfaceVersion, encodedRequest };
  }

  /** Supplies the OpenAPI-compatible URI path for an RPC operation. */
  public override supplyPathForOperation(operation: RpcOperation, request: RpcRequest | undefined) {
    const prefix = this.pathPrefix;
    const appTitle = this.info.title;
    const appVersion = this.info.version;
    const operationId = `${operation.interfaceDefinition.interfaceName}-${operation.interfaceVersion}-${operation.operationName}`;

    let appMode: string = "";
    let iTwinId: string = "";
    let iModelId: string = "";
    let routeChangesetId: string | undefined;
    /* Note: The changesetId field is omitted in the route in the case of ReadWrite connections since the connection is generally expected to be at the
     * latest version and not some specific changeset. Also, for the first version (before any changesets), the changesetId in the route is arbitrarily
     * set to "0" instead of an empty string, since the latter is more un-intuitive for a route. However, in all other use cases, including the changesetId
     * held by the IModelRpcProps itself, the changesetId of "" (i.e., empty string) signifies the first version - this is more intuitive and retains
     * compatibility with the majority of use cases. */

    if (request === undefined) {
      appMode = "{modeId}";
      iTwinId = "{iTwinId}";
      iModelId = "{iModelId}";
      routeChangesetId = "{changeSetId}";
    } else {
      let token = operation.policy.token(request) || RpcOperation.fallbackToken;

      if (!token || !token.iModelId) {
        if (RpcConfiguration.disableRoutingValidation) {
          token = { key: "" };
        } else {
          throw new IModelError(BentleyStatus.ERROR, "Invalid iModelToken for RPC operation request");
        }
      }

      iTwinId = encodeURIComponent(token.iTwinId || "");
      iModelId = encodeURIComponent(token.iModelId!);

      routeChangesetId = token.changeset?.id || "0";
      appMode = AppMode.MilestoneReview;
    }

    return `${prefix}/${appTitle}/${appVersion}/mode/${appMode}/context/${iTwinId}/imodel/${iModelId}${!!routeChangesetId ? `/changeset/${routeChangesetId}` : ""}/${operationId}`;
  }

  /**
   * Inflates the IModelRpcProps from the URL path for each request on the backend.
   * @note This function updates the IModelRpcProps value supplied in the request body.
   */
  public override inflateToken(tokenFromBody: IModelRpcProps, request: SerializedRpcRequest): IModelRpcProps {
    const urlPathComponents = request.path.split("/");

    let iModelId = tokenFromBody.iModelId;
    let iTwinId = tokenFromBody.iTwinId;
    const changeset = { id: tokenFromBody.changeset?.id ?? "0", index: tokenFromBody.changeset?.index };

    for (let i = 0; i <= urlPathComponents.length; ++i) {
      const key = urlPathComponents[i];
      const value = urlPathComponents[i + 1];
      if (key === "mode") {
        ++i;
      } else if (key === "context") {
        iTwinId = value;
        ++i;
      } else if (key === "imodel") {
        iModelId = value;
        ++i;
      } else if (key === "changeset") {
        changeset.id = (value === "0") ? "" : value;
        ++i;
      }
    }

    // Overwrite the key if it includes a : because its most likely a guid. We know what it should be based off of the url.
    // Leave it alone if its a non guid key.
    return { key: tokenFromBody.key === undefined || tokenFromBody.key.includes(":") ? `${iModelId}:${changeset.id}` : tokenFromBody.key, iTwinId, iModelId, changeset };
  }

  /** Returns the OpenAPI-compatible URI path parameters for an RPC operation.
   * @internal
   */
  public supplyPathParametersForOperation(_operation: RpcOperation): OpenAPIParameter[] {
    return [
      { name: "modeId", in: "path", required: true, schema: { type: "string" } },
      { name: "iTwinId", in: "path", required: true, schema: { type: "string" } },
      { name: "iModelId", in: "path", required: true, schema: { type: "string" } },
      { name: "changeSetId", in: "path", required: false, schema: { type: "string" } },
    ];
  }
}
