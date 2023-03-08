/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { RpcRequestEvent } from "../core/RpcConstants";
import { RpcRequest, RpcRequestEventHandler } from "../core/RpcRequest";
import { BentleyCloudRpcProtocol } from "./BentleyCloudRpcProtocol";
import { OpenAPIInfo } from "./OpenAPI";
import { RpcRoutingToken } from "../core/RpcRoutingToken";

/* eslint-disable deprecation/deprecation */

/** Initialization parameters for BentleyCloudRpcConfiguration.
 * @public
 */
export interface BentleyCloudRpcParams {
  /** Identifies the remote server that implements a set of RpcInterfaces. Note that the ID of the remote server is not a URI or hostname. It is a string that matches a key in the orchestrator's app registry. */
  info: OpenAPIInfo;
  /** The URI of the orchestrator that will route requests to the remote RpcInterface server. If not supplied, this default to the origin of the Web page. This is required only when calling initializeClient and only if the server is not the origin of the Web page. */
  uriPrefix?: string;
}

/** Internal initialization parameters for BentleyCloudRpcConfiguration.
 * @internal
 */
export interface BentleyCloudRpcInternalParams extends BentleyCloudRpcParams {
  /** The protocol for Bentley cloud RPC interface deployments */
  protocol?: typeof BentleyCloudRpcProtocol;
  /** Handler for RPC request events. */
  pendingRequestListener?: RpcRequestEventHandler;
}

/** Holds initialization parameters for BentleyCloudRpcConfiguration.
 * @public
 */
export class BentleyCloudRpcParamsHolder {
  /** @internal */
  public params: BentleyCloudRpcInternalParams;

  /** @internal */
  constructor(params: BentleyCloudRpcInternalParams) {
    this.params = params;
  }
}

/** @internal */
export namespace BentleyCloudRpcInternalParams {
  export function wrap(params: BentleyCloudRpcInternalParams) {
    return new BentleyCloudRpcParamsHolder(params);
  }
}

/** Internal operating parameters for Bentley cloud RPC interface deployments.
 * @internal
 */
export abstract class BentleyCloudRpcConfiguration extends RpcConfiguration {
  /** Access-Control header values for backend servers that serve frontends using BentleyCloudRpcProtocol. */
  public static readonly accessControl = {
    allowOrigin: "*",
    allowMethods: "POST, GET, OPTIONS",
    allowHeaders: "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id, X-Session-Id, X-Application-Id, X-Application-Version, X-User-Id, X-Protocol-Version",
  };

  /** The protocol of the configuration. */
  public abstract override readonly protocol: BentleyCloudRpcProtocol;
}

/** Operating parameters for Bentley cloud RPC interface deployments.
 * @public
 */
export class BentleyCloudRpcConfigurationHolder {
  /** @internal */
  public configuration: BentleyCloudRpcConfiguration;

  /** @internal */
  constructor(configuration: BentleyCloudRpcConfiguration) {
    this.configuration = configuration;
  }
}

/** Coordinates usage of RPC interfaces for Bentley cloud deployments.
 * @public
 */
export class BentleyCloudRpcManager extends RpcManager {
  private static resolve(params: BentleyCloudRpcParams | BentleyCloudRpcParamsHolder): BentleyCloudRpcInternalParams {
    if ("params" in params) {
      return params.params;
    } else {
      return params;
    }
  }

  /** Initializes BentleyCloudRpcManager for the frontend of an application. */
  public static initializeClient(params: BentleyCloudRpcParams | BentleyCloudRpcParamsHolder, interfaces: RpcInterfaceDefinition[], routing: RpcRoutingToken = RpcRoutingToken.default): BentleyCloudRpcConfigurationHolder {
    const configuration = BentleyCloudRpcManager.performInitialization(this.resolve(params), interfaces, routing);
    return new BentleyCloudRpcConfigurationHolder(configuration);
  }

  /** Initializes BentleyCloudRpcManager for the backend of an application. */
  public static initializeImpl(params: BentleyCloudRpcParams | BentleyCloudRpcParamsHolder, interfaces: RpcInterfaceDefinition[]): BentleyCloudRpcConfigurationHolder {
    const configuration = BentleyCloudRpcManager.performInitialization(this.resolve(params), interfaces);
    return new BentleyCloudRpcConfigurationHolder(configuration);
  }

  private static performInitialization(params: BentleyCloudRpcInternalParams, interfaces: RpcInterfaceDefinition[], routing: RpcRoutingToken = RpcRoutingToken.default): BentleyCloudRpcConfiguration {
    const protocol = class extends (params.protocol || BentleyCloudRpcProtocol) {
      public override pathPrefix = params.uriPrefix || "";
      public info = params.info;
    };

    const config = class extends BentleyCloudRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: BentleyCloudRpcProtocol = new protocol(this);
      public override routing = routing;
    };

    for (const def of interfaces) {
      RpcConfiguration.assignWithRouting(def, routing, config);
    }

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);

    if (params.pendingRequestListener) {
      const listener = params.pendingRequestListener;

      RpcRequest.events.addListener((type, request) => {
        if (type === RpcRequestEvent.PendingUpdateReceived && request.protocol === instance.protocol) {
          listener(type, request);
        }
      });
    }

    return instance;
  }
}
