/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { Client } from "./Client";
import { Config } from "./Config";
/**
 * Client wrapper to IModel Web Service
 */
export class IModelWebNavigatorClient extends Client {
  public static readonly searchKey: string = "iModelWeb.Url";
  public static readonly configURL = "imjs_imodelweb_url";
  public static readonly configRegion = "imjs_imodelweb_region";
  /**
   * Creates an instance of IModelWebNavigatorClient.
   */
  public constructor() {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return IModelWebNavigatorClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    if (Config.App.has(IModelWebNavigatorClient.configURL))
      return Config.App.get(IModelWebNavigatorClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${IModelWebNavigatorClient.configURL}`);
  }

  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(IModelWebNavigatorClient.configRegion))
      return Config.App.get(IModelWebNavigatorClient.configRegion);

    return undefined;
  }

}
