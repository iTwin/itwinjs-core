/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore cset csets ecchanges

import {
  assert, BeDuration, BentleyError, ChangeSetApplyOption, ChangeSetStatus, ClientRequestContext, DbResult, GuidString, Id64, IModelHubStatus,
  IModelStatus, Logger, OpenMode, PerfLogger,
} from "@bentley/bentleyjs-core";
import {
  Briefcase, BriefcaseQuery, ChangeSet, ChangeSetQuery, ChangesType, ConflictingCodesError, HubCode, IModelHubError,
} from "@bentley/imodelhub-client";
import {
  BriefcaseIdValue,
  BriefcaseProps, BriefcaseStatus, CreateIModelProps, IModelError, IModelRpcOpenProps, IModelVersion, LocalBriefcaseProps, RequestNewBriefcaseProps,
} from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TelemetryEvent } from "@bentley/telemetry-client";
import * as os from "os";
import * as path from "path";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { CheckpointManager, ProgressFunction } from "./CheckpointManager";
import { BriefcaseDb, IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { UsageLoggingUtilities } from "./usage-logging/UsageLoggingUtilities";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The Id assigned to a briefcase by iModelHub, or a [[BriefcaseIdValue]] that identify special kinds of iModels.
 * @public
 */
export type BriefcaseId = number;

/** The argument for [[BriefcaseManager.downloadBriefcase]]
 * @beta
*/
export type RequestNewBriefcaseArg = RequestNewBriefcaseProps & {
  /** If present, a function called periodically during the download to indicate progress.
   * @note return non-zero from this function to abort the download.
   */
  onProgress?: ProgressFunction;
};

/** A token that represents a ChangeSet
 * @internal
 */
export class ChangeSetToken {
  constructor(public id: string, public parentId: string, public index: number, public pathname: string, public changeType: ChangesType, public pushDate?: string) { }
}

/** Utility to manage downloading Briefcases and applying and uploading changesets.
 * @beta
 */
export class BriefcaseManager {
  private static _firstChangeSetDir: string = "first";

  /** @internal
   * @note temporary, will be removed in 3.0
   * @deprecated
   */
  public static getCompatibilityPath(iModelId: GuidString): string { return path.join(this._compatibilityDir, iModelId, "bc"); }

  /** Get the local path of the folder storing files associated with an imodel */
  public static getIModelPath(iModelId: GuidString): string { return path.join(this._cacheDir, iModelId); }

  /** @internal */
  public static getChangeSetsPath(iModelId: GuidString): string { return path.join(this.getIModelPath(iModelId), "csets"); }

  /** @internal */
  public static getChangeCachePathName(iModelId: GuidString): string { return path.join(this.getIModelPath(iModelId), iModelId.concat(".bim.ecchanges")); }

  /** @internal */
  public static getChangedElementsPathName(iModelId: GuidString): string { return path.join(this.getIModelPath(iModelId), iModelId.concat(".bim.elems")); }

  private static _bcSubDir = "briefcases";
  /** @internal */
  public static getBriefcaseBasePath(iModelId: GuidString): string {
    return path.join(this.getIModelPath(iModelId), this._bcSubDir);
  }

  /** @internal */
  public static getChangeSetFolderNameFromId(changeSetId: GuidString): string {
    return changeSetId || this._firstChangeSetDir;
  }

  /** Get the name of the local file that holds, or will hold, a briefcase in the briefcase cache established in the call to [[BriefcaseManager.initialize]], based
 * on an iModelId and BriefcaseId.
 * @param briefcase the iModelId and BriefcaseId for the filename
 * @see getIModelPath
 */
  public static getFileName(briefcase: BriefcaseProps): string {
    return path.join(this.getBriefcaseBasePath(briefcase.iModelId), `${briefcase.briefcaseId}.bim`);
  }

  /** get the name for previous version of BriefcaseManager.
   * @note temporary, will be removed in 3.0
   * @deprecated
   * @internal
   */
  public static getCompatibilityFileName(briefcase: BriefcaseProps): string {
    // eslint-disable-next-line deprecation/deprecation
    return path.join(this.getCompatibilityPath(briefcase.iModelId), briefcase.briefcaseId === 0 ? "PullOnly" : "PullAndPush", briefcase.briefcaseId.toString(), "bc.bim");
  }

  private static setupCacheDir(cacheRootDir: string) {
    this._cacheDir = cacheRootDir;
    IModelJsFs.recursiveMkDirSync(this._cacheDir);
  }

  private static _compatibilityDir: string;
  private static _initialized?: boolean;
  /** Initialize BriefcaseManager
   * @param cacheRootDir The root directory for storing a cache of downloaded briefcase files. Briefcases are stored relative to this path in sub-folders organized by IModelId.
   * @note It is perfectly valid for applications to store briefcases in locations they manage, outside of `cacheRootDir`.
   */
  public static initialize(cacheRootDir: string, compatibilityDir: string) {
    if (this._initialized)
      return;
    this._compatibilityDir = compatibilityDir;
    this.setupCacheDir(cacheRootDir);
    IModelHost.onBeforeShutdown.addOnce(this.finalize, this);
    this._initialized = true;
  }

  private static finalize() {
    this._initialized = false;
  }

  /** Get a list of all local briefcase held in the system briefcase cache, optionally for a single iModelId
   * @param iModelId if present, only briefcases for this iModelId are returned
  */
  public static getCachedBriefcases(iModelId?: GuidString): LocalBriefcaseProps[] {
    const briefcaseList: LocalBriefcaseProps[] = [];
    const iModelDirs = IModelJsFs.readdirSync(this._cacheDir);
    for (const iModelDir of iModelDirs) {
      if (iModelId && iModelId !== iModelDir)
        continue;
      const bcPath = path.join(this._cacheDir, iModelDir, this._bcSubDir);
      try {
        if (!IModelJsFs.lstatSync(bcPath)?.isDirectory)
          continue;
      } catch (err) {
        continue;
      }

      const briefcases = IModelJsFs.readdirSync(bcPath);
      for (const briefcaseName of briefcases) {
        if (briefcaseName.endsWith(".bim")) {
          try {
            const fileName = path.join(bcPath, briefcaseName);
            const db = IModelDb.openDgnDb({ path: fileName }, OpenMode.Readonly);
            briefcaseList.push({ fileName, contextId: db.queryProjectGuid(), iModelId: db.getDbGuid(), briefcaseId: db.getBriefcaseId(), changeSetId: db.getParentChangeSetId() });
            db.closeIModel();
          } catch (_err) {
          }
        }
      }
    }
    return briefcaseList;
  }

  private static _cacheDir: string;
  /** Get the root directory for the briefcase cache */
  public static get cacheDir() { return this._cacheDir; }

  /** Get the index of the change set from its id */
  private static async getChangeSetIndexFromId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, changeSetId: GuidString): Promise<number> {
    requestContext.enter();
    if (changeSetId === "")
      return 0; // the first version

    const changeSet = (await IModelHost.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
    requestContext.enter();

    return +changeSet.index!;
  }

  /** Determine whether the supplied briefcaseId is a standalone briefcase */
  public static isStandaloneBriefcaseId(id: BriefcaseId) {
    // eslint-disable-next-line deprecation/deprecation
    return id === BriefcaseIdValue.Standalone || id === BriefcaseIdValue.DeprecatedStandalone;
  }

  /** Determine whether the supplied briefcaseId is in the range of BriefcaseIds issued by iModelHub
   * @note this does check whether the id was actually acquired by the caller.
   */
  public static isValidBriefcaseId(id: BriefcaseId) {
    return id >= BriefcaseIdValue.FirstValid && id <= BriefcaseIdValue.LastValid;
  }

  /** Acquire a new briefcaseId from iModelHub for the supplied iModelId
   * @throws IModelError if a new briefcaseId could not be acquired.
   */
  public static async acquireNewBriefcaseId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<number> {
    requestContext.enter();

    const briefcase = await IModelHost.iModelClient.briefcases.create(requestContext, iModelId);
    requestContext.enter();

    if (!briefcase) {
      // Could well be that the current user does not have the appropriate access
      throw new IModelError(BriefcaseStatus.CannotAcquire, "Could not acquire briefcase", Logger.logError, loggerCategory);
    }
    return briefcase.briefcaseId!;
  }

  /** Download a new briefcase from iModelHub for the supplied iModelId.
   *
   * The process of downloading a briefcase file involves first obtaining a valid BriefcaseId from IModelHub. For each IModel, IModelHub maintains
   * a list of BriefcaseIds assigned to users, to ensure that no two users have the same BriefcaseId. Typically a given user will have only
   * one briefcase on their machine for a given iModelId. Rarely, it may be necessary to use more than one briefcase to make isolated independent sets of changes,
   * but that is exceedingly complicated and rare. If no BriefcaseId is supplied, a new one is acquired from iModelHub.
   *
   * Then, a Checkpoint file (as of a ChangesetId, typically "Latest") is downloaded from IModelHub. After the download completes,
   * the briefcaseId in the local file is changed to acquired briefcaseId, changing the checkpoint file into a briefcase file.
   *
   * Each of these steps requires a valid `AuthorizedClientRequestContext` to provide the user's credentials for the requests.
   *
   * @param request The properties that specify the briefcase file to be downloaded.
   * @returns The properties of the local briefcase in a Promise that is resolved after the briefcase is fully downloaded and the briefcase file is ready for use via [BriefcaseDb.open]($backend).
   * @note The location of the local file to hold the briefcase is arbitrary and may be any valid *local* path on your machine. If you don't supply
   * a filename, the local briefcase cache is used by creating a file with the briefcaseId as its name in the `briefcases` folder below the folder named
   * for the IModelId.
   * @note *It is invalid to edit briefcases on a shared network drive* and that is a sure way to corrupt your briefcase (see https://www.sqlite.org/howtocorrupt.html)
   * @note The special briefcaseId [[BriefcaseIdValue.Standalone]] (0) can be used for a local briefcase that can accept changesets but may not be changed locally.
   * @see CheckpointManager.downloadCheckpoint
   */
  public static async downloadBriefcase(requestContext: AuthorizedClientRequestContext, request: RequestNewBriefcaseArg): Promise<LocalBriefcaseProps> {
    const briefcaseId = request.briefcaseId ?? await this.acquireNewBriefcaseId(requestContext, request.iModelId);
    const fileName = request.fileName ?? this.getFileName({ briefcaseId, iModelId: request.iModelId });
    const asOf = request.asOf ?? IModelVersion.latest().toJSON();

    const args = {
      localFile: fileName,
      checkpoint: {
        requestContext,
        contextId: request.contextId,
        iModelId: request.iModelId,
        changeSetId: (await this.evaluateVersion(requestContext, IModelVersion.fromJSON(asOf), request.iModelId)).changeSetId,
      },
      onProgress: request.onProgress,
    };

    await CheckpointManager.downloadCheckpoint(args);
    const response: LocalBriefcaseProps = {
      fileName,
      briefcaseId,
      iModelId: request.iModelId,
      contextId: request.contextId,
      changeSetId: args.checkpoint.changeSetId,
    };

    // now open the downloaded checkpoint and reset its BriefcaseId
    const nativeDb = new IModelHost.platform.DgnDb();
    const status = nativeDb.openIModel(fileName, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== status)
      throw new IModelError(status, `Could not open downloaded briefcase for write access: ${fileName}, err=${new BentleyError(status).name}`, Logger.logError);
    try {
      nativeDb.resetBriefcaseId(briefcaseId);
      if (nativeDb.getParentChangeSetId() !== args.checkpoint.changeSetId)
        throw new IModelError(IModelStatus.WrongIModel, `Downloaded briefcase has wrong changesetId: ${fileName}`, Logger.logError);
    } finally {
      nativeDb.closeIModel();
    }
    return response;
  }

  /** Deletes change sets of an iModel from local disk */
  public static deleteChangeSetsFromLocalDisk(iModelId: string) {
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);
    if (BriefcaseManager.deleteFolderAndContents(changeSetsPath))
      Logger.logTrace(loggerCategory, "Deleted change sets from local disk", () => ({ iModelId, changeSetsPath }));
  }

  public static async releaseBriefcase(requestContext: AuthorizedClientRequestContext, briefcase: BriefcaseProps): Promise<void> {
    requestContext.enter();
    const { briefcaseId, iModelId } = briefcase;
    if (!this.isValidBriefcaseId(briefcaseId))
      return;

    try {
      await IModelHost.iModelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().byId(briefcaseId));
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Could not find briefcase to release", () => ({ iModelId, briefcaseId }));
      throw error;
    }

    await IModelHost.iModelClient.briefcases.delete(requestContext, iModelId, briefcaseId);
    requestContext.enter();
    Logger.logTrace(loggerCategory, "Released briefcase from the server", () => ({ iModelId, briefcaseId }));
  }

  /**
   * Delete all files associated with a local briefcase. First releases the BriefcaseId from iModelHub, if a requestContext is supplied.
   * @param filePath the full file name of the Briefcase to delete
   * @param requestContext context to delete
   * @throws [[IModelError]] If unable to delete the briefcase
   */
  public static async deleteBriefcaseFiles(filePath: string, requestContext?: AuthorizedClientRequestContext): Promise<void> {
    try {
      const db = IModelDb.openDgnDb({ path: filePath }, OpenMode.Readonly);
      const briefcase: BriefcaseProps = {
        iModelId: db.getDbGuid(),
        briefcaseId: db.getBriefcaseId(),
      };
      db.closeIModel();

      if (requestContext) {
        requestContext.enter();
        if (this.isValidBriefcaseId(briefcase.briefcaseId)) {
          await BriefcaseManager.releaseBriefcase(requestContext, briefcase);
          requestContext.enter();
        }
      }
    } catch (error) {
    }

    // first try to delete the briefcase file
    try {
      if (IModelJsFs.existsSync(filePath))
        IModelJsFs.unlinkSync(filePath);
    } catch (err) {
      throw new IModelError(IModelStatus.BadRequest, `cannot delete briefcase file ${err}`);
    }

    // next, delete all files that start with the briefcase's filePath (e.g. "a.bim-locks", "a.bim-journal", etc.)
    try {
      const dirName = path.dirname(filePath);
      const fileName = path.basename(filePath);
      const files = IModelJsFs.readdirSync(dirName);
      for (const file of files) {
        if (file.startsWith(fileName))
          this.deleteFile(path.join(dirName, file)); // don't throw on error
      }
    } catch (err) {
    }
  }

  private static async downloadChangeSetsInternal(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, query: ChangeSetQuery): Promise<ChangeSet[]> {
    requestContext.enter();
    const changeSetsPath: string = BriefcaseManager.getChangeSetsPath(iModelId);

    Logger.logTrace(loggerCategory, "Started downloading change sets", () => ({ iModelId }));
    const perfLogger = new PerfLogger("Downloading change sets", () => ({ iModelId }));
    let changeSets;
    try {
      changeSets = await IModelHost.iModelClient.changeSets.download(requestContext, iModelId, query, changeSetsPath);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Error downloading changesets", () => ({ iModelId }));
      throw error;
    }
    perfLogger.dispose();
    Logger.logTrace(loggerCategory, "Finished downloading change sets", () => ({ iModelId }));
    return changeSets;
  }

  /** Downloads change sets in the specified range.
   *  * Downloads change sets *after* the specified fromChangeSetId, up to and including the toChangeSetId
   *  * If the ids are the same returns an empty array.
   * @internal
   */
  public static async downloadChangeSets(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, fromChangeSetId: string, toChangeSetId: string): Promise<ChangeSet[]> {
    requestContext.enter();

    if (toChangeSetId === "" /* first version */ || fromChangeSetId === toChangeSetId)
      return new Array<ChangeSet>();

    const query = new ChangeSetQuery();
    query.betweenChangeSets(toChangeSetId, fromChangeSetId);

    return BriefcaseManager.downloadChangeSetsInternal(requestContext, iModelId, query);
  }

  /** Deletes a file
   *  - Does not throw any error, but logs it instead
   *  - Returns true if the delete was successful
   */
  private static deleteFile(pathname: string): boolean {
    try {
      IModelJsFs.unlinkSync(pathname);
    } catch (error) {
      Logger.logError(loggerCategory, `Cannot delete file ${pathname}, ${error}`);
      return false;
    }
    return true;
  }

  /** Deletes a folder, checking if it's empty
   *  - Does not throw any error, but logs it instead
   *  - Returns true if the delete was successful
   */
  private static deleteFolderIfEmpty(folderPathname: string): boolean {
    try {
      const files = IModelJsFs.readdirSync(folderPathname);
      if (files.length > 0)
        return false;

      IModelJsFs.rmdirSync(folderPathname);
    } catch (error) {
      Logger.logError(loggerCategory, `Cannot delete folder: ${folderPathname}`);
      return false;
    }
    return true;
  }

  /** Deletes the contents of a folder, but not the folder itself
   *  - Does not throw any errors, but logs them.
   *  - returns true if the delete was successful.
   */
  private static deleteFolderContents(folderPathname: string): boolean {
    if (!IModelJsFs.existsSync(folderPathname))
      return false;

    let status = true;
    const files = IModelJsFs.readdirSync(folderPathname);
    for (const file of files) {
      const curPath = path.join(folderPathname, file);
      const locStatus = (IModelJsFs.lstatSync(curPath)!.isDirectory) ? BriefcaseManager.deleteFolderAndContents(curPath) : BriefcaseManager.deleteFile(curPath);
      if (!locStatus)
        status = false;
    }
    return status;
  }

  /** Deletes a folder and all it's contents.
   *  - Does not throw any errors, but logs them.
   *  - returns true if the delete was successful.
   */
  private static deleteFolderAndContents(folderPathname: string): boolean {
    if (!IModelJsFs.existsSync(folderPathname))
      return true;

    let status = false;
    status = BriefcaseManager.deleteFolderContents(folderPathname);
    if (!status)
      return false;

    status = BriefcaseManager.deleteFolderIfEmpty(folderPathname);
    return status;
  }

  /** @internal */
  public static async evaluateVersion(requestContext: AuthorizedClientRequestContext, version: IModelVersion, iModelId: string): Promise<{ changeSetId: string, changeSetIndex: number }> {
    requestContext.enter();

    const changeSetId = await version.evaluateChangeSet(requestContext, iModelId, IModelHost.iModelClient);
    requestContext.enter();

    const changeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, iModelId, changeSetId);
    return { changeSetId, changeSetIndex };
  }

  /** Processes (merges, reverses, reinstates) change sets to get the briefcase to the specified target version.
   * Note: The briefcase must have been opened ReadWrite, and the method keeps it in the same state.
   */
  public static async processChangeSets(requestContext: AuthorizedClientRequestContext, db: IModelDb, targetChangeSetId: string, targetChangeSetIndex?: number): Promise<void> {
    requestContext.enter();

    if (!db.isOpen || db.nativeDb.isReadonly()) // don't use db.isReadonly - we reopen the file writable just for this operation but db.isReadonly is still true
      throw new IModelError(ChangeSetStatus.ApplyError, "Briefcase must be open ReadWrite to process change sets", Logger.logError, loggerCategory, () => db.getRpcProps());

    if (undefined === targetChangeSetIndex)
      targetChangeSetIndex = await this.getChangeSetIndexFromId(requestContext, db.iModelId, targetChangeSetId);
    const parentChangeSetId = db.nativeDb.getParentChangeSetId();
    const parentChangeSetIndex = await this.getChangeSetIndexFromId(requestContext, db.iModelId, parentChangeSetId);
    requestContext.enter();

    // Determine the reinstates, reversals or merges required
    let reverseToId: string | undefined, reinstateToId: string | undefined, mergeToId: string | undefined;
    let reverseToIndex: number | undefined, reinstateToIndex: number | undefined, mergeToIndex: number | undefined;
    const reversedChangeSetId = db.nativeDb.getReversedChangeSetId();
    if (undefined !== reversedChangeSetId) {
      const reversedChangeSetIndex = await BriefcaseManager.getChangeSetIndexFromId(requestContext, db.iModelId, reversedChangeSetId);
      if (targetChangeSetIndex < reversedChangeSetIndex) {
        reverseToId = targetChangeSetId;
        reverseToIndex = targetChangeSetIndex;
      } else if (targetChangeSetIndex > reversedChangeSetIndex) {
        reinstateToId = targetChangeSetId;
        reinstateToIndex = targetChangeSetIndex;
        if (targetChangeSetIndex > parentChangeSetIndex) {
          reinstateToId = parentChangeSetId;
          reinstateToIndex = parentChangeSetIndex;
          mergeToId = targetChangeSetId;
          mergeToIndex = targetChangeSetIndex;
        }
      }
    } else {
      if (targetChangeSetIndex < parentChangeSetIndex) {
        reverseToId = targetChangeSetId;
        reverseToIndex = targetChangeSetIndex;
      } else if (targetChangeSetIndex > parentChangeSetIndex) {
        mergeToId = targetChangeSetId;
        mergeToIndex = targetChangeSetIndex;
      }
    }
    if (typeof reverseToId === "undefined" && typeof reinstateToId === "undefined" && typeof mergeToId === "undefined")
      return;

    // Reverse, reinstate and merge as necessary
    const perfLogger = new PerfLogger("Processing change sets", () => ({ ...db.getRpcProps(), targetChangeSetId, targetChangeSetIndex }));
    try {
      if (typeof reverseToId !== "undefined") {
        Logger.logTrace(loggerCategory, "Started reversing changes to the briefcase", () => ({ reverseToId, ...db.getRpcProps() }));
        await BriefcaseManager.applyChangeSets(requestContext, db, reverseToId, reverseToIndex!, ChangeSetApplyOption.Reverse);
        requestContext.enter();
        Logger.logTrace(loggerCategory, "Finished reversing changes to the briefcase", () => ({ reverseToId, ...db.getRpcProps() }));
      }
      if (typeof reinstateToId !== "undefined") {
        Logger.logTrace(loggerCategory, "Started reinstating changes to the briefcase", () => ({ reinstateToId, ...db.getRpcProps() }));
        await BriefcaseManager.applyChangeSets(requestContext, db, reinstateToId, reinstateToIndex!, ChangeSetApplyOption.Reinstate);
        requestContext.enter();
        Logger.logTrace(loggerCategory, "Finished reinstating changes to the briefcase", () => ({ reinstateToId, ...db.getRpcProps() }));
      }
      if (typeof mergeToId !== "undefined") {
        Logger.logTrace(loggerCategory, "BriefcaseManager.processChangeSets: Started merging changes to the briefcase", () => ({ mergeToId, ...db.getRpcProps() }));
        await BriefcaseManager.applyChangeSets(requestContext, db, mergeToId, mergeToIndex!, ChangeSetApplyOption.Merge);
        requestContext.enter();
        Logger.logTrace(loggerCategory, "BriefcaseManager.processChangeSets: Finished merging changes to the briefcase", () => ({ mergeToId, ...db.getRpcProps() }));
      }
    } finally {
      perfLogger.dispose();
    }
  }

  private static async applyChangeSets(requestContext: AuthorizedClientRequestContext, db: IModelDb, targetChangeSetId: string, targetChangeSetIndex: number, processOption: ChangeSetApplyOption): Promise<void> {
    requestContext.enter();

    const currentChangeSetId = db.changeSetId!;
    const currentChangeSetIndex = await this.getChangeSetIndexFromId(requestContext, db.iModelId, currentChangeSetId);
    if (targetChangeSetIndex === currentChangeSetIndex)
      return; // nothing to apply

    // Download change sets
    const reverse = (targetChangeSetIndex < currentChangeSetIndex);
    const changeSets = await BriefcaseManager.downloadChangeSets(requestContext, db.iModelId, reverse ? targetChangeSetId : currentChangeSetId, reverse ? currentChangeSetId : targetChangeSetId);
    requestContext.enter();
    assert(changeSets.length <= Math.abs(targetChangeSetIndex - currentChangeSetIndex));
    if (reverse)
      changeSets.reverse();

    // Gather the changeset tokens
    const changeSetTokens = new Array<ChangeSetToken>();
    const changeSetsPath = BriefcaseManager.getChangeSetsPath(db.iModelId);
    let maxFileSize: number = 0;
    let containsSchemaChanges = false;
    changeSets.forEach((changeSet: ChangeSet) => {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      assert(IModelJsFs.existsSync(changeSetPathname), `Change set file ${changeSetPathname} does not exist`);
      const changeSetToken = new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType!);
      changeSetTokens.push(changeSetToken);
      if (+changeSet.fileSize! > maxFileSize)
        maxFileSize = +changeSet.fileSize!;
      if (changeSet.changesType === ChangesType.Schema)
        containsSchemaChanges = true;
    });

    /* Apply change sets
     * If any of the change sets contain schema changes, or are otherwise too large, we process them asynchronously
     * to avoid blocking the main-thread/event-loop and keep the backend responsive. However, this will be an invasive
     * operation that will force the Db to be closed and reopened.
     * If the change sets are processed synchronously, they are applied one-by-one to avoid blocking the main
     * thread and the event loop. Even so, if any single change set too long to process that will again cause the
     * cause the event loop to be blocked. Also if any of the change sets contain schema changes, that will cause
     * the Db to be closed and reopened.
     */
    const perfLogger = new PerfLogger("Applying change sets", () => ({ ...db.getRpcProps() }));
    let status: ChangeSetStatus;
    if (containsSchemaChanges || maxFileSize > 1024 * 1024) {
      status = await this.applyChangeSetsToNativeDbAsync(requestContext, db, changeSetTokens, processOption);
      requestContext.enter();
    } else {
      status = await this.applyChangeSetsToNativeDbSync(db, changeSetTokens, processOption);
    }
    perfLogger.dispose();

    if (ChangeSetStatus.Success !== status)
      throw new IModelError(status, "Error applying changesets", Logger.logError, loggerCategory, () => ({ ...db.getRpcProps(), targetChangeSetId, targetChangeSetIndex }));

    // notify listeners
    db.notifyChangesetApplied();
  }

  /** Apply change sets synchronously
   * - change sets are applied one-by-one to avoid blocking the main thread
   * - must NOT be called if some of the change sets are too large since that will also block the main thread and leave the backend unresponsive
   * - may cause the Db to close and reopen *if* the change sets contain schema changes
   */
  private static async applyChangeSetsToNativeDbSync(db: IModelDb, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): Promise<ChangeSetStatus> {
    // Apply the changes (one by one to avoid blocking the event loop)
    for (const changeSetToken of changeSetTokens) {
      const tempChangeSetTokens = new Array<ChangeSetToken>(changeSetToken);
      const status = IModelHost.platform.ApplyChangeSetsRequest.doApplySync(db.nativeDb, JSON.stringify(tempChangeSetTokens), processOption);
      if (ChangeSetStatus.Success !== status)
        return status;
      await BeDuration.wait(0); // Just turns this operation asynchronous to avoid blocking the event loop
    }
    return ChangeSetStatus.Success;
  }

  /** Apply change sets asynchronously
   * - invasive operation that closes/reopens the Db
   * - must be called if some of the change sets are too large and the synchronous call will leave the backend unresponsive
   */
  private static async applyChangeSetsToNativeDbAsync(requestContext: AuthorizedClientRequestContext, db: IModelDb, changeSetTokens: ChangeSetToken[], processOption: ChangeSetApplyOption): Promise<ChangeSetStatus> {
    requestContext.enter();

    const applyRequest = new IModelHost.platform.ApplyChangeSetsRequest(db.nativeDb);

    let status: ChangeSetStatus = applyRequest.readChangeSets(JSON.stringify(changeSetTokens));
    if (status !== ChangeSetStatus.Success)
      return status;

    db.clearCaches();
    applyRequest.closeBriefcase();

    const doApply = new Promise<ChangeSetStatus>((resolve, _reject) => {
      applyRequest.doApplyAsync(resolve, processOption);
    });
    status = await doApply;
    requestContext.enter();

    const result = applyRequest.reopenBriefcase(db.openMode);
    if (result !== DbResult.BE_SQLITE_OK)
      status = ChangeSetStatus.ApplyError;

    return status;
  }

  /** @internal */
  public static async reverseChanges(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, reverseToVersion: IModelVersion): Promise<void> {
    requestContext.enter();
    if (db.openMode === OpenMode.Readonly)
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse changes in a ReadOnly briefcase", Logger.logError, loggerCategory, () => db.getRpcProps());

    const { changeSetId: targetChangeSetId, changeSetIndex: targetChangeSetIndex } = await BriefcaseManager.evaluateVersion(requestContext, reverseToVersion, db.iModelId);
    const currentChangeSetIndex = await this.getChangeSetIndexFromId(requestContext, db.iModelId, db.changeSetId);

    requestContext.enter();
    if (targetChangeSetIndex > currentChangeSetIndex)
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reverse to a later version", Logger.logError, loggerCategory, () => ({ ...db.getRpcProps(), targetChangeSetId, targetChangeSetIndex }));

    return BriefcaseManager.processChangeSets(requestContext, db, targetChangeSetId, targetChangeSetIndex);
  }

  /** @internal */
  public static async reinstateChanges(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, reinstateToVersion?: IModelVersion): Promise<void> {
    requestContext.enter();
    if (db.openMode === OpenMode.Readonly)
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot reinstate changes in a ReadOnly briefcase", Logger.logError, loggerCategory, () => db.getRpcProps());

    const targetVersion: IModelVersion = reinstateToVersion || IModelVersion.asOfChangeSet(db.nativeDb.getParentChangeSetId());

    const { changeSetId: targetChangeSetId, changeSetIndex: targetChangeSetIndex } = await BriefcaseManager.evaluateVersion(requestContext, targetVersion, db.iModelId);
    requestContext.enter();
    const currentChangeSetIndex = await this.getChangeSetIndexFromId(requestContext, db.iModelId, db.changeSetId);
    if (targetChangeSetIndex < currentChangeSetIndex)
      throw new IModelError(ChangeSetStatus.ApplyError, "Can reinstate only to a later version", Logger.logError, loggerCategory, () => ({ ...db.getRpcProps(), targetChangeSetId, targetChangeSetIndex }));

    return BriefcaseManager.processChangeSets(requestContext, db, targetChangeSetId, targetChangeSetIndex);
  }

  /** Pull and merge changes from the hub
   * @param requestContext The client request context
   * @param briefcase Local briefcase
   * @param mergeToVersion Version of the iModel to merge until.
   * @internal
   */
  public static async pullAndMergeChanges(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, mergeToVersion: IModelVersion = IModelVersion.latest()): Promise<void> {
    requestContext.enter();

    const { changeSetId: targetChangeSetId, changeSetIndex: targetChangeSetIndex } = await BriefcaseManager.evaluateVersion(requestContext, mergeToVersion, db.iModelId);
    const currentChangeSetIndex = await this.getChangeSetIndexFromId(requestContext, db.iModelId, db.changeSetId);
    requestContext.enter();
    if (targetChangeSetIndex < currentChangeSetIndex)
      throw new IModelError(ChangeSetStatus.NothingToMerge, "Nothing to merge", Logger.logError, loggerCategory, () => ({ ...db.getRpcProps(), targetChangeSetId, targetChangeSetIndex }));

    await BriefcaseManager.updatePendingChangeSets(requestContext, db);
    requestContext.enter();

    return BriefcaseManager.processChangeSets(requestContext, db, targetChangeSetId, targetChangeSetIndex);
  }

  private static startCreateChangeSet(db: BriefcaseDb): ChangeSetToken {
    const res: IModelJsNative.ErrorStatusOrResult<ChangeSetStatus, string> = db.nativeDb.startCreateChangeSet();
    if (res.error)
      throw new IModelError(res.error.status, "Error in startCreateChangeSet", Logger.logError, loggerCategory, () => db.getRpcProps());
    return JSON.parse(res.result!);
  }

  private static finishCreateChangeSet(db: BriefcaseDb) {
    const status = db.nativeDb.finishCreateChangeSet();
    if (ChangeSetStatus.Success !== status)
      throw new IModelError(status, "Error in finishCreateChangeSet", Logger.logError, loggerCategory, () => db.getRpcProps());
  }

  private static abandonCreateChangeSet(db: BriefcaseDb) {
    db.nativeDb.abandonCreateChangeSet();
  }

  /** Get array of pending ChangeSet ids that need to have their codes updated */
  private static getPendingChangeSets(db: BriefcaseDb): string[] {
    const res: IModelJsNative.ErrorStatusOrResult<DbResult, string> = db.nativeDb.getPendingChangeSets();
    if (res.error)
      throw new IModelError(res.error.status, "Error in getPendingChangeSets", Logger.logWarning, loggerCategory, () => db.getRpcProps());
    return JSON.parse(res.result!) as string[];
  }

  /** Add a pending ChangeSet before updating its codes */
  private static addPendingChangeSet(db: BriefcaseDb, changeSetId: string): void {
    const result = db.nativeDb.addPendingChangeSet(changeSetId);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Error in addPendingChangeSet", Logger.logError, loggerCategory, () => db.getRpcProps());
  }

  /** Remove a pending ChangeSet after its codes have been updated */
  private static removePendingChangeSet(db: BriefcaseDb, changeSetId: string): void {
    const result = db.nativeDb.removePendingChangeSet(changeSetId);
    if (DbResult.BE_SQLITE_OK !== result)
      throw new IModelError(result, "Error in removePendingChangeSet", Logger.logError, loggerCategory, () => db.getRpcProps());
  }

  /** Update codes for all pending ChangeSets */
  private static async updatePendingChangeSets(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb): Promise<void> {
    requestContext.enter();

    let pendingChangeSets = BriefcaseManager.getPendingChangeSets(db);
    if (pendingChangeSets.length === 0)
      return;

    pendingChangeSets = pendingChangeSets.slice(0, 100);

    const query = new ChangeSetQuery().filter(`$id+in+[${pendingChangeSets.map((value: string) => `'${value}'`).join(",")}]`).selectDownloadUrl();
    const changeSets = await BriefcaseManager.downloadChangeSetsInternal(requestContext, db.iModelId, query);
    requestContext.enter();

    const changeSetsPath = BriefcaseManager.getChangeSetsPath(db.iModelId);

    for (const changeSet of changeSets) {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      const token = new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType!);
      try {
        const codes = BriefcaseManager.extractCodesFromFile(db, [token]);
        await IModelHost.iModelClient.codes.update(requestContext, db.iModelId, codes, { deniedCodes: true, continueOnConflict: true });
        requestContext.enter();
        BriefcaseManager.removePendingChangeSet(db, token.id);
      } catch (error) {
        if (error instanceof ConflictingCodesError)
          BriefcaseManager.removePendingChangeSet(db, token.id);
      }
    }
  }

  /** Parse Code array from json */
  private static parseCodesFromJson(db: BriefcaseDb, json: string): HubCode[] {
    return JSON.parse(json, (key: any, value: any) => {
      if (key === "state") {
        return (value as number);
      }
      // If the key is a number, it is an array member.
      if (!Number.isNaN(Number.parseInt(key, 10))) {
        const code = new HubCode();
        Object.assign(code, value);
        code.codeSpecId = Id64.fromJSON(value.codeSpecId);
        code.briefcaseId = db.briefcaseId;
        return code;
      }
      return value;
    }) as HubCode[];
  }

  /** Extracts codes from current ChangeSet */
  private static extractCodes(db: BriefcaseDb): HubCode[] {
    const res: IModelJsNative.ErrorStatusOrResult<DbResult, string> = db.nativeDb.extractCodes();
    if (res.error)
      throw new IModelError(res.error.status, "Error in extractCodes", Logger.logError, loggerCategory, () => db.getRpcProps());
    return BriefcaseManager.parseCodesFromJson(db, res.result!);
  }

  /** Extracts codes from ChangeSet file */
  private static extractCodesFromFile(db: BriefcaseDb, changeSetTokens: ChangeSetToken[]): HubCode[] {
    const res: IModelJsNative.ErrorStatusOrResult<DbResult, string> = db.nativeDb.extractCodesFromFile(JSON.stringify(changeSetTokens));
    if (res.error)
      throw new IModelError(res.error.status, "Error in extractCodesFromFile", Logger.logError, loggerCategory, () => db.getRpcProps());
    return BriefcaseManager.parseCodesFromJson(db, res.result!);
  }

  /** Attempt to update codes without rejecting so pull wouldn't fail */
  private static async tryUpdatingCodes(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, changeSet: ChangeSet, relinquishCodesLocks: boolean): Promise<void> {
    requestContext.enter();

    // Add ChangeSet id, in case updating failed due to something else than conflicts
    BriefcaseManager.addPendingChangeSet(db, changeSet.id!);

    let failedUpdating = false;
    try {
      await IModelHost.iModelClient.codes.update(requestContext, db.iModelId, BriefcaseManager.extractCodes(db), { deniedCodes: true, continueOnConflict: true });
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      if (error instanceof ConflictingCodesError) {
        Logger.logError(loggerCategory, "Found conflicting codes when pushing briefcase changes", () => db.getRpcProps());
      } else {
        failedUpdating = true;
      }
    }

    // Cannot retry relinquishing later, ignore error
    try {
      if (relinquishCodesLocks) {
        await IModelHost.iModelClient.codes.deleteAll(requestContext, db.iModelId, db.briefcaseId);
        requestContext.enter();

        await IModelHost.iModelClient.locks.deleteAll(requestContext, db.iModelId, db.briefcaseId);
        requestContext.enter();
      }
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, `Relinquishing codes or locks has failed with: ${error}`, () => db.getRpcProps());
    }

    // Remove ChangeSet id if it succeeded or failed with conflicts
    if (!failedUpdating)
      BriefcaseManager.removePendingChangeSet(db, changeSet.id!);
  }

  /** Attempt to push a ChangeSet to iModelHub */
  private static async pushChangeSet(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, description: string, changeType: ChangesType, relinquishCodesLocks: boolean): Promise<void> {
    requestContext.enter();

    const changeSetToken: ChangeSetToken = BriefcaseManager.startCreateChangeSet(db);
    const changeSet = new ChangeSet();
    changeSet.briefcaseId = db.briefcaseId;
    changeSet.id = changeSetToken.id;
    changeSet.parentId = changeSetToken.parentId;
    changeSet.changesType = changeSetToken.changeType === ChangesType.Schema ? ChangesType.Schema : changeType;
    changeSet.fileSize = IModelJsFs.lstatSync(changeSetToken.pathname)!.size.toString();
    changeSet.description = description;
    if (changeSet.description.length >= 255) {
      Logger.logWarning(loggerCategory, `pushChanges - Truncating description to 255 characters. ${changeSet.description}`, () => db.getRpcProps());
      changeSet.description = changeSet.description.slice(0, 254);
    }

    try {
      await IModelHost.iModelClient.changeSets.create(requestContext, db.iModelId, changeSet, changeSetToken.pathname);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      // If ChangeSet already exists, updating codes and locks might have timed out.
      if (!(error instanceof IModelHubError) || error.errorNumber !== IModelHubStatus.ChangeSetAlreadyExists) {
        throw error;
      }
    }

    await BriefcaseManager.tryUpdatingCodes(requestContext, db, changeSet, relinquishCodesLocks);
    requestContext.enter();

    BriefcaseManager.finishCreateChangeSet(db);
  }

  /** Attempt to pull merge and push once */
  private static async pushChangesOnce(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, description: string, changeType: ChangesType, relinquishCodesLocks: boolean): Promise<void> {
    await BriefcaseManager.pullAndMergeChanges(requestContext, db, IModelVersion.latest());
    requestContext.enter();

    try {
      await BriefcaseManager.pushChangeSet(requestContext, db, description, changeType, relinquishCodesLocks);
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      BriefcaseManager.abandonCreateChangeSet(db);
      throw err;
    }
  }

  /** Return true to attempt pushing again. */
  private static shouldRetryPush(error: any): boolean {
    if (error instanceof IModelHubError && error.errorNumber) {
      switch (error.errorNumber) {
        case IModelHubStatus.AnotherUserPushing:
        case IModelHubStatus.PullIsRequired:
        case IModelHubStatus.DatabaseTemporarilyLocked:
        case IModelHubStatus.OperationFailed:
          return true;
      }
    }
    return false;
  }

  /** Push local changes to the hub
   * @param requestContext The client request context
   * @param briefcase Identifies the IModelDb that contains the pending changes.
   * @param description a description of the changeset that is to be pushed.
   * @param relinquishCodesLocks release locks held and codes reserved (but not used) after pushing?
   * @internal
   */
  public static async pushChanges(requestContext: AuthorizedClientRequestContext, db: BriefcaseDb, description: string, changeType: ChangesType = ChangesType.Regular, relinquishCodesLocks: boolean = true): Promise<void> {
    requestContext.enter();
    for (let i = 0; i < 5; ++i) {
      let pushed = false;
      let error: any;
      try {
        await BriefcaseManager.pushChangesOnce(requestContext, db, description, changeType, relinquishCodesLocks);
        requestContext.enter();
        pushed = true;
      } catch (err) {
        requestContext.enter();
        error = err;
      }
      if (pushed)
        return;

      if (!BriefcaseManager.shouldRetryPush(error)) {
        throw error;
      }
      const delay = Math.floor(Math.random() * 4800) + 200;
      await new Promise((resolve: any) => setTimeout(resolve, delay));
    }
  }

  /** Create an iModel on iModelHub
   * @beta
   */
  public static async create(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelName: GuidString, args: CreateIModelProps): Promise<GuidString> {
    requestContext.enter();
    if (IModelHost.isUsingIModelBankClient) {
      throw new IModelError(IModelStatus.BadRequest, "This is a iModelHub only operation", Logger.logError, loggerCategory, () => ({ contextId, iModelName }));
    }
    const hubIModel = await IModelHost.iModelClient.iModels.create(requestContext, contextId, iModelName, { description: args.rootSubject.description });
    return hubIModel.wsgId;
  }

  /** @internal */
  // TODO: This should take contextId as an argument, so that we know which server (iModelHub or iModelBank) to use.
  public static async deleteAllBriefcases(requestContext: AuthorizedClientRequestContext, iModelId: GuidString) {
    requestContext.enter();
    if (IModelHost.iModelClient === undefined)
      return;

    const promises = new Array<Promise<void>>();
    const briefcases = await IModelHost.iModelClient.briefcases.get(requestContext, iModelId);
    requestContext.enter();

    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(IModelHost.iModelClient.briefcases.delete(requestContext, iModelId, briefcase.briefcaseId!).then(() => {
        requestContext.enter();
      }));
    });
    return Promise.all(promises);
  }

  public static logUsage(requestContext: ClientRequestContext, token: IModelRpcOpenProps) {
    // NEEDS_WORK: Move usage logging to the native layer, and make it happen even if not authorized
    if (!(requestContext instanceof AuthorizedClientRequestContext)) {
      Logger.logTrace(loggerCategory, "Cannot log usage without appropriate authorization", () => token);
      return;
    }

    requestContext.enter();
    const telemetryEvent = new TelemetryEvent(
      "imodeljs-backend - Open iModel",
      "7a6424d1-2114-4e89-b13b-43670a38ccd4", // Feature: "iModel Use"
      token.contextId,
      token.iModelId,
      token.changeSetId,
    );
    IModelHost.telemetry.postTelemetry(requestContext, telemetryEvent); // eslint-disable-line @typescript-eslint/no-floating-promises

    UsageLoggingUtilities.postUserUsage(requestContext, token.contextId!, IModelJsNative.AuthType.OIDC, os.hostname(), IModelJsNative.UsageType.Trial)
      .catch((err) => {
        requestContext.enter();
        Logger.logError(loggerCategory, `Could not log user usage`, () => ({ errorStatus: err.status, errorMessage: err.message, ...token }));
      });
  }
}
