/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { GuidString, Id64String } from "@bentley/bentleyjs-core";
import { ChangesType, LockLevel, LockType } from "@bentley/imodelhub-client";
import { CodeProps, IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { DownloadRequest } from "./CheckpointManager";

/** @internal */
export type LocalFileName = string;
/** @internal */
export type LocalDirName = string;

/** A string that identifies a changeset.
 * @note this string is *not* a Guid. It is generated internally based on the content of the changeset.
 * @internal
 */
export type ChangesetId = string;

/** @internal */
export type ChangesetIndex = number;

/** Properties of a changeset
 * @internal
 */
export interface ChangesetProps {
  /** the ChangesetId */
  id: ChangesetId;
  /** the ChangeSetId of the parent changeset of this changeset */
  parentId: ChangesetId;
  /** The type of changeset */
  changesType: ChangesType;
  /** The user-supplied description of the work this changeset holds */
  description: string;
  /** The BriefcaseId of the briefcase that created this changeset */
  briefcaseId: number;
  /** The date this changeset was uploaded to the hub */
  pushDate: string;
  /** The identity of the user that created this changeset */
  userCreated: string;
  /** The size, in bytes, of this changeset */
  size?: number;
  /** The index (sequence number) from IModelHub for this changeset. Larger index values were pushed later. */
  index?: ChangesetIndex;
}

/** Properties of a changeset file
 * @internal
 */
export interface ChangesetFileProps extends ChangesetProps {
  /** The full pathname of the local file holding this changeset. */
  pathname: LocalFileName;
}

/**
 * A range of changesets
 * @internal
 */
export interface ChangesetRange {
  /** index of the first changeset */
  first: ChangesetIndex;
  /** index of last changeset. If undefined, all changesets after first are returned. */
  end?: ChangesetIndex;
}

/**
 * The properties of an iModel server lock.
 * @beta
 */
export interface LockProps {
  /** The type of lock requested or held */
  type: LockType;
  /** The objectId for the lock */
  objectId: Id64String;
  /** the lock level */
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
  changeSetId: ChangesetId;
}

/** Argument for methods that must supply an IModelId and a ChangesetId
 * @internal
 */
export interface ChangesetIndexArg extends IModelIdArg {
  index: ChangesetIndex;
}
/** Argument for methods that must supply an IModelId and a range of ChangesetIds.
 * @internal
 */
export interface ChangesetRangeArg extends IModelIdArg {
  /** the range of changesets desired. If is undefined, *all* changesets are returned. */
  range?: ChangesetRange;
}

/** @internal */
export type CheckPointArg = DownloadRequest;

/** Methods for accessing services of IModelHub from the backend.
 * @note these methods may be mocked for tests
 * @internal
 */
export interface BackendHubAccess {
  /** Download all the changesets in the specified range. */
  downloadChangesets: (arg: ChangesetRangeArg) => Promise<ChangesetFileProps[]>;
  /** Download a single changeset. */
  downloadChangeset: (arg: ChangesetIndexArg) => Promise<ChangesetFileProps>;
  /** Query the changeset properties given a ChangesetId  */
  queryChangeset: (arg: ChangesetIdArg) => Promise<ChangesetProps>;
  /** Query an array of changeset properties given a range of ChangesetIds  */
  queryChangesets: (arg: ChangesetRangeArg) => Promise<ChangesetProps[]>;
  /** Query an array of changeset properties given a range of ChangesetIds  */
  pushChangeset: (arg: IModelIdArg & { changesetProps: ChangesetFileProps, releaseLocks: boolean }) => Promise<ChangesetIndex>;
  /** Get the changeSetId of the most recent changeset */
  getLatestChangesetIndex: (arg: IModelIdArg) => Promise<ChangesetIndex>;
  /** Get the ChangesetIndex for an IModelVersion */
  getChangesetIndexFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangesetIndex>;
  /** Get the ChangesetId for an IModelVersion */
  getChangesetIdFromVersion: (arg: IModelIdArg & { version: IModelVersion }) => Promise<ChangesetId>;
  /** Get the changeSetId for a named version */
  getChangesetIndexFromNamedVersion: (arg: IModelIdArg & { versionName: string }) => Promise<ChangesetIndex>;

  /** Get the index of the change set from its id */
  getChangesetIndexFromId: (arg: ChangesetIdArg) => Promise<ChangesetIndex>;
  /** Get the index of the change set from its id */
  getChangesetIdFromIndex: (arg: ChangesetIndexArg) => Promise<ChangesetId>;
  /** Acquire a new briefcaseId for the supplied iModelId
     * @note usually there should only be one briefcase per iModel per user.
     */
  acquireNewBriefcaseId: (arg: IModelIdArg) => Promise<number>;
  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  releaseBriefcase: (arg: BriefcaseIdArg) => Promise<void>;

  /** get an array of the briefcases assigned to the current user. */
  getMyBriefcaseIds: (arg: IModelIdArg) => Promise<number[]>;

  /** download a v1 checkpoint */
  downloadV1Checkpoint: (arg: CheckPointArg) => Promise<ChangesetId>;
  /** download a v2 checkpoint */
  downloadV2Checkpoint: (arg: CheckPointArg) => Promise<ChangesetId>;

  /** acquire a list of locks. Throws if unsuccessful */
  acquireLocks: (arg: BriefcaseDbArg & { locks: LockProps[] }) => Promise<void>;
  /** acquire the schema lock. Throws if unsuccessful */
  acquireSchemaLock: (arg: BriefcaseDbArg) => Promise<void>;

  /** determine whether the schema lock is currently held */
  querySchemaLock: (arg: BriefcaseDbArg) => Promise<boolean>;
  /** get the full list of held locks for a briefcase */
  queryAllLocks: (arg: BriefcaseDbArg) => Promise<LockProps[]>;

  /** release all currently held locks */
  releaseAllLocks: (arg: BriefcaseIdArg & ChangesetIdArg) => Promise<void>;

  /** Query codes */
  queryAllCodes: (arg: BriefcaseDbArg) => Promise<CodeProps[]>;
  /** release codes */
  releaseAllCodes: (arg: BriefcaseIdArg) => Promise<void>;

  /** get the iModelId of an iModel by name. Undefined if no iModel with that name exists.  */
  queryIModelByName: (arg: IModelNameArg) => Promise<GuidString | undefined>;
  /** create a new iModel. Returns the Guid of the newly created iModel */
  createIModel: (arg: IModelNameArg & { description?: string, revision0?: LocalFileName }) => Promise<GuidString>;
  /** delete an iModel  */
  deleteIModel: (arg: IModelIdArg & { contextId: GuidString }) => Promise<void>;
}

