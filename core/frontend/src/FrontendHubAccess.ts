/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetIndexAndId, IModelVersion } from "@itwin/core-common";

/** @public */
export interface IModelIdArg {
  iModelId: GuidString;
  accessToken: AccessToken;
}

/** @public */
export interface FrontendHubAccess {
  getLatestChangeset(arg: IModelIdArg): Promise<ChangesetIndexAndId>;
  getChangesetFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetIndexAndId>;
  /**
   * Fetches the changeset with the given named version.
   * @param versionName If omitted will default to the latest named version.
   */
  getChangesetFromNamedVersion(arg: IModelIdArg & { versionName?: string }): Promise<ChangesetIndexAndId>;
}
