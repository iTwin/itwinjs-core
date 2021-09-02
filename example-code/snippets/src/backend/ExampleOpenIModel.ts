/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseDb } from "@bentley/imodeljs-backend";
import { IModelError, IModelStatus, OpenBriefcaseProps } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { TestUserCredentials, TestUtility } from "@bentley/oidc-signin-tool";

/* eslint-disable @typescript-eslint/no-var-requires */

async function getUserAccessToken(userCredentials: TestUserCredentials): Promise<AccessToken> {
  return TestUtility.getAccessToken(userCredentials);
}

function configureIModel() {
  // __PUBLISH_EXTRACT_START__ BriefcaseDb.onOpen
  BriefcaseDb.onOpen.addListener((briefcaseProps: OpenBriefcaseProps) => {
    // A read-only application might want to reject all requests to open an iModel for writing. It can do this in the onOpen event.
    if (!briefcaseProps.readonly)
      throw new IModelError(IModelStatus.BadRequest, "This app is readonly");
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ BriefcaseDb.onOpened
  BriefcaseDb.onOpened.addListener((iModel: BriefcaseDb) => {
    if (iModel.openMode !== OpenMode.ReadWrite)
      return;
    // ... do something with the writeable briefcase
  });
  // __PUBLISH_EXTRACT_END__
}

// Call the above functions, to avoid lint errors.
const cred = {
  email: process.env.IMJS_TEST_REGULAR_USER_NAME ?? "",
  password: process.env.IMJS_TEST_REGULAR_USER_PASSWORD ?? "",
};

getUserAccessToken(cred).then((_accessToken: AccessToken) => { // eslint-disable-line @typescript-eslint/no-floating-promises
});

configureIModel();
