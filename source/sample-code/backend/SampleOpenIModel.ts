/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb } from "@bentley/imodeljs-backend";
import { OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken, DeploymentEnv, AuthorizationToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";

// __PUBLISH_EXTRACT_START__ BisCore1.getAccessToken
interface UserCredentials {
  email: string;
  password: string;
}

async function getUserAccessToken(userCredentials: UserCredentials, env: DeploymentEnv): Promise<AccessToken> {
  const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(env)).getToken(userCredentials.email, userCredentials.password);

  const accessToken = await (new ImsDelegationSecureTokenClient(env)).getToken(authToken!);

  return accessToken;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ BisCore1.sampleOpenModel
async function openModel(projectid: string, imodelid: string, accessToken: AccessToken) {
  const imodel: IModelDb = await IModelDb.open(accessToken, projectid, imodelid, OpenMode.Readonly);
  return imodel;
}
// __PUBLISH_EXTRACT_END__

const cred = {email: "Regular.IModelJsTestUser@mailinator.com", password: "Regular@iMJs"};
getUserAccessToken(cred, "PROD").then((accessToken: AccessToken) => {
  const im = openModel("x", "y", accessToken);
  if (im === undefined)
    return;
});
