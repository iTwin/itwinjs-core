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

  public override async getUrl() {
    if (this._url) {
      console.log(`IMS client - found url: ${this._url}`);
      return this._url;
    }

    if (process.env.IMJS_ITWIN_PLATFORM_AUTHORITY) {
      // Strip trailing '/'
      this._url = process.env.IMJS_ITWIN_PLATFORM_AUTHORITY.replace(/\/$/, "");
      console.log(`IMS client - returning custom url: ${this._url}`);
      return this._url;
    }
    console.log(`IMS client - returning url with prefix: ${process.env.IMJS_URL_PREFIX}`);
    return super.getUrl();
  }
}
