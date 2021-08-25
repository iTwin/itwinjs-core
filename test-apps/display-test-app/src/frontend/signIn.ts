/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, NativeApp } from "@bentley/imodeljs-frontend";
import { BrowserAuthorizationCallbackHandler } from "@bentley/frontend-authorization-client";
// import { AccessTokenString } from "@bentley/itwin-client";

// Wraps the signIn process
// @return Promise that resolves to true after signIn is complete
export async function signIn(): Promise<boolean> {
  // for browser, frontend handles redirect. For native apps, backend handles it
  if (!NativeApp.isValid)
    await BrowserAuthorizationCallbackHandler.handleSigninCallback("http://localhost:3000/signin-callback");

  const auth = IModelApp.authorizationClient!;

  // Placeholder -- Figure this out
  return (await auth.getAccessToken()) !== undefined;
}
