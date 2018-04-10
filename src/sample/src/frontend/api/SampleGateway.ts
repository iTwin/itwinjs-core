/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-common";
import SampleGatewayDefinition from "../../common/SampleGatewayDefinition";

export default class SampleGateway extends SampleGatewayDefinition {

  /** Returns the SampleGateway instance for the frontend. */
  public static getProxy(): SampleGateway {
    return Gateway.getProxyForGateway(SampleGateway);
  }

  public async getSampleImodels(): Promise<string[]> {
    return this.forward.apply(this, arguments);
  }

}
