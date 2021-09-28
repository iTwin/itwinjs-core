/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { AccessToken, GuidString } from "@bentley/bentleyjs-core";
import { ChangesetId, IModelVersion } from "@bentley/imodeljs-common";

/** @public */
export interface IModelIdArg {
  iModelId: GuidString;
  accessToken: AccessToken;
}

/** @public */
export interface FrontendHubAccess {
  getLatestChangesetId: (arg: IModelIdArg) => Promise<ChangesetId>;
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangesetId>;
  getChangesetIdFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<ChangesetId>;
}
