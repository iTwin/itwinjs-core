/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, Config, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseDb, ConcurrencyControl } from "@bentley/imodeljs-backend";
import { IModelError, IModelRpcProps, IModelStatus } from "@bentley/imodeljs-common";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUserCredentials, TestUtility } from "@bentley/oidc-signin-tool";

/* eslint-disable @typescript-eslint/no-var-requires */

async function getUserAccessToken(userCredentials: TestUserCredentials): Promise<AccessToken> {
  return TestUtility.getAccessToken(userCredentials);
}

function configureIModel() {
  // __PUBLISH_EXTRACT_START__ BriefcaseDb.onOpen
  BriefcaseDb.onOpen.addListener((_requestContext: AuthorizedClientRequestContext | ClientRequestContext, briefcaseProps: IModelRpcProps) => {
    // A read-only service might want to reject all requests to open an iModel for writing. It can do this in the onOpen event.
    if (briefcaseProps.openMode !== OpenMode.Readonly)
      throw new IModelError(IModelStatus.BadRequest, "Navigator is readonly");
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ BriefcaseDb.onOpened
  BriefcaseDb.onOpened.addListener((_requestContext: AuthorizedClientRequestContext | ClientRequestContext, iModel: BriefcaseDb) => {
    if (iModel.openMode !== OpenMode.ReadWrite)
      return;

    // Setting a concurrency control policy is an example of something you might do in an onOpened event handler.
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
  });
  // __PUBLISH_EXTRACT_END__
}

// Call the above functions, to avoid lint errors.
const cred = {
  email: Config.App.getString("imjs_test_regular_user_name"),
  password: Config.App.getString("imjs_test_regular_user_password"),
};

getUserAccessToken(cred).then((_accessToken: AccessToken) => { // eslint-disable-line @typescript-eslint/no-floating-promises
});

configureIModel();
