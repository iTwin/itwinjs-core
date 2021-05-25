/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { GuidString } from "@bentley/bentleyjs-core";
import { BriefcaseProps } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** Properties of a changeset
 * @internal
 */
export interface ChangesetProps {
  id: string;
  parentId: string;
  changesType: number;
  description: string;
  briefcaseId?: number;
  pushDate?: string;
  userCreated?: string;
  size?: number;
  index?: number;
}

/** Properties of a changeset file
 * @internal
 */
export interface ChangesetFileProps extends ChangesetProps {
  pathname: string;
}

export type ChangesetRange = { first: string, after?: never, end?: string } | { after: string, first?: never, end?: string };

export interface HubAccess {
  downloadChangeSets: (requestContext: AuthorizedClientRequestContext, iModelId: GuidString, range: ChangesetRange) => Promise<ChangesetFileProps[]>;
  queryChangesetProps: (requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changesetId: string) => Promise<ChangesetProps>;

  /** Get the index of the change set from its id */
  getChangeSetIndexFromId: (requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSetId: string) => Promise<number>;
  /** Acquire a new briefcaseId for the supplied iModelId
   * @note usually there should only be one briefcase per iModel per user.
   */
  acquireNewBriefcaseId: (requestContext: AuthorizedClientRequestContext, iModelId: GuidString) => Promise<number>;
  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  releaseBriefcase: (requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseProps) => Promise<void>;

}
