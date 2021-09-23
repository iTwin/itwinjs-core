/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TestUserCredentials } from "@bentley/oidc-signin-tool";

export interface TestiTwinProps {
  iTwinName: string;
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
  getTestiTwinProps: (user: TestUserCredentials) => Promise<TestiTwinProps>;
}
