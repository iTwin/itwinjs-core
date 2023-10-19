/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authorization
 */

import { type AccessToken, BeEvent } from "@itwin/core-bentley";

/** Provides authorization to access APIs.
 * Bentley's iTwin platform APIs [use OAuth 2.0](https://developer.bentley.com/apis/overview/authorization/) for authorization.
 * Implementations are provided for [Electron](https://www.npmjs.com/package/@itwin/electron-authorization), [browsers](https://www.npmjs.com/package/@itwin/browser-authorization),
 * [services](https://www.npmjs.com/package/@itwin/service-authorization), and [command-line applications](https://www.npmjs.com/package/@itwin/node-cli-authorization).
 * @see [IModelHostOptions.authorizationClient]($backend) and [IModelAppOptions.authorizationClient]($frontend) to configure the client.
 * @see [IModelHost.authorizationClient]($backend) and [IModelApp.authorizationClient]($frontend) to access the configured client.
 * @note Access tokens expire periodically and are automatically refreshed when possible; therefore, tokens should always be requested via the client, not cached for later reuse.
 @public
 */
export interface AuthorizationClient {
  /** Obtain an [[AccessToken]] for the currently authorized user, or blank string if no token is available. */
  getAccessToken(): Promise<AccessToken>;

  /** [[BeEvent]] which fires when the client's [[AccessToken]] changes. */
  readonly onAccessTokenChanged?: BeEvent<(token: AccessToken) => void>;
}
