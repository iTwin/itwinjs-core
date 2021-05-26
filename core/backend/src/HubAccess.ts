/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { GuidString, Id64String } from "@bentley/bentleyjs-core";
import { LockLevel, LockType } from "@bentley/imodelhub-client";
import { CodeProps, IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

export type LocalFileName = string;
export type LocalDirName = string;

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

/**
 * The properties of an iModel server lock.
 * @beta
 */
export interface LockProps {
  type: LockType;
  objectId: Id64String;
  level: LockLevel;
}

export interface IModelIdArg {
  iModelId: GuidString;
  requestContext?: AuthorizedClientRequestContext;
}

export interface BriefcaseIdArg extends IModelIdArg {
  briefcaseId: number;
}

export interface HubAccess {
  downloadChangeSets: (arg: IModelIdArg & { range?: ChangesetRange }) => Promise<ChangesetFileProps[]>;
  downloadChangeSet: (arg: IModelIdArg & { id: string }) => Promise<ChangesetFileProps>;
  queryChangesetProps: (arg: IModelIdArg & { changesetId: string }) => Promise<ChangesetProps>;
  pushChangeset: (arg: IModelIdArg & { changesetProps: ChangesetFileProps, releaseLocks: boolean }) => Promise<void>;
  getLatestChangeSetId: (arg: IModelIdArg) => Promise<string>;
  getChangeSetIdFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<string>;
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<string>;

  /** Get the index of the change set from its id */
  getChangeSetIndexFromId: (arg: IModelIdArg & { changeSetId: string }) => Promise<number>;
  /** Acquire a new briefcaseId for the supplied iModelId
     * @note usually there should only be one briefcase per iModel per user.
     */
  acquireNewBriefcaseId: (arg: IModelIdArg) => Promise<number>;
  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  releaseBriefcase: (arg: BriefcaseIdArg) => Promise<void>;

  getMyBriefcaseIds: (arg: IModelIdArg) => Promise<number[]>;

  getAllLocks: (arg: BriefcaseIdArg) => Promise<LockProps[]>;
  getAllCodes: (arg: BriefcaseIdArg) => Promise<CodeProps[]>;
  releaseAllLocks: (arg: BriefcaseIdArg) => Promise<void>;
  releaseAllCodes: (arg: BriefcaseIdArg) => Promise<void>;

  createIModel: (arg: { requestContext?: AuthorizedClientRequestContext, contextId: GuidString, iModelName: string, description?: string, revision0?: LocalFileName }) => Promise<GuidString>;
  deleteIModel: (arg: { requestContext?: AuthorizedClientRequestContext, contextId: GuidString, iModelId: GuidString }) => Promise<void>;
}

