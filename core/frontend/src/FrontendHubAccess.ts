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

/** @internal */
export type ChangeSetId = string;

/** @internal */
export interface IModelIdArg {
  iModelId: GuidString;
  requestContext: AuthorizedClientRequestContext;
}

/** @internal */
export interface FrontendHubAccess {
  getLatestChangesetId: (arg: IModelIdArg) => Promise<ChangeSetId>;
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangeSetId>;
  getChangesetIdFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<ChangeSetId>;
}
