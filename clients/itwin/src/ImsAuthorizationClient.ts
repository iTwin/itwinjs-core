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
