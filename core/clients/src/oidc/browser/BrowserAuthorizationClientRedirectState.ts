/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Contains information related to the previous application state, as specified in the original auth request.
 * Information about this state is only particularly useful when dealing with authentication via redirection because it must destroy that application state to function.
 * Recovering from other authentication via other methods involving iframes or popup windows is simpler they instead preserve the original application state.
 */
export interface BrowserAuthorizationClientRedirectState {
  successRedirectUrl: string;
}
