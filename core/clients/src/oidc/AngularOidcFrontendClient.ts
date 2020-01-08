/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IOidcFrontendClient } from "./OidcFrontendClient";

/** Interface for frontend client that handles redirect callback
 * @alpha
 */
export interface IAngularOidcFrontendClient extends IOidcFrontendClient {
  handleRedirectCallback(): Promise<boolean>;
}
