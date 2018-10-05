/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Client } from "../Client";
import { Config } from "../Config";

export class OidcClient extends Client {
  public static readonly searchKey: string = "IMSOpenID";
  public static readonly configURL = "imjs_oidc_url";
  public static readonly configRegion = "imjs_oidc_region";

  public constructor() {
    super();
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return OidcClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    if (Config.App.has(OidcClient.configURL))
      return Config.App.get(OidcClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${OidcClient.configURL}`);
  }

  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(OidcClient.configRegion))
      return Config.App.get(OidcClient.configRegion);

    return undefined;
  }
}
