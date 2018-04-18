/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "../Gateway";
import { IModelToken } from "../IModel";

/**
 * For unit testing purposes only. This Gateway should not be registered by real products.
 * @hidden
 */
export abstract class IModelUnitTestGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [IModelToken];

  /** Returns the IModelUnitTestGateway proxy instance for the frontend. */
  public static getProxy(): IModelUnitTestGateway { return Gateway.getProxyForGateway(IModelUnitTestGateway); }

  public executeTest(_iModelToken: IModelToken, _testName: string, _params: any): Promise<any> { return this.forward.apply(this, arguments); }
}
