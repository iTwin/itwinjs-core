/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { RpcRequest, RpcRequestEventHandler, RpcRequestEvent } from "../core/RpcRequest";
import { OpenAPIInfo } from "./OpenAPI";
import { BentleyCloudRpcProtocol } from "./BentleyCloudRpcProtocol";

/** Initialization parameters for BentleyCloudRpcConfiguration. */
export interface BentleyCloudRpcParams {
  info: OpenAPIInfo;
  protocol?: typeof BentleyCloudRpcProtocol;
  uriPrefix?: string;
  pendingRequestListener?: RpcRequestEventHandler;
}

/** Operating parameters for Bentley cloud RPC interface deployments. */
export abstract class BentleyCloudRpcConfiguration extends RpcConfiguration {
  /** Bentley user authorization header. */
  public applicationAuthorizationKey = "Authorization";

  /** The protocol of the configuration. */
  public abstract readonly protocol: BentleyCloudRpcProtocol;
}

/** Coordinates usage of RPC interfaces for Bentley cloud deployments. */
export class BentleyCloudRpcManager extends RpcManager {
  /** Initializes BentleyCloudRpcManager for the frontend of an application. */
  public static initializeClient(params: BentleyCloudRpcParams, interfaces: RpcInterfaceDefinition[]): BentleyCloudRpcConfiguration {
    return BentleyCloudRpcManager.performInitialization(params, interfaces);
  }

  /** Initializes BentleyCloudRpcManager for the backend of an application. */
  public static initializeImpl(params: BentleyCloudRpcParams, interfaces: RpcInterfaceDefinition[]): BentleyCloudRpcConfiguration {
    return BentleyCloudRpcManager.performInitialization(params, interfaces);
  }

  private static performInitialization(params: BentleyCloudRpcParams, interfaces: RpcInterfaceDefinition[]): BentleyCloudRpcConfiguration {
    const protocol = class extends (params.protocol || BentleyCloudRpcProtocol) {
      public pathPrefix = params.uriPrefix || "";
      public info = params.info;
    };

    const config = class extends BentleyCloudRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: BentleyCloudRpcProtocol = new protocol(this);
    };

    for (const def of interfaces) {
      RpcConfiguration.assign(def, () => config);
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
