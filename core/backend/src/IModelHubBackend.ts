/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HubAccess
 */

import { join } from "path";
import { AzureFileHandler } from "@bentley/backend-itwin-client";
import { assert, BentleyError, BriefcaseStatus, GuidString, IModelHubStatus, IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import {
  BriefcaseQuery, ChangeSet, ChangeSetQuery, ChangesType, CheckpointQuery, CheckpointV2, CheckpointV2Query, CodeQuery, IModelBankClient, IModelClient,
  IModelHubClient, IModelQuery, Lock, LockQuery, LockType, VersionQuery,
} from "@bentley/imodelhub-client";
import {
  BriefcaseIdValue, ChangesetFileProps, ChangesetId, ChangesetIndex, ChangesetProps, CodeProps, IModelError, IModelVersion, LocalDirName,
} from "@itwin/core-common";
import { ProgressCallback, UserCancelledError } from "@bentley/itwin-client";
import {
  AcquireNewBriefcaseIdArg, BriefcaseDbArg, BriefcaseIdArg, ChangesetArg, ChangesetRangeArg, CheckPointArg, CreateNewIModelProps, IModelIdArg,
  IModelNameArg, ITwinIdArg, LockProps, V2CheckpointAccessProps,
} from "./BackendHubAccess";
import { BriefcaseManager } from "./BriefcaseManager";
import { CheckpointProps } from "./CheckpointManager";
import { BriefcaseLocalValue, IModelDb, SnapshotDb, TokenArg } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";

/** @internal */
export class IModelHubBackend {

  private static _imodelClient?: IModelClient;
  private static _isIModelBankClient = false;
  private static changeSet0 = { id: "", changesType: 0, description: "revision0", parentId: "", briefcaseId: 0, pushDate: "", userCreated: "", index: 0 };

  public static setIModelClient(client?: IModelClient) {
    this._imodelClient = client;
    this._isIModelBankClient = client instanceof IModelBankClient;
  }

  public static get isUsingIModelBankClient(): boolean {
    return this._isIModelBankClient;
  }

  public static get iModelClient(): IModelClient {
    if (!this._imodelClient)
      this._imodelClient = new IModelHubClient(new AzureFileHandler());

    return this._imodelClient;
  }

  private static async getAccessToken(arg: TokenArg) {
    return arg.accessToken ?? await IModelHost.getAccessToken();
  }
  public static async getLatestChangeset(arg: IModelIdArg): Promise<ChangesetProps> {
    const accessToken = await this.getAccessToken(arg);
    const changeSets: ChangeSet[] = await this.iModelClient.changeSets.get(accessToken, arg.iModelId, new ChangeSetQuery().top(1).latest());
    return (changeSets.length === 0) ? this.changeSet0 : this.toChangeSetProps(changeSets[changeSets.length - 1]);
  }

  public static async getChangesetFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<ChangesetProps> {
    const accessToken = await this.getAccessToken(arg);
    const versions = await this.iModelClient.versions.get(accessToken, arg.iModelId, new VersionQuery().select("ChangeSetId").byName(arg.versionName));
    if (!versions[0] || !versions[0].changeSetId)
      throw new IModelError(IModelStatus.NotFound, `Named version ${arg.versionName} not found`);

    return this.queryChangeset({ ...arg, changeset: { id: versions[0].changeSetId } });
  }

  public static async getChangesetFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetProps> {
    const version = arg.version;
    if (version.isFirst)
      return this.queryChangeset({ ...arg, changeset: { index: 0 } });

    const asOf = version.getAsOfChangeSet();
    if (asOf)
      return this.queryChangeset({ ...arg, changeset: { id: asOf } });

    const versionName = version.getName();
    if (versionName)
      return this.getChangesetFromNamedVersion({ ...arg, versionName });

    return this.getLatestChangeset(arg);
  }

  public static async createNewIModel(arg: CreateNewIModelProps): Promise<GuidString> {
    if (this.isUsingIModelBankClient)
      throw new IModelError(IModelStatus.BadRequest, "This is a iModelHub only operation");

    const revision0 = join(IModelHost.cacheDir, "temp-revision0.bim");
    IModelJsFs.removeSync(revision0);
    if (!arg.revision0) { // if they didn't supply a revision0 file, create a blank one.
      const blank = SnapshotDb.createEmpty(revision0, { rootSubject: { name: arg.description ?? arg.iModelName } });
      blank.saveChanges();
      blank.close();
    } else {
      IModelJsFs.copySync(revision0, arg.revision0);
    }

    const nativeDb = IModelDb.openDgnDb({ path: revision0 }, OpenMode.ReadWrite);
    try {
      nativeDb.setITwinId(arg.iTwinId);
      // nativeDb.setDbGuid(this.iModelId); NEEDS_WORK - iModelHub should accept this value, not create it.
      nativeDb.saveChanges();
      nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
      nativeDb.saveLocalValue(BriefcaseLocalValue.NoLocking, arg.noLocks ? "true" : undefined);
      nativeDb.saveChanges();
    } finally {
      nativeDb.closeIModel();
    }

    const accessToken = await this.getAccessToken(arg);
    const hubIModel = await this.iModelClient.iModels.create(accessToken, arg.iTwinId, arg.iModelName, { path: revision0, description: arg.description });
    IModelJsFs.removeSync(revision0);
    return hubIModel.wsgId;
  }

  public static async deleteIModel(arg: IModelIdArg & ITwinIdArg): Promise<void> {
    const dirName = BriefcaseManager.getIModelPath(arg.iModelId);
    if (IModelJsFs.existsSync(dirName)) {
      IModelJsFs.purgeDirSync(dirName);
      IModelJsFs.rmdirSync(dirName);
    }

    const accessToken = await this.getAccessToken(arg);
    return this.iModelClient.iModels.delete(accessToken, arg.iTwinId, arg.iModelId);
  }

  public static async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    const accessToken = await this.getAccessToken(arg);
    const iModels = await this.iModelClient.iModels.get(accessToken, arg.iTwinId, new IModelQuery().byName(arg.iModelName));
    return iModels.length === 0 ? undefined : iModels[0].id!;
  }

  public static async pushChangeset(arg: IModelIdArg & { changesetProps: ChangesetFileProps }): Promise<ChangesetIndex> {
    const changeset = new ChangeSet();
    const changesetProps = arg.changesetProps;
    changeset.id = changesetProps.id;
    changeset.parentId = changesetProps.parentId;
    changeset.changesType = changesetProps.changesType as number;
    changeset.fileSize = changesetProps.size!.toString();
    changeset.description = changesetProps.description;
    changeset.briefcaseId = changesetProps.briefcaseId;
    if (changeset.description.length >= 255) {
      Logger.logWarning("imodelhub-access", `pushChanges - Truncating description to 255 characters. ${changeset.description}`);
      changeset.description = changeset.description.slice(0, 254);
    }

    const accessToken = await this.getAccessToken(arg);
    return +(await this.iModelClient.changeSets.create(accessToken, arg.iModelId, changeset, changesetProps.pathname)).index!;
  }

  /** Releases a briefcaseId from iModelHub. After this call it is illegal to generate changesets for the released briefcaseId.
   * @note generally, this method should not be called directly. Instead use [[deleteBriefcaseFiles]].
   * @see deleteBriefcaseFiles
   */
  public static async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    const { briefcaseId, iModelId } = arg;
    const accessToken = await this.getAccessToken(arg);
    try {
      await this.iModelClient.briefcases.get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId));
    } catch (error) {
      throw error;
    }

    await this.iModelClient.briefcases.delete(accessToken, iModelId, briefcaseId);
  }

  public static async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const accessToken = await this.getAccessToken(arg);
    const myHubBriefcases = await this.iModelClient.briefcases.get(accessToken, arg.iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
    const myBriefcaseIds: number[] = [];
    for (const hubBc of myHubBriefcases)
      myBriefcaseIds.push(hubBc.briefcaseId!); // save the list of briefcaseIds we already own.
    return myBriefcaseIds;
  }

  public static async acquireNewBriefcaseId(arg: AcquireNewBriefcaseIdArg): Promise<number> {
    const accessToken = await this.getAccessToken(arg);
    const briefcase = await this.iModelClient.briefcases.create(accessToken, arg.iModelId);

    if (!briefcase)
      throw new IModelError(BriefcaseStatus.CannotAcquire, "Could not acquire briefcase");

    return briefcase.briefcaseId!;
  }

  public static toChangeSetProps(cs: ChangeSet): ChangesetProps {
    return {
      id: cs.wsgId, parentId: cs.parentId ? cs.parentId : "", briefcaseId: cs.briefcaseId!, pushDate: cs.pushDate!,
      description: cs.description ?? "", changesType: (cs.changesType ?? ChangesType.Regular) as number, userCreated: cs.userCreated!,
      index: +cs.index!,
    };
  }
  private static toChangeSetFileProps(cs: ChangeSet, basePath: string): ChangesetFileProps {
    const csProps = this.toChangeSetProps(cs) as ChangesetFileProps;
    csProps.pathname = join(basePath, cs.fileName!);
    return csProps;
  }

  public static async downloadChangeset(arg: ChangesetArg & { targetDir: LocalDirName }): Promise<ChangesetFileProps> {
    const accessToken = await this.getAccessToken(arg);
    const changeSetsPath = BriefcaseManager.getChangeSetsPath(arg.iModelId);

    // NEEDS_WORK - allow download by index
    const cSet = await this.queryChangeset(arg);
    const changeSets = await this.iModelClient.changeSets.download(accessToken, arg.iModelId, new ChangeSetQuery().byId(cSet.id), changeSetsPath);
    if (undefined === changeSets)
      throw new IModelError(IModelStatus.NotFound, `Cannot download changeset`);

    return this.toChangeSetFileProps(changeSets[0], arg.targetDir);
  }

  public static async queryChangeset(arg: ChangesetArg): Promise<ChangesetProps> {
    const changeset = await this.tryQueryChangeset(arg);
    assert(undefined !== changeset);
    return changeset;
  }

  private static async tryQueryChangeset(arg: ChangesetArg): Promise<ChangesetProps | undefined> {
    const hasIndex = (undefined !== arg.changeset.index);
    if ((hasIndex && arg.changeset.index <= 0) || arg.changeset.id === "")
      return this.changeSet0;

    const query = new ChangeSetQuery();
    if (hasIndex)
      query.filter(`Index+eq+${arg.changeset.index}`);
    else
      query.byId(arg.changeset.id);

    const accessToken = await this.getAccessToken(arg);
    const changeSets = await this.iModelClient.changeSets.get(accessToken, arg.iModelId, query);
    if (undefined === changeSets)
      throw new IModelError(IModelStatus.NotFound, `Changeset not found`);

    return changeSets.length > 0 ? this.toChangeSetProps(changeSets[0]) : undefined;
  }

  private static async getParentChangesetId(arg: IModelIdArg, index: ChangesetIndex): Promise<ChangesetId | undefined> {
    if (index === 0)
      return "";

    const changeset = await this.tryQueryChangeset({ ...arg, changeset: { index } });
    return changeset?.parentId;
  }

  private static async getQueryFromRange(arg: ChangesetRangeArg): Promise<ChangeSetQuery | undefined> {
    const query = new ChangeSetQuery();
    if (!arg.range)
      return query; // returns all changesets

    const range = arg.range;
    const after = await this.getParentChangesetId(arg, range.first);
    if (undefined === after)
      return undefined;

    if (range.end === undefined)
      query.fromId(after); //
    else {
      const last = (await this.queryChangeset({ ...arg, changeset: { index: range.end } })).id;
      if (range.end === 0 || after === last)
        return undefined;
      query.betweenChangeSets(last, after); // note: weird order is necessary because second arg being blank means "from start"
    }

    return query;
  }

  /** queries for change sets in the specified range. */
  public static async queryChangesets(arg: ChangesetRangeArg): Promise<ChangesetProps[]> {
    const query = await this.getQueryFromRange(arg);
    const val: ChangesetProps[] = [];
    if (query) {
      const accessToken = await this.getAccessToken(arg);
      const changeSets = await this.iModelClient.changeSets.get(accessToken, arg.iModelId, query);

      for (const cs of changeSets)
        val.push(this.toChangeSetProps(cs));
    }
    return val;
  }

  /** Downloads change sets in the specified range. */
  public static async downloadChangesets(arg: ChangesetRangeArg & { targetDir: LocalDirName }): Promise<ChangesetFileProps[]> {
    const val: ChangesetFileProps[] = [];
    const query = await this.getQueryFromRange(arg);
    if (query) {
      const accessToken = await this.getAccessToken(arg);
      const changeSets = await this.iModelClient.changeSets.download(accessToken, arg.iModelId, query, arg.targetDir);

      for (const cs of changeSets)
        val.push(this.toChangeSetFileProps(cs, arg.targetDir));
    }
    return val;
  }

  public static async downloadV1Checkpoint(arg: CheckPointArg): Promise<ChangesetId> {
    const checkpoint = arg.checkpoint;
    let checkpointQuery = new CheckpointQuery().selectDownloadUrl();
    checkpointQuery = checkpointQuery.precedingCheckpoint(checkpoint.changeset.id);
    const accessToken = await this.getAccessToken(checkpoint);
    const checkpoints = await this.iModelClient.checkpoints.get(accessToken, checkpoint.iModelId, checkpointQuery);
    if (checkpoints.length !== 1)
      throw new IModelError(BriefcaseStatus.VersionNotFound, "no checkpoints not found");

    const cancelRequest: any = {};
    const progressCallback: ProgressCallback = (progress) => {
      if (arg.onProgress && arg.onProgress(progress.loaded, progress.total!) !== 0)
        cancelRequest.cancel?.();
    };

    await this.iModelClient.checkpoints.download(accessToken, checkpoints[0], arg.localFile, progressCallback, cancelRequest);
    return checkpoints[0].mergedChangeSetId!;
  }

  public static async queryV2Checkpoint(arg: CheckpointProps): Promise<V2CheckpointAccessProps | undefined> {
    const checkpointQuery = new CheckpointV2Query().byChangeSetId(arg.changeset.id).selectContainerAccessKey();
    const accessToken = await this.getAccessToken(arg);
    const checkpoints = await this.iModelClient.checkpointsV2.get(accessToken, arg.iModelId, checkpointQuery);
    if (checkpoints.length < 1)
      return undefined;

    const { containerAccessKeyContainer, containerAccessKeySAS, containerAccessKeyAccount, containerAccessKeyDbName } = checkpoints[0];
    if (!containerAccessKeyContainer || !containerAccessKeySAS || !containerAccessKeyAccount || !containerAccessKeyDbName)
      throw new Error("Invalid V2 checkpoint in iModelHub");

    return {
      container: containerAccessKeyContainer,
      auth: containerAccessKeySAS,
      user: containerAccessKeyAccount,
      dbAlias: containerAccessKeyDbName,
      storageType: "azure?sas=1",
    };
  }

  public static async downloadV2Checkpoint(arg: CheckPointArg): Promise<ChangesetId> {
    const checkpoint = arg.checkpoint;
    let checkpointQuery = new CheckpointV2Query();
    checkpointQuery = checkpointQuery.precedingCheckpointV2(checkpoint.changeset.id).selectContainerAccessKey();
    const accessToken = await this.getAccessToken(checkpoint);
    let checkpoints: CheckpointV2[] = [];
    try {
      checkpoints = await this.iModelClient.checkpointsV2.get(accessToken, checkpoint.iModelId, checkpointQuery);
    } catch (error) {
      if (error instanceof BentleyError && error.errorNumber === IModelHubStatus.Unknown)
        throw new IModelError(IModelStatus.NotFound, "V2 checkpoints not supported");
      throw error;
    }

    if (checkpoints.length !== 1)
      throw new IModelError(IModelStatus.NotFound, "V2 checkpoint not found");

    const { containerAccessKeyContainer, containerAccessKeySAS, containerAccessKeyAccount, containerAccessKeyDbName } = checkpoints[0];
    if (!containerAccessKeyContainer || !containerAccessKeySAS || !containerAccessKeyAccount || !containerAccessKeyDbName)
      throw new IModelError(IModelStatus.NotFound, "invalid V2 checkpoint");

    const downloader = new IModelHost.platform.DownloadV2Checkpoint({
      container: containerAccessKeyContainer,
      auth: containerAccessKeySAS,
      storageType: "azure?sas=1",
      user: containerAccessKeyAccount,
      dbAlias: containerAccessKeyDbName,
      writeable: false,
      localFile: arg.localFile,
    });

    let timer: NodeJS.Timeout | undefined;
    try {
      let total = 0;
      const onProgress = arg.onProgress;
      if (onProgress) {
        timer = setInterval(async () => { // set an interval timer to show progress every 250ms
          const progress = downloader.getProgress();
          total = progress.total;
          if (onProgress(progress.loaded, progress.total))
            downloader.cancelDownload();
        }, 250);
      }
      await downloader.downloadPromise;
      onProgress?.(total, total); // make sure we call progress func one last time when download completes
    } catch (err: any) {
      throw (err.message === "cancelled") ? new UserCancelledError(BriefcaseStatus.DownloadCancelled, "download cancelled") : err;
    } finally {
      if (timer)
        clearInterval(timer);
    }
    return checkpoints[0].changeSetId!;
  }

  public static async releaseAllLocks(arg: BriefcaseDbArg) {
    const accessToken = await this.getAccessToken(arg);
    return this.iModelClient.locks.deleteAll(accessToken, arg.iModelId, arg.briefcaseId);
  }

  public static async releaseAllCodes(arg: BriefcaseDbArg) {
    const accessToken = await this.getAccessToken(arg);
    return this.iModelClient.codes.deleteAll(accessToken, arg.iModelId, arg.briefcaseId);
  }

  public static async queryAllLocks(arg: BriefcaseDbArg): Promise<LockProps[]> {
    const accessToken = await this.getAccessToken(arg);
    const heldLocks = await this.iModelClient.locks.get(accessToken, arg.iModelId, new LockQuery().byBriefcaseId(arg.briefcaseId));
    return heldLocks.map((lock) => ({ id: lock.objectId!, state: lock.lockLevel! as number }));
  }

  public static async queryAllCodes(arg: BriefcaseDbArg): Promise<CodeProps[]> {
    const accessToken = await this.getAccessToken(arg);
    const reservedCodes = await this.iModelClient.codes.get(accessToken, arg.iModelId, new CodeQuery().byBriefcaseId(arg.briefcaseId));
    return reservedCodes.map((code) => ({ spec: code.codeSpecId!, scope: code.codeScope!, value: code.value! }));
  }

  public static toHubLock(arg: BriefcaseDbArg, reqLock: LockProps): Lock {
    const lock = new Lock();
    lock.briefcaseId = arg.briefcaseId;
    lock.lockLevel = reqLock.state as number;
    lock.lockType = LockType.Element;
    lock.objectId = reqLock.id;
    lock.releasedWithChangeSet = arg.changeset.id;
    lock.seedFileId = arg.iModelId;
    return lock;
  }

  public static toHubLocks(arg: BriefcaseDbArg & { locks: LockProps[] }): Lock[] {
    return arg.locks.map((lock) => this.toHubLock(arg, lock));
  }

  public static async acquireLocks(arg: BriefcaseDbArg & { locks: LockProps[] }): Promise<void> {
    const hubLocks = this.toHubLocks(arg);
    const accessToken = await this.getAccessToken(arg);
    await this.iModelClient.locks.update(accessToken, arg.iModelId, hubLocks);
  }
}
