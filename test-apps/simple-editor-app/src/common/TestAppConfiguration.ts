/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** Parameters for starting simple-editor-app with a specified initial configuration */
export interface TestAppConfiguration {
  snapshotPath?: string;        // Used when run in the browser - a common base path for all snapshot imodels
  startWithSnapshots?: boolean;
}
