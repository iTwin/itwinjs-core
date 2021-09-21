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
  public static readonly searchKey: string = "IMSOpenID";

  public constructor() {
    super();
    this.baseUrl = process.env.IMJS_ITWIN_PLATFORM_AUTHORITY;
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsAuthorizationClient.searchKey;
  }
}
