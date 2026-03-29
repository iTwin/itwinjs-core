/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { WorkspaceDbName } from "../../workspace/Workspace";

export function settingsDbNameWithDefault(dbName?: WorkspaceDbName): WorkspaceDbName {
  return dbName ?? "settings-db";
}
