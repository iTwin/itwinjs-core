/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export interface CloudEnvProps {
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
  getCloudEnv: () => Promise<CloudEnvProps>;
}

