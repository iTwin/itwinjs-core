/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ChangedElementsDb
 */

import * as path from "path";
import { DbResult, GuidString, IDisposable, OpenMode } from "@bentley/bentleyjs-core";
import { ChangeSet } from "@bentley/imodelhub-client";
import { ChangeData, ChangedElements, ChangedModels, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager, ChangeSetToken } from "./BriefcaseManager";
import { ChangeSummaryExtractContext, ChangeSummaryManager } from "./ChangeSummaryManager";
import { ECDbOpenMode } from "./ECDb";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";

/**
 * Options for processChangesets function
 * @internal
 * */
export interface ProcessChangesetOptions {
  startChangesetId: string;
  endChangesetId: string;
  rulesetId: string;
  filterSpatial?: boolean;
  wantParents?: boolean;
  wantPropertyChecksums?: boolean;
  rulesetDir?: string;
  tempDir?: string;
}

/** An ChangedElementsDb file
 * @internal
 */
export class ChangedElementsDb implements IDisposable {
  private _nativeDb: IModelJsNative.ChangedElementsECDb | undefined;

  constructor() {
    this._nativeDb = new IModelHost.platform.ChangedElementsECDb();
  }

  public dispose(): void {
    if (!this._nativeDb)
      return;

    this.closeDb();
    this._nativeDb.dispose();
    this._nativeDb = undefined;
  }

  private static buildChangeSetTokens(changeSets: ChangeSet[], changeSetsPath: string): ChangeSetToken[] {
    const changeSetTokens = new Array<ChangeSetToken>();
    changeSets.forEach((changeSet: ChangeSet) => {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      changeSetTokens.push(new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType!, changeSet.pushDate));
    });
    return changeSetTokens;
  }

  /** Create a ChangedElementsDb
   * @param pathName The path to the ECDb file to create.
   * @throws [IModelError]($common) if the operation failed.
   */
  private _createDb(briefcase: IModelDb, pathName: string): void {
    const status: DbResult = this.nativeDb.createDb(briefcase.nativeDb, pathName);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to created ECDb");
  }

  /** Open the Changed Elements Db.
   * @param pathName The path to the ECDb file to open
   * @param openMode Open mode
   * @throws [IModelError]($common) if the operation failed.
   */
  private _openDb(pathName: string, openMode: ECDbOpenMode = ECDbOpenMode.Readonly): void {
    const nativeOpenMode: OpenMode = openMode === ECDbOpenMode.Readonly ? OpenMode.Readonly : OpenMode.ReadWrite;
    const tryUpgrade: boolean = openMode === ECDbOpenMode.FileUpgrade;
    const status: DbResult = this.nativeDb.openDb(pathName, nativeOpenMode, tryUpgrade);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to open ECDb");
  }

  /** Open the Changed Elements Db.
   * @param pathName The path to the ECDb file to open
   * @param openMode Open mode
   * @returns ChangedElementsDb
   */
  public static openDb(pathName: string, openMode: ECDbOpenMode = ECDbOpenMode.Readonly): ChangedElementsDb {
    const cacheDb: ChangedElementsDb = new ChangedElementsDb();
    cacheDb._openDb(pathName, openMode);
    return cacheDb;
  }

  /** Create the changed elements cache db
   * @param briefcase IModelDb to use
   * @param pathName The path to the ECDb file to create.
   * @returns The new cache db
   */
  public static createDb(briefcase: IModelDb, pathName: string): ChangedElementsDb {
    const cacheDb: ChangedElementsDb = new ChangedElementsDb();
    cacheDb._createDb(briefcase, pathName);
    return cacheDb;
  }

  /** Processes a range of changesets and adds it to the changed elements cache
   * @param requestContext The client request context
   * @param briefcase iModel briefcase to use
   * @param startChangesetId Start Changeset Id
   * @param endChangesetId End Changeset Id
   * @param filterSpatial [optional] Whether to do processing filtering out spatial elements, defaults to false
   * @param rulesetDir [optional] Directories string for ruleset directory locater
   * @param tempDir [optional] Directory to use to store temporary Db used to do processing. This Db is cleaned up automatically unless the process crashes.
   */
  public async processChangesets(requestContext: AuthorizedClientRequestContext, briefcase: IModelDb, options: ProcessChangesetOptions): Promise<DbResult> {
    requestContext.enter();
    const changeSummaryContext = new ChangeSummaryExtractContext(briefcase);
    const changesets = await ChangeSummaryManager.downloadChangeSets(requestContext, changeSummaryContext, options.startChangesetId, options.endChangesetId);
    requestContext.enter();
    const tokens = ChangedElementsDb.buildChangeSetTokens(changesets, BriefcaseManager.getChangeSetsPath(briefcase.iModelId));
    // ChangeSets need to be processed from newest to oldest
    tokens.reverse();
    const status: DbResult = this.nativeDb.processChangesets(
      briefcase.nativeDb,
      JSON.stringify(tokens),
      options.rulesetId,
      options.filterSpatial,
      options.wantParents,
      options.wantPropertyChecksums,
      options.rulesetDir,
      options.tempDir
    );
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to process changesets");
    return status;
  }

  /** Get changed elements between two changesets
   * @param startChangesetId Start Changeset Id
   * @param endChangesetId End Changeset Id
   * @returns Returns the changed elements between the changesets provided
   * @throws [IModelError]($common) if the operation failed.
   */
  public getChangedElements(startChangesetId: GuidString, endChangesetId: GuidString): ChangedElements | undefined {
    const result: IModelJsNative.ErrorStatusOrResult<IModelStatus, any> = this.nativeDb.getChangedElements(startChangesetId, endChangesetId);
    if (result.error || !result.result)
      throw new IModelError(result.error ? result.error.status : -1, result.error ? result.error.message : "Problem getting changed elements");
    return (result.result.changedElements) as ChangedElements;
  }

  /** Get changed models between two changesets
   * @param startChangesetId Start Changeset Id
   * @param endChangesetId End Changeset Id
   * @returns Returns the changed models between the changesets provided
   * @throws [IModelError]($common) if the operation failed.
   */
  public getChangedModels(startChangesetId: GuidString, endChangesetId: GuidString): ChangedModels | undefined {
    const result: IModelJsNative.ErrorStatusOrResult<IModelStatus, any> = this.nativeDb.getChangedElements(startChangesetId, endChangesetId);
    if (result.error || !result.result)
      throw new IModelError(result.error ? result.error.status : -1, result.error ? result.error.message : "Problem getting changed models");
    return (result.result.changedModels) as ChangedModels;
  }

  /** Get changed models between two changesets
   * @param startChangesetId Start Changeset Id
   * @param endChangesetId End Changeset Id
   * @returns Returns the changed models between the changesets provided
   * @throws [IModelError]($common) if the operation failed.
   */
  public getChangeData(startChangesetId: GuidString, endChangesetId: GuidString): ChangeData | undefined {
    const result: IModelJsNative.ErrorStatusOrResult<IModelStatus, any> = this.nativeDb.getChangedElements(startChangesetId, endChangesetId);
    if (result.error)
      throw new IModelError(result.error.status, result.error.message);
    return result.result as ChangeData;
  }

  /** Returns true if the Changed Elements Db is open */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /** Returns true if the cache already contains this changeset Id */
  public isProcessed(changesetId: GuidString): boolean { return this.nativeDb.isProcessed(changesetId); }

  /** Close the Db after saving any uncommitted changes.
   * @throws [IModelError]($common) if the database is not open.
   */
  public closeDb(): void {
    this.nativeDb.closeDb();
  }

  public cleanCaches(): void {
    this.nativeDb.cleanCaches();
  }

  /** @internal */
  public get nativeDb(): IModelJsNative.ChangedElementsECDb {
    if (!this._nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "ChangedElementsDb object has already been disposed.");

    return this._nativeDb;
  }
}
