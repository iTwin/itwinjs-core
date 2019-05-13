/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** Parameters for starting ui-test-app with a specified initial configuration */
export interface TestAppConfiguration {
  snapshotPath?: string;        // Used when run in the browser - a common base path for all snapshot imodels
  startWithSnapshots?: boolean;
}
