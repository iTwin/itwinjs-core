/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayDefinition } from "../common/Gateway";
import { BentleyCloudGatewayProtocol } from "./BentleyCloudGatewayProtocol";

/** Initialization parameters for BentleyCloudGatewayConfiguration. */
export interface BentleyCloudGatewayParams {
  info: Gateway.HttpProtocol.OpenAPIInfo;
  protocol?: typeof BentleyCloudGatewayProtocol;
  uriPrefix?: string;
}

/** Operating parameters for Bentley cloud gateway deployments. */
export abstract class BentleyCloudGatewayConfiguration extends Gateway.Configuration {
  /** Bentley user authorization header. */
  public applicationAuthorizationKey = "Authorization";

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

    const instance = Gateway.Configuration.getInstance(config);
    instance.initializeGateways();

    return instance;
  }
}
