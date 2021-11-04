/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { Client } from "./Client";

/** @beta */
export class ImsAuthorizationClient extends Client {
  protected override baseUrl = "https://ims.bentley.com";

  public constructor() {
    super();
  }

  /**
   * Gets the URL of the service. The default URL is ims.bentley.com, but it can be overridden by
   * IMJS_ITWIN_PLATFORM_AUTHORITY environment variable. In that case, the URL will be used without prefix.
   * @see [[Client.getUrl]]
   *
   * Note that for consistency sake, the URL is always stripped of any trailing "/".
   * @returns URL for the service
   */
  public override async getUrl() {
    if (this._url)
      return this._url;

    if (process.env.IMJS_ITWIN_PLATFORM_AUTHORITY) {
      // Strip trailing '/'
      this._url = process.env.IMJS_ITWIN_PLATFORM_AUTHORITY.replace(/\/$/, "");
      return this._url;
    }
    return super.getUrl();
  }
}
