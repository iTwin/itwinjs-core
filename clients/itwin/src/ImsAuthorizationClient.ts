/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { Client } from "./Client";
import { Config } from "@bentley/bentleyjs-core";

/** @beta */
export class ImsAuthorizationClient extends Client {
  public static readonly searchKey: string = "IMSOpenID";

  public constructor() {
    super();
    this._url = Config.App.query("imjs_itwin_platform_authority");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ImsAuthorizationClient.searchKey;
  }
}
