/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { GuidString, Id64String } from "@bentley/bentleyjs-core";
import {
  ChangesetFileProps, ChangesetId, ChangesetIdWithIndex, ChangesetIndex, ChangesetIndexOrId, ChangesetProps, ChangesetRange, CodeProps, IModelVersion,
  LocalDirName, LocalFileName,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseId } from "./BriefcaseManager";
import { CheckpointProps, DownloadRequest } from "./CheckpointManager";

/** The state of a lock.
 * @public
 */
export enum LockState {
  /** The entity is not locked */
  None = 0,
  /** Holding a shared lock on an element blocks other users from acquiring the Exclusive lock it. More than one user may acquire the shared lock. */
  Shared = 1,
  /** A Lock that permits modifications to an element and blocks other users from making modifications to it.
   * Holding an exclusive lock on an "owner" (a model or a parent element), implicitly exclusively locks all its members.
   */
  Exclusive = 2,
}

/**
 * The properties to access a V2 checkpoint through a daemon.
 * @beta
 */
export interface V2CheckpointAccessProps {
  readonly container: string;
  readonly auth: string;
  readonly user: string;
  readonly dbAlias: string;
  readonly storageType: string;
}

/** @internal */
export type LockMap = Map<Id64String, LockState>;

/**
 * The properties of a lock that may be obtained from a lock server.
 * @beta
 */
export interface LockProps {
  /** The elementId for the lock */
  readonly id: Id64String;
  /** the lock scope */
  readonly state: LockState;
}

/** Argument for methods that must supply an IModelId
 * @internal
 */
export interface IModelIdArg {
  readonly iModelId: GuidString;
  readonly user?: AuthorizedClientRequestContext;
}

/** Argument for methods that must supply an IModel name and iTwinId
 * @internal
 */
export interface IModelNameArg {
  readonly user?: AuthorizedClientRequestContext;
  readonly iTwinId: GuidString;
  readonly iModelName: string;
}

/** Argument for methods that must supply an IModelId and a BriefcaseId
 * @internal
 */
export interface BriefcaseIdArg extends IModelIdArg {
  readonly briefcaseId: BriefcaseId;
}

/** Argument for methods that must supply a briefcaseId and a changeset
 * @internal
 */
export interface BriefcaseDbArg extends BriefcaseIdArg {
  readonly changeset: ChangesetIdWithIndex;
}

/** Argument for methods that must supply an IModelId and a changeset
 * @internal
 */
export interface ChangesetArg extends IModelIdArg {
  readonly changeset: ChangesetIndexOrId;
}

/** @internal */
export interface ChangesetIndexArg extends IModelIdArg {
  readonly changeset: ChangesetIdWithIndex;
}

/** Argument for methods that must supply an IModelId and a range of ChangesetIds.
 * @internal
 */
export interface ChangesetRangeArg extends IModelIdArg {
  /** the range of changesets desired. If is undefined, *all* changesets are returned. */
  readonly range?: ChangesetRange;
}

/** @internal */
export type CheckPointArg = DownloadRequest;

/** @internal */
export interface CreateNewIModelProps extends IModelNameArg {
  readonly description?: string;
  readonly revision0?: LocalFileName;
  readonly noLocks?: true;
}

/** Methods for accessing services of IModelHub from an iTwin.js backend.
 * @internal
 */
export interface BackendHubAccess {
  /** Download all the changesets in the specified range. */
  downloadChangesets(arg: ChangesetRangeArg & { targetDir: LocalDirName }): Promise<ChangesetFileProps[]>;
  /** Download a single changeset. */
  downloadChangeset(arg: ChangesetArg & { targetDir: LocalDirName }): Promise<ChangesetFileProps>;
  /** Query the changeset properties given a ChangesetIndex  */
  queryChangeset(arg: ChangesetArg): Promise<ChangesetProps>;
  /** Query an array of changeset properties given a range of ChangesetIndexes  */
  queryChangesets(arg: ChangesetRangeArg): Promise<ChangesetProps[]>;
  /** push a changeset to iMOdelHub. Returns the newly pushed changeSet's index */
  pushChangeset(arg: IModelIdArg & { changesetProps: ChangesetFileProps }): Promise<ChangesetIndex>;
  /** Get the ChangesetProps of the most recent changeset */
  getLatestChangeset(arg: IModelIdArg): Promise<ChangesetProps>;
  /** Get the ChangesetProps for an IModelVersion */
  getChangesetFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetProps>;
  /** Get the ChangesetProps for a named version */
  getChangesetFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<ChangesetProps>;

  /** Acquire a new briefcaseId for the supplied iModelId
     * @note usually there should only be one briefcase per iModel per user.
     */
  acquireNewBriefcaseId(arg: IModelIdArg): Promise<BriefcaseId>;
  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  releaseBriefcase(arg: BriefcaseIdArg): Promise<void>;

  /** get an array of the briefcases assigned to the current user. */
  getMyBriefcaseIds(arg: IModelIdArg): Promise<BriefcaseId[]>;

  /** download a v1 checkpoint */
  downloadV1Checkpoint(arg: CheckPointArg): Promise<ChangesetId>;

  /** get the access props for a V2 checkpoint. Returns undefined if no V2 checkpoint exists. */
  queryV2Checkpoint(arg: CheckpointProps): Promise<V2CheckpointAccessProps | undefined>;
  /** download a v2 checkpoint */
  downloadV2Checkpoint(arg: CheckPointArg): Promise<ChangesetId>;

  /** acquire one or more locks. Throws if unsuccessful. If *any* lock cannot be obtained, no locks are acquired */
  acquireLocks(arg: BriefcaseDbArg, locks: LockMap): Promise<void>;

  /** get the full list of held locks for a briefcase */
  queryAllLocks(arg: BriefcaseDbArg): Promise<LockProps[]>;

  /** release all currently held locks */
  releaseAllLocks(arg: BriefcaseDbArg): Promise<void>;

  /** Query codes */
  queryAllCodes(arg: BriefcaseDbArg): Promise<CodeProps[]>;
  /** release codes */
  releaseAllCodes(arg: BriefcaseDbArg): Promise<void>;

  /** get the iModelId of an iModel by name. Undefined if no iModel with that name exists.  */
  queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined>;

  /** create a new iModel. Returns the Guid of the newly created iModel */
  createNewIModel(arg: CreateNewIModelProps): Promise<GuidString>;

  /** delete an iModel  */
  deleteIModel(arg: IModelIdArg & { iTwinId: GuidString }): Promise<void>;
}
