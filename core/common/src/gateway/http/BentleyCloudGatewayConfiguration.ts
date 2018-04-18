/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayDefinition } from "../../Gateway";
import { GatewayConfiguration } from "../core/GatewayConfiguration";
import { GatewayRequest, GatewayRequestEventHandler, GatewayRequestEvent } from "../core/GatewayRequest";
import { OpenAPIInfo } from "./OpenAPI";
import { BentleyCloudGatewayProtocol } from "./BentleyCloudGatewayProtocol";

/** @module Gateway */

/** Initialization parameters for BentleyCloudGatewayConfiguration. */
export interface BentleyCloudGatewayParams {
  info: OpenAPIInfo;
  protocol?: typeof BentleyCloudGatewayProtocol;
  uriPrefix?: string;
  pendingRequestListener?: GatewayRequestEventHandler;
}

/** Operating parameters for Bentley cloud gateway deployments. */
export abstract class BentleyCloudGatewayConfiguration extends GatewayConfiguration {
  /** Bentley user authorization header. */
  public applicationAuthorizationKey = "Authorization";

  /** The protocol of the configuration. */
  public abstract readonly protocol: BentleyCloudGatewayProtocol;

  /** Performs gateway configuration for the application. */
  public static initialize(params: BentleyCloudGatewayParams, gateways: GatewayDefinition[]): BentleyCloudGatewayConfiguration {
    const protocol = class extends (params.protocol || BentleyCloudGatewayProtocol) {
      public pathPrefix = params.uriPrefix || "";
      public info = params.info;
    };

    const config = class extends BentleyCloudGatewayConfiguration {
      public gateways = () => gateways;
      public protocol: BentleyCloudGatewayProtocol = new protocol(this);
    };

    for (const gateway of gateways) {
      GatewayConfiguration.assign(gateway, () => config);
    }

    const instance = GatewayConfiguration.obtain(config);
    GatewayConfiguration.initializeGateways(instance);

    if (params.pendingRequestListener) {
      const listener = params.pendingRequestListener;

      GatewayRequest.events.addListener((type, request) => {
        if (type === GatewayRequestEvent.PendingUpdateReceived && request.protocol === instance.protocol) {
          listener(type, request);
        }
      });
    }

    return instance;
  }
}
