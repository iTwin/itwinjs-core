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
import { DownloadRequest } from "./CheckpointManager";

/** @internal */
export type LocalFileName = string;
/** @internal */
export type LocalDirName = string;

/** A string that identifies a changeset.
 * @note this string is *not* a Guid. It is generated internally based on the content of the changeset.
 */
export type ChangesetId = string;

/** @internal */
export type ChangesetIndex = number;

/** Properties of a changeset
 * @internal
 */
export interface ChangesetProps {
  id: ChangesetId;
  parentId: ChangesetId;
  changesType: number;
  description: string;
  briefcaseId: number;
  pushDate: string;
  userCreated: string;
  size?: number;
  index?: ChangesetIndex;
}

/** Properties of a changeset file
 * @internal
 */
export interface ChangesetFileProps extends ChangesetProps {
  pathname: LocalFileName;
}

/** Properties that specify a range of changesetIds.
 * @internal
 */
export type ChangesetRange =
  { first: ChangesetId, after?: never, end?: ChangesetId } |
  { after: ChangesetId, first?: never, end?: ChangesetId };

/**
 * The properties of an iModel server lock.
 * @internal
 */
export interface LockProps {
  type: LockType;
  objectId: Id64String;
  level: LockLevel;
}

/** Argument for methods that must supply an IModelId
 * @internal
 */
export interface IModelIdArg {
  iModelId: GuidString;
  requestContext?: AuthorizedClientRequestContext;
}

/** Argument for methods that must supply an IModel name and ContextId
 * @internal
 */
export interface IModelNameArg {
  requestContext?: AuthorizedClientRequestContext;
  contextId: GuidString;
  iModelName: string;
}

/** Argument for methods that must supply briefcase properties
 * @internal
 */
export interface BriefcaseDbArg {
  requestContext?: AuthorizedClientRequestContext;
  briefcase: {
    briefcaseId: number;
    iModelId: GuidString;
    changeSetId: ChangesetId;
  };
}

/** Argument for methods that must supply an IModelId and a BriefcaseId
 * @internal
 */
export interface BriefcaseIdArg extends IModelIdArg {
  briefcaseId: number;
}

/** Argument for methods that must supply an IModelId and a ChangesetId
 * @internal
 */
export interface ChangesetIdArg extends IModelIdArg {
  changesetId: ChangesetId;
}

/** Argument for methods that must supply an IModelId and a range of ChangesetIds
 * @internal
 */
export interface ChangesetRangeArg extends IModelIdArg {
  range?: ChangesetRange;
}

export type CheckPointArg = DownloadRequest;

/** Methods for accessing services of IModelHub from the backend.
 * @note these methods may be mocked for tests
 * @internal
 */
export interface BackendHubAccess {
  /** Download all the changesets in the specified range. */
  downloadChangesets: (arg: ChangesetRangeArg) => Promise<ChangesetFileProps[]>;
  /** Download a single changeset. */
  downloadChangeset: (arg: ChangesetIdArg) => Promise<ChangesetFileProps>;
  /** Query the changeset properties given a ChangesetId  */
  queryChangeset: (arg: ChangesetIdArg) => Promise<ChangesetProps>;
  /** Query an array of changeset properties given a range of ChangesetIds  */
  queryChangesets: (arg: ChangesetRangeArg) => Promise<ChangesetProps[]>;
  /** Query an array of changeset properties given a range of ChangesetIds  */
  pushChangeset: (arg: IModelIdArg & { changesetProps: ChangesetFileProps, releaseLocks: boolean }) => Promise<void>;
  getLatestChangesetId: (arg: IModelIdArg) => Promise<ChangesetId>;
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangesetId>;
  getChangesetIdFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<ChangesetId>;

  /** Get the index of the change set from its id */
  getChangesetIndexFromId: (arg: ChangesetIdArg) => Promise<ChangesetIndex>;
  /** Acquire a new briefcaseId for the supplied iModelId
     * @note usually there should only be one briefcase per iModel per user.
     */
  acquireNewBriefcaseId: (arg: IModelIdArg) => Promise<number>;
  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  releaseBriefcase: (arg: BriefcaseIdArg) => Promise<void>;

  getMyBriefcaseIds: (arg: IModelIdArg) => Promise<number[]>;

  downloadV1Checkpoint: (arg: CheckPointArg) => Promise<ChangesetId>;
  downloadV2Checkpoint: (arg: CheckPointArg) => Promise<ChangesetId>;

  acquireLocks: (arg: BriefcaseDbArg & { locks: LockProps[] }) => Promise<void>;
  acquireSchemaLock: (arg: BriefcaseDbArg) => Promise<void>;

  querySchemaLock: (arg: BriefcaseDbArg) => Promise<boolean>;
  queryAllLocks: (arg: BriefcaseDbArg) => Promise<LockProps[]>;

  releaseAllLocks: (arg: BriefcaseIdArg) => Promise<void>;

  queryAllCodes: (arg: BriefcaseDbArg) => Promise<CodeProps[]>;
  releaseAllCodes: (arg: BriefcaseIdArg) => Promise<void>;

  queryIModelByName: (arg: IModelNameArg) => Promise<GuidString | undefined>;
  createIModel: (arg: IModelNameArg & { description?: string, revision0?: LocalFileName }) => Promise<GuidString>;
  deleteIModel: (arg: IModelIdArg & { contextId: GuidString }) => Promise<void>;
}

