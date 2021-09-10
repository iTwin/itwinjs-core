/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TestUserCredentials } from "@bentley/oidc-signin-tool";

// SWB
export interface TestProjectProps {
  // SWB
  projectName: string;
  iModelBank?: {
    url: string;
  };
  iModelHub?: {
    region: string;
  };
}
export const testIpcChannel = "testIpc";

export interface TestIpcInterface {
  purgeStorageCache: () => Promise<void>;
  beginOfflineScope: () => Promise<void>;
  endOfflineScope: () => Promise<void>;
  // SWB
  getTestProjectProps: (user: TestUserCredentials) => Promise<TestProjectProps>;
}
