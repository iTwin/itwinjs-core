/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayConfiguration, GatewayDefinition, GatewayDefaultConfiguration } from "@bentley/imodeljs-common";

export default class TestGatewayConfiguration extends GatewayDefaultConfiguration {
  // IMO all of this should be done in the Gateway code itself, but for now...
  public static initialize(gateways: GatewayDefinition[]): TestGatewayConfiguration {
    const config = class extends TestGatewayConfiguration {
      public gateways: any = () => gateways;
    };

    for (const gateway of gateways)
      GatewayConfiguration.assign(gateway, () => config);

    const instance = GatewayConfiguration.obtain(config);
    try {
      GatewayConfiguration.initializeGateways(instance);
    } catch (_e) {
      // this may fail with "Error: Gateway "xxx" is already initialized." because
      // multiple different tests want to set up the gateway
    }

    return instance;
  }
}
