/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayDefinition, Gateway } from "@bentley/imodeljs-frontend/lib/common/Gateway";
import { GatewayConfiguration } from "@bentley/imodeljs-frontend/lib/gateway/GatewayConfiguration";
import { GatewayProtocol, GatewayDirectProtocol } from "@bentley/imodeljs-frontend/lib/gateway/GatewayProtocol";

export default class TestGatewayConfiguration extends GatewayConfiguration {
  public gateways: () => GatewayDefinition[] = () => [];
  public protocol: GatewayProtocol = new GatewayDirectProtocol(this);

  // IMO all of this should be done in the Gateway code itself, but for now...
  public static initialize(gateways: GatewayDefinition[]): TestGatewayConfiguration {
    const config = class extends TestGatewayConfiguration {
      public gateways = () => gateways;
    };

    for (const gateway of gateways)
      Gateway.setConfiguration(gateway, () => config);

    const instance = GatewayConfiguration.getInstance(config);
    instance.initializeGateways();

    return instance;
  }
}
