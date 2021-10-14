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
  public constructor() {
    super();
    this.baseUrl = process.env.IMJS_ITWIN_PLATFORM_AUTHORITY ?? "https://ims.bentley.com";
  }
}
