/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import { Gateway } from "../Gateway";
import { IModel, IModelToken } from "../IModel";

/**
 * The Gateway for working with standalone iModels.
 * Products are generally discouraged from using standalone iModels and therefore registering this Gateway.
 */
export abstract class StandaloneIModelGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [IModelToken];

  /** Returns the StandaloneIModelGateway proxy instance for the frontend. */
  public static getProxy(): StandaloneIModelGateway { return Gateway.getProxyForGateway(StandaloneIModelGateway); }

  public openStandalone(_fileName: string, _openMode: OpenMode): Promise<IModel> { return this.forward.apply(this, arguments); }
  public closeStandalone(_iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
}
