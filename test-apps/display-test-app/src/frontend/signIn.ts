/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, NativeApp } from "@bentley/imodeljs-frontend";
import { BrowserAuthorizationCallbackHandler } from "@bentley/frontend-authorization-client";
import { AccessToken } from "@bentley/itwin-client";

// Wraps the signIn process
// @return Promise that resolves to true after signIn is complete
export async function signIn(): Promise<boolean> {
  // for browser, frontend handles redirect. For native apps, backend handles it
  if (!NativeApp.isValid)
    await BrowserAuthorizationCallbackHandler.handleSigninCallback("http://localhost:3000/signin-callback");

  const auth = IModelApp.authorizationClient!;
  if (auth.isAuthorized)
    return true;

  return new Promise<boolean>((resolve, reject) => {
    auth.onUserStateChanged.addOnce((token?: AccessToken) => resolve(token !== undefined));
    auth.signIn().catch((err) => reject(err));
  });
}
