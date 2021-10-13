/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetId, IModelVersion } from "@itwin/core-common";

/** @public */
export interface IModelIdArg {
  iModelId: GuidString;
  accessToken: AccessToken;
}

/** @public */
export interface FrontendHubAccess {
  getLatestChangesetId(arg: IModelIdArg): Promise<ChangesetId>;
  getChangesetIdFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetId>;
  getChangesetIdFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<ChangesetId>;
}
