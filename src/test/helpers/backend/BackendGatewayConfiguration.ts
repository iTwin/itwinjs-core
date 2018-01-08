/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayDefinition, Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";

export default class TestGatewayConfiguration extends Gateway.Configuration {
  public gateways: () => GatewayDefinition[];
  public protocol: Gateway.DirectProtocol = new Gateway.DirectProtocol(this);

  /** IMO all of this should be done in the Gateway code itself, but for now... */
  public static initialize(gateways: GatewayDefinition[]): TestGatewayConfiguration {
    const config = class extends TestGatewayConfiguration {
      public gateways = () => gateways;
    };

    for (const gateway of gateways)
      Gateway.setConfiguration(gateway, () => config);

    const instance = Gateway.Configuration.getInstance(config);
    instance.initializeGateways();

    return instance;
  }
}
