/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { GuidString } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** @public */
export type ChangeSetId = string;

/** @public */
export interface IModelIdArg {
  iModelId: GuidString;
  requestContext: AuthorizedClientRequestContext;
}

/** @public */
export interface FrontendHubAccess {
  getLatestChangesetId: (arg: IModelIdArg) => Promise<ChangeSetId>;
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangeSetId>;
  getChangesetIdFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<ChangeSetId>;
}
