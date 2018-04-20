/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayProtocol, GatewayDirectProtocol, GatewayConfiguration, GatewayDefinition } from "@bentley/imodeljs-common";

export default class TestGatewayConfiguration extends GatewayConfiguration {
  public gateways: () => GatewayDefinition[] = () => [];
  public protocol: GatewayProtocol = new GatewayDirectProtocol();

  // IMO all of this should be done in the Gateway code itself, but for now...
  public static initialize(gateways: GatewayDefinition[]): TestGatewayConfiguration {
    const config = class extends TestGatewayConfiguration {
      public gateways = () => gateways;
    };

    for (const gateway of gateways)
      GatewayConfiguration.assign(gateway, () => config);

    const instance = GatewayConfiguration.obtain(config);
    GatewayConfiguration.initializeGateways(instance);

    return instance;
  }
}
