/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IOidcFrontendClient } from "./OidcFrontendClient";

/** Interface for frontend client that handles redirect callback */
export interface IAngularOidcFrontendClient extends IOidcFrontendClient {
  handleRedirectCallback(): Promise<boolean>;
}
