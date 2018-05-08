/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcOperation } from "../core/RpcOperation";
import { WebAppRpcProtocol } from "./WebAppRpcProtocol";

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

/** An OpenAPI-compatible description of an RPC protocol. */
export class RpcOpenAPIDescription {
  /** The protocol for this description. */
  public readonly protocol: WebAppRpcProtocol;

  /** The OpenAPI paths object for the protocol. */
  public get paths(): OpenAPIPaths {
    const paths: OpenAPIPaths = {};

    this.protocol.configuration.interfaces().forEach((definition) => {
      RpcOperation.forEach(definition, (operation) => {
        const path = this.protocol.supplyPathForOperation(operation, undefined);
        paths[path] = this.generateDescription(operation);
      });
    });

    return paths;
  }

  /** An OpenAPI 3.0 (Swagger) description of the RESTful API that is exposed through the protocol. */
  public get document(): OpenAPIDocument {
    return {
      openapi: "3.0.0",
      info: this.protocol.info,
      paths: this.paths,
    };
  }

  /** Creates an OpenAPI description of an RPC protocol. */
  public constructor(protocol: WebAppRpcProtocol) {
    this.protocol = protocol;
  }

  /** Converts to JSON. */
  public toJSON() {
    return this.document;
  }

  private generateDescription(operation: RpcOperation): OpenAPIPathItem {
    const requestContent: OpenAPIContentMap = { "application/json": { schema: { type: "array" } } };
    const responseContent: OpenAPIContentMap = { "application/json": { schema: { type: "object" } } };

    const description: OpenAPIPathItem = {};

    description[this.protocol.supplyMethodForOperation(operation)] = {
      requestBody: { content: requestContent, required: true },
      responses: {
        200: { description: "Success", content: responseContent },
        default: { description: "Error", content: responseContent },
      },
    };

    const parameters = this.protocol.supplyPathParametersForOperation(operation);
    if (parameters.length)
      description.parameters = parameters;

    return description;
  }
}
