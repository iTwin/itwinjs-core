/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayDefinition } from "../Gateway";
import { GatewayConfiguration } from "./GatewayConfiguration";
import { GatewayHttpProtocol } from "./GatewayHttpProtocol";
import { BentleyCloudGatewayProtocol } from "./BentleyCloudGatewayProtocol";

/** Initialization parameters for BentleyCloudGatewayConfiguration. */
export interface BentleyCloudGatewayParams {
  info: GatewayHttpProtocol.OpenAPIInfo;
  protocol?: typeof BentleyCloudGatewayProtocol;
  uriPrefix?: string;
  pendingRequestListener?: GatewayHttpProtocol.PendingOperationRequestListener;
}

/** Operating parameters for Bentley cloud gateway deployments. */
export abstract class BentleyCloudGatewayConfiguration extends GatewayConfiguration {
  /** Bentley user authorization header. */
  public applicationAuthorizationKey = "Authorization";

  /** The protocol of the configuration. */
  public abstract protocol: BentleyCloudGatewayProtocol;

  /** Performs gateway configuration for the application. */
  public static initialize(params: BentleyCloudGatewayParams, gateways: GatewayDefinition[]) {
    const protocol = class extends (params.protocol || BentleyCloudGatewayProtocol) {
      public openAPIPathPrefix = () => (params.uriPrefix || "");
      public openAPIInfo = () => params.info;
    };

    const config = class extends BentleyCloudGatewayConfiguration {
      public gateways = () => gateways;
      public protocol: BentleyCloudGatewayProtocol = new protocol(this);
    };

    for (const gateway of gateways)
      Gateway.setConfiguration(gateway, () => config);

    const instance = GatewayConfiguration.getInstance(config);
    if (params.pendingRequestListener)
      instance.protocol.pendingOperationRequestListeners.push(params.pendingRequestListener);

    instance.initializeGateways();

    return instance;
  }
}
