/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb, ConcurrencyControl, AutoPush } from "@bentley/imodeljs-backend";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelError, IModelStatus, IModelVersion } from "@bentley/imodeljs-common";
import { AccessToken, DeploymentEnv, AuthorizationToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";

// __PUBLISH_EXTRACT_START__ imodeljs-clients.getAccessToken
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

// __PUBLISH_EXTRACT_START__ IModelDb.open
async function openModel(projectid: string, imodelid: string, accessToken: AccessToken) {
  const imodel: IModelDb = await IModelDb.open(accessToken, projectid, imodelid, OpenMode.Readonly);
  return imodel;
}
// __PUBLISH_EXTRACT_END__

function readConfig(): any {
  return {};
}

function configureIModel() {

// __PUBLISH_EXTRACT_START__ IModelDb.onOpen
  IModelDb.onOpen.addListener((_accessToken: AccessToken, _contextId: string, _iModelId: string, openMode: OpenMode, _version: IModelVersion) => {
    // A read-only service might want to reject all requests to open an iModel for writing. It can do this in the onOpen event.
    if (openMode !== OpenMode.Readonly)
      throw new IModelError(IModelStatus.BadRequest, "Navigator is readonly");
  });
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ IModelDb.onOpened
  IModelDb.onOpened.addListener((iModel: IModelDb) => {
    if (iModel.openMode !== OpenMode.ReadWrite)
      return;

    // Setting a concurrency control policy is an example of something you might do in an onOpened event handler.
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    // Starting AutoPush is an example of something you might do in an onOpen event handler.
    new AutoPush(iModel, readConfig()); // AutoPush registers itself with IModelDb. That allows it to keep itself alive while the DB is open and release itself when the DB closes.
  });
// __PUBLISH_EXTRACT_END__
}

const cred = {email: "Regular.IModelJsTestUser@mailinator.com", password: "Regular@iMJs"};
getUserAccessToken(cred, "PROD").then((accessToken: AccessToken) => {
  const im = openModel("x", "y", accessToken);
  if (im === undefined)
    return;
});

configureIModel();
