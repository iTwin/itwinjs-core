/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ChangedElementsDb */

import { IModelError, IModelStatus, ChangedElements } from "@bentley/imodeljs-common";
import { DbResult, OpenMode, IDisposable } from "@bentley/bentleyjs-core";
import { IModelJsNative } from "./IModelJsNative";
import { IModelDb, ChangeSetToken, ECDbOpenMode, BriefcaseManager, ChangeSummaryManager, ChangeSummaryExtractContext } from "./imodeljs-backend";
import { ChangeSet, ChangesType, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import * as path from "path";
import { IModelHost } from "./IModelHost";

/** An ChangedElementsDb file */
export class ChangedElementsDb implements IDisposable {
  private _nativeDb: IModelJsNative.ChangedElementsECDb | undefined;

  constructor() {
    this._nativeDb = new IModelHost.platform.ChangedElementsECDb();
  }

  public dispose(): void {
    if (!this._nativeDb)
      return;

    this.closeDb();
    this._nativeDb!.dispose();
    this._nativeDb = undefined;
  }

  private static buildChangeSetTokens(changeSets: ChangeSet[], changeSetsPath: string): ChangeSetToken[] {
    const changeSetTokens = new Array<ChangeSetToken>();
    changeSets.forEach((changeSet: ChangeSet) => {
      const changeSetPathname = path.join(changeSetsPath, changeSet.fileName!);
      changeSetTokens.push(new ChangeSetToken(changeSet.wsgId, changeSet.parentId!, +changeSet.index!, changeSetPathname, changeSet.changesType === ChangesType.Schema, changeSet.pushDate));
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
   */
  public async processChangesets(requestContext: AuthorizedClientRequestContext, briefcase: IModelDb, rulesetId: string, startChangesetId: string, endChangesetId: string, filterSpatial?: boolean): Promise<DbResult> {
    const changeSummaryContext = new ChangeSummaryExtractContext(briefcase);
    const changesets = await ChangeSummaryManager.downloadChangeSets(requestContext, changeSummaryContext, startChangesetId, endChangesetId);
    const tokens = ChangedElementsDb.buildChangeSetTokens(changesets, BriefcaseManager.getChangeSetsPath(briefcase.iModelToken.iModelId!));
    // ChangeSets need to be processed from newest to oldest
    tokens.reverse();
    const status: DbResult = this.nativeDb.processChangesets(briefcase.nativeDb, JSON.stringify(tokens), rulesetId, !!filterSpatial ? filterSpatial : false);
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
  public getChangedElements(startChangesetId: string, endChangesetId: string): ChangedElements | undefined {
    const result: IModelJsNative.ErrorStatusOrResult<IModelStatus, ChangedElements> = this.nativeDb.getChangedElements(startChangesetId, endChangesetId);
    if (result.error)
      throw new IModelError(result.error.status, result.error.message);
    return result.result;
  }

  /** Returns true if the Changed Elements Db is open */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /** Returns true if the cache already contains this changeset Id */
  public isProcessed(changesetId: string): boolean { return this.nativeDb.isProcessed(changesetId); }

  /** Close the Db after saving any uncommitted changes.
   * @throws [IModelError]($common) if the database is not open.
   */
  public closeDb(): void {
    this.nativeDb.closeDb();
  }

  public get nativeDb(): IModelJsNative.ChangedElementsECDb {
    if (!this._nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "ChangedElementsDb object has already been disposed.");

    return this._nativeDb!;
  }
}
