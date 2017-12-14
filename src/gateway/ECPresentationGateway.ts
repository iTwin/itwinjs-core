/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@build/imodeljs-core/lib/common/Gateway";
import { IModelToken } from "@build/imodeljs-core/lib/common/IModel";

export default class ECPresentationGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    IModelToken,
  ]

  /** Returns the ECPresentationGateway instance for the frontend. */
  public static getProxy(): ECPresentationGateway {
    return Gateway.getProxyForGateway(ECPresentationGateway);
  }

  public async getRootNodesCount(_token: IModelToken): Promise<number> {
    return this.forward.apply(this, arguments);
  }
}
