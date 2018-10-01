/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { AccessToken, ChangeSet, UserInfo, UserInfoQuery, ChangeSetQuery } from "@bentley/imodeljs-clients";
import { ErrorStatusOrResult } from "./imodeljs-native-platform-api";
import { Id64, using, assert, Logger, PerfLogger, DbResult, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { IModelDb } from "./IModelDb";
import { ECDb, ECDbOpenMode } from "./ECDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { ChangeOpCode, ChangedValueState, IModelVersion, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "./BriefcaseManager";
import * as path from "path";
import { IModelJsFs } from "./IModelJsFs";
import { KnownLocations } from "./Platform";

const loggingCategory: string = "imodeljs-backend.ChangeSummaryManager";

/** Represents an instance of the `ChangeSummary` ECClass from the `ECDbChange` ECSchema
 *  combined with the information from the related `ChangeSet` instance (from the `IModelChange` ECSchema) from
 *  which the Change Summary was extracted.
 *
 *  See also
 *  - [ChangeSummaryManager.queryChangeSummary]($backend)
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export interface ChangeSummary {
  id: Id64;
  changeSet: { wsgId: string, parentWsgId: string, description: string, pushDate: string, author: string };
}

/** Represents an instance of the `InstanceChange` ECClass from the `ECDbChange` ECSchema
 *
 *  See also
 *  - [ChangeSummaryManager.queryInstanceChange]($backend)
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export interface InstanceChange {
  id: Id64;
  summaryId: Id64;
  changedInstance: { id: Id64, className: string };
  opCode: ChangeOpCode;
  isIndirect: boolean;
}

/** Options for [ChangeSummaryManager.extractChangeSummaries]($backend). */
export interface ChangeSummaryExtractOptions {
  /** If specified, change summaries are extracted from the start version to the current version as of which the iModel
   *  was opened. If undefined, the extraction starts at the first version of the iModel.
   */
  startVersion?: IModelVersion;
  /** If specified, the change summary will be extracted only for current version as of which the iModel
   *  was opened.
   */
  currentVersionOnly?: boolean;
}

class ChangeSummaryExtractContext {
  public constructor(public readonly accessToken: AccessToken, public readonly iModel: IModelDb) { }

  public get iModelId(): string { assert(!!this.iModel.briefcase); return this.iModel.briefcase!.iModelId; }
}

/** Class to extract Change Summaries for a briefcase.
 *
 *  See also:
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export class ChangeSummaryManager {
  private static readonly _currentIModelChangeSchemaVersion = { read: 1, write: 0, minor: 1 };

  /** Determines whether the *Change Cache file* is attached to the specified iModel or not
   * @param iModel iModel to check whether a *Change Cache file* is attached
   * @returns Returns true if the *Change Cache file* is attached to the iModel. false otherwise
   */
  public static isChangeCacheAttached(iModel: IModelDb): boolean {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen || iModel.openParams.isStandalone)
      throw new IModelError(IModelStatus.BadRequest, "Invalid iModel object. iModel must be open and not a standalone iModel.");

    return iModel.nativeDb.isChangeCacheAttached();
  }

  /** Attaches the *Change Cache file* to the specified iModel if it hasn't been attached yet.
   * A new *Change Cache file* will be created for the iModel if it hasn't existed before.
   * @param iModel iModel to attach the *Change Cache file* file to
   * @throws [IModelError]($common)
   */
  public static attachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen || iModel.openParams.isStandalone)
      throw new IModelError(IModelStatus.BadRequest, "Invalid iModel object. iModel must be open and not a standalone iModel.");

    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      return;

    const changesCacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModel.briefcase.iModelId);
    if (!IModelJsFs.existsSync(changesCacheFilePath)) {
      using(new ECDb(), (changeCacheFile: ECDb) => {
        ChangeSummaryManager.createChangeCacheFile(iModel, changeCacheFile, changesCacheFilePath);
      });
    }

    assert(IModelJsFs.existsSync(changesCacheFilePath));
    const res: DbResult = iModel.nativeDb.attachChangeCache(changesCacheFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach Change Cache file to ${iModel.briefcase.pathname}.`);
  }

  /** Detaches the *Change Cache file* from the specified iModel.
   * @param iModel iModel to detach the *Change Cache file* to
   * @throws [IModelError]($common) in case of errors, e.g. if no *Change Cache file* was attached before.
   */
  public static detachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen || iModel.openParams.isStandalone)
      throw new IModelError(IModelStatus.BadRequest, "Invalid iModel object. iModel must be open and not a standalone iModel.");

    iModel.clearStatementCache();
    iModel.clearSqliteStatementCache();
    const res: DbResult = iModel.nativeDb.detachChangeCache();
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to detach Change Cache file from ${iModel.briefcase.pathname}.`);
  }

  /** Extracts change summaries from the specified iModel.
   * Change summaries are extracted from the specified start version up through the version the iModel was opened with.
   * If no start version has been specified, the first version will be used.
   * @param iModel iModel to extract change summaries for. The iModel must not be a standalone iModel.
   * Note: For every version to extract a summary from, the method moves the iModel to that version before extraction. After
   * the extraction has completed, the iModel is moved back to the original version.
   * @param options Extraction options
   * @return the Ids of the extracted change summaries.
   * @throws [IModelError]($common) if the iModel is standalone
   */
  public static async extractChangeSummaries(actx: ActivityLoggingContext, accessToken: AccessToken, iModel: IModelDb, options?: ChangeSummaryExtractOptions): Promise<Id64[]> {
    actx.enter();
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen || iModel.openParams.isStandalone)
      throw new IModelError(IModelStatus.BadArg, "iModel to extract change summaries for must be open and must not be a standalone iModel.");

    const ctx = new ChangeSummaryExtractContext(accessToken, iModel);

    const endChangeSetId: string = iModel.briefcase.reversedChangeSetId || iModel.briefcase.changeSetId;
    assert(endChangeSetId.length !== 0);

    let startChangeSetId: string = "";
    if (options) {
      if (options.startVersion) {
        startChangeSetId = await options.startVersion.evaluateChangeSet(actx, ctx.accessToken, ctx.iModelId, BriefcaseManager.imodelClient);
        actx.enter();
      } else if (options.currentVersionOnly) {
        startChangeSetId = endChangeSetId;
      }
    }

    Logger.logInfo(loggingCategory, "Started Change Summary extraction...", () => ({ iModel: ctx.iModelId, startChangeset: startChangeSetId, endChangeset: endChangeSetId }));
    const totalPerf = new PerfLogger(`ChangeSummaryManager.extractChangeSummaries [Changesets: ${startChangeSetId} through ${endChangeSetId}, iModel: ${ctx.iModelId}]`);

    // download necessary changesets if they were not downloaded before and retrieve infos about those changesets
    let perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Retrieve ChangeSetInfos and download ChangeSets from Hub");
    const changeSetInfos: ChangeSet[] = await ChangeSummaryManager.downloadChangeSets(actx, ctx, startChangeSetId, endChangeSetId);
    actx.enter();
    perfLogger.dispose();
    Logger.logTrace(loggingCategory, "Retrieved changesets to extract from from cache or from hub.", () => ({ iModel: ctx.iModelId, startChangeset: startChangeSetId, endChangeset: endChangeSetId, changeSets: changeSetInfos }));

    perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Open or create local Change Cache file");
    const changesFile: ECDb = ChangeSummaryManager.openOrCreateChangesFile(iModel);
    perfLogger.dispose();
    Logger.logTrace(loggingCategory, "Opened or created Changes Cachefile.", () => ({ iModel: ctx.iModelId, startChangeset: startChangeSetId, endChangeset: endChangeSetId }));

    if (!changesFile || !changesFile.nativeDb) {
      assert(false, "Should not happen as an exception should have been thrown in that case");
      throw new IModelError(IModelStatus.BadArg, "Failed to create Change Cache file.");
    }

    try {
      const changeSetsFolder: string = BriefcaseManager.getChangeSetsPath(ctx.iModelId);
      const userInfoCache = new Map<string, string>();

      // extract summaries from end changeset through start changeset, so that we only have to go back in history
      const changeSetCount: number = changeSetInfos.length;
      const endChangeSetIx: number = changeSetCount - 1;
      const summaries: Id64[] = [];
      for (let i = endChangeSetIx; i >= 0; i--) {
        const currentChangeSetInfo: ChangeSet = changeSetInfos[i];
        const currentChangeSetId: string = currentChangeSetInfo.wsgId;
        Logger.logInfo(loggingCategory, `Started Change Summary extraction for changeset #${i + 1}...`, () => ({ iModel: ctx.iModelId, changeset: currentChangeSetId }));

        const existingSummaryId: Id64 | undefined = ChangeSummaryManager.isSummaryAlreadyExtracted(changesFile, currentChangeSetId);
        if (!!existingSummaryId) {
          Logger.logInfo(loggingCategory, `Change Summary for changeset #${i + 1} already exists. It is not extracted again.`, () => ({ iModel: ctx.iModelId, changeset: currentChangeSetId }));
          summaries.push(existingSummaryId);
          continue;
        }

        // iModel is at end changeset, so no need to reverse for it.
        if (i !== endChangeSetIx) {
          perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Roll iModel to previous changeset");
          await iModel.reverseChanges(actx, accessToken, IModelVersion.asOfChangeSet(currentChangeSetId));
          actx.enter();
          perfLogger.dispose();
          Logger.logTrace(loggingCategory, `Moved iModel to changeset #${i + 1} to extract summary from.`, () => ({ iModel: ctx.iModelId, changeset: currentChangeSetId }));
        }

        const changeSetFilePath: string = path.join(changeSetsFolder, currentChangeSetInfo.fileName!);
        if (!IModelJsFs.existsSync(changeSetFilePath))
          throw new IModelError(IModelStatus.FileNotFound, "Failed to extract change summary: Changeset file '" + changeSetFilePath + "' does not exist.");

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Extract ChangeSummary");
        const stat: ErrorStatusOrResult<DbResult, string> = iModel.nativeDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
        perfLogger.dispose();
        if (stat.error && stat.error.status !== DbResult.BE_SQLITE_OK)
          throw new IModelError(stat.error.status, stat.error.message);

        Logger.logTrace(loggingCategory, `Actual Change summary extraction done for changeset #${i + 1}.`, () => ({ iModel: ctx.iModelId, changeset: currentChangeSetId }));

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Add ChangeSet info to ChangeSummary");
        const changeSummaryId = new Id64(stat.result!);
        summaries.push(changeSummaryId);
        let userEmail: string | undefined; // undefined means that no user information is stored along with changeset
        if (currentChangeSetInfo.userCreated) {
          const userId: string = currentChangeSetInfo.userCreated;
          const foundUserEmail: string | undefined = userInfoCache.get(userId);
          if (foundUserEmail === undefined) {
            const userInfos: UserInfo[] = await BriefcaseManager.imodelClient.Users().get(actx, ctx.accessToken, new Guid(ctx.iModelId), new UserInfoQuery().byId(userId));
            actx.enter();
            assert(userInfos.length !== 0);
            if (userInfos.length !== 0) {
              const userInfo: UserInfo = userInfos[0];
              userEmail = userInfo.email;
              // in the cache, add empty e-mail to mark that this user has already been looked up
              userInfoCache.set(userId, !!userEmail ? userEmail : "");
            }
          } else
            userEmail = foundUserEmail.length !== 0 ? foundUserEmail : undefined;
        }

        ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, currentChangeSetId, currentChangeSetInfo.parentId, currentChangeSetInfo.description, currentChangeSetInfo.pushDate, userEmail);
        perfLogger.dispose();
        Logger.logTrace(loggingCategory, `Added extended infos to Change Summary for changeset #${i + 1}.`, () => ({ iModel: ctx.iModelId, changeset: currentChangeSetId }));

        Logger.logInfo(loggingCategory, `Finished Change Summary extraction for changeset #${i + 1}.`, () => ({ iModel: ctx.iModelId, changeset: currentChangeSetId }));
      }

      changesFile.saveChanges();
      return summaries;
    } finally {
      changesFile.dispose();

      perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Move iModel to original changeset");
      await iModel.reinstateChanges(actx, accessToken, IModelVersion.asOfChangeSet(endChangeSetId));
      actx.enter();
      perfLogger.dispose();
      Logger.logTrace(loggingCategory, "Moved iModel to initial changeset (the end changeset).", () => ({ iModel: ctx.iModelId, startChangeset: startChangeSetId, endChangeset: endChangeSetId }));

      totalPerf.dispose();
      Logger.logInfo(loggingCategory, "Finished Change Summary extraction.", () => ({ iModel: ctx.iModelId, startChangeset: startChangeSetId, endChangeset: endChangeSetId }));
    }
  }

  private static async downloadChangeSets(actx: ActivityLoggingContext, ctx: ChangeSummaryExtractContext, startChangeSetId: string, endChangeSetId: string): Promise<ChangeSet[]> {
    actx.enter();
    // Get the change set before the startChangeSet so that startChangeSet is included in the download and processing
    let beforeStartChangeSetId: string;
    if (startChangeSetId.length === 0)
      beforeStartChangeSetId = "";
    else {
      const query = new ChangeSetQuery();
      query.byId(startChangeSetId);

      const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(actx, ctx.accessToken, new Guid(ctx.iModelId), query);
      actx.enter();
      if (changeSets.length === 0)
        throw new Error(`Unable to find change set ${startChangeSetId} for iModel ${ctx.iModelId}`);

      const changeSetInfo: ChangeSet = changeSets[0];

      beforeStartChangeSetId = !changeSetInfo.parentId ? "" : changeSetInfo.parentId;
    }

    const changeSetInfos: ChangeSet[] = await BriefcaseManager.downloadChangeSets(actx, ctx.accessToken, ctx.iModelId, beforeStartChangeSetId, endChangeSetId);
    actx.enter();
    assert(startChangeSetId.length === 0 || startChangeSetId === changeSetInfos[0].wsgId);
    assert(endChangeSetId === changeSetInfos[changeSetInfos.length - 1].wsgId);
    return changeSetInfos;
  }

  private static openOrCreateChangesFile(iModel: IModelDb): ECDb {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg, "Invalid iModel handle. iModel must be open.");

    const changesFile = new ECDb();
    const changeCacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModel.briefcase.iModelId);
    if (IModelJsFs.existsSync(changeCacheFilePath)) {
      ChangeSummaryManager.openChangeCacheFile(changesFile, changeCacheFilePath);
      return changesFile;
    }

    try {
      ChangeSummaryManager.createChangeCacheFile(iModel, changesFile, changeCacheFilePath);
      return changesFile;
    } catch (e) {
      // delete cache file again in case it was created but schema import failed
      if (IModelJsFs.existsSync(changeCacheFilePath))
        IModelJsFs.removeSync(changeCacheFilePath);

      throw e;
    }
  }

  private static createChangeCacheFile(iModel: IModelDb, changesFile: ECDb, changeCacheFilePath: string): void {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg, "Invalid iModel object. iModel must be open.");

    const stat: DbResult = iModel.nativeDb.createChangeCache(changesFile.nativeDb, changeCacheFilePath);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Failed to create Change Cache file at '" + changeCacheFilePath + "'.");

    // Extended information like changeset ids, push dates are persisted in the IModelChange ECSchema
    changesFile.importSchema(ChangeSummaryManager.getExtendedSchemaPath());
  }

  private static openChangeCacheFile(changesFile: ECDb, changeCacheFilePath: string): void {
    changesFile.openDb(changeCacheFilePath, ECDbOpenMode.FileUpgrade);

    const actualSchemaVersion: { read: number, write: number, minor: number } = changesFile.withPreparedStatement("SELECT VersionMajor read,VersionWrite write,VersionMinor minor FROM meta.ECSchemaDef WHERE Name='IModelChange'",
      (stmt: ECSqlStatement) => {
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, "File is not a valid Change Cache file.");

        return stmt.getRow();
      });

    if (actualSchemaVersion.read === ChangeSummaryManager._currentIModelChangeSchemaVersion.read &&
      actualSchemaVersion.write === ChangeSummaryManager._currentIModelChangeSchemaVersion.write &&
      actualSchemaVersion.minor === ChangeSummaryManager._currentIModelChangeSchemaVersion.minor)
      return;

    changesFile.importSchema(ChangeSummaryManager.getExtendedSchemaPath());
  }

  private static getExtendedSchemaPath(): string { return path.join(KnownLocations.packageAssetsDir, "IModelChange.01.00.01.ecschema.xml"); }

  private static isSummaryAlreadyExtracted(changesFile: ECDb, changeSetId: string): Id64 | undefined {
    return changesFile.withPreparedStatement("SELECT Summary.Id summaryid FROM imodelchange.ChangeSet WHERE WsgId=?",
      (stmt: ECSqlStatement) => {
        stmt.bindString(1, changeSetId);
        if (DbResult.BE_SQLITE_ROW === stmt.step())
          return new Id64(stmt.getValue(0).getId());

        return undefined;
      });
  }

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: Id64, changesetWsgId: string, changesetParentWsgId?: string, description?: string, changesetPushDate?: string, changeSetAuthor?: string): void {
    changesFile.withPreparedStatement("INSERT INTO imodelchange.ChangeSet(Summary.Id,WsgId,ParentWsgId,Description,PushDate,Author) VALUES(?,?,?,?,?,?)",
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, changeSummaryId);
        stmt.bindString(2, changesetWsgId);
        if (changesetParentWsgId)
          stmt.bindString(3, changesetParentWsgId);

        if (description)
          stmt.bindString(4, description);

        if (changesetPushDate)
          stmt.bindDateTime(5, changesetPushDate);

        if (changeSetAuthor)
          stmt.bindString(6, changeSetAuthor);

        const r: DbResult = stmt.step();
        if (r !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(r, "Failed to add changeset information to extracted change summary " + changeSummaryId);
      });
  }

  /** Queries the ChangeSummary for the specified change summary id
   *
   * See also
   * - `ECDbChange.ChangeSummary` ECClass in the *ECDbChange* ECSchema
   * - [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @param iModel iModel
   * @param changeSummaryId ECInstanceId of the ChangeSummary
   * @returns Returns the requested ChangeSummary object
   * @throws [IModelError]($common) If change summary does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryChangeSummary(iModel: IModelDb, changeSummaryId: Id64): ChangeSummary {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadArg, "Change Cache file must be attached to iModel.");

    return iModel.withPreparedStatement("SELECT WsgId,ParentWsgId,Description,PushDate,Author FROM ecchange.imodelchange.ChangeSet WHERE Summary.Id=?",
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, changeSummaryId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(IModelStatus.BadArg, `No ChangeSet information found for ChangeSummary ${changeSummaryId.value}.`);

        const row = stmt.getRow();
        return { id: changeSummaryId, changeSet: { wsgId: row.wsgId, parentWsgId: row.parentWsgId, description: row.description, pushDate: row.pushDate, author: row.author } };
      });
  }

  /** Queries the InstanceChange for the specified instance change id.
   *
   * See also
   * - `ECDbChange.InstanceChange` ECClass in the *ECDbChange* ECSchema
   * - [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @param iModel iModel
   * @param instanceChangeId ECInstanceId of the InstanceChange (see `ECDbChange.InstanceChange` ECClass in the *ECDbChange* ECSchema)
   * @returns Returns the requested InstanceChange object (see `ECDbChange.InstanceChange` ECClass in the *ECDbChange* ECSchema)
   * @throws [IModelError]($common) if instance change does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryInstanceChange(iModel: IModelDb, instanceChangeId: Id64): InstanceChange {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadArg, "Change Cache file must be attached to iModel.");

    // query instance changes
    const instanceChange: InstanceChange = iModel.withPreparedStatement(`SELECT ic.Summary.Id summaryId, s.Name changedInstanceSchemaName, c.Name changedInstanceClassName, ic.ChangedInstance.Id changedInstanceId,
            ic.OpCode, ic.IsIndirect FROM ecchange.change.InstanceChange ic JOIN main.meta.ECClassDef c ON c.ECInstanceId = ic.ChangedInstance.ClassId
          JOIN main.meta.ECSchemaDef s ON c.Schema.Id = s.ECInstanceId WHERE ic.ECInstanceId =? `, (stmt: ECSqlStatement) => {
        stmt.bindId(1, instanceChangeId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(IModelStatus.BadArg, `No InstanceChange found for id ${instanceChangeId.value}.`);

        const row = stmt.getRow();
        const changedInstanceId = new Id64(row.changedInstanceId);
        const changedInstanceClassName: string = "[" + row.changedInstanceSchemaName + "].[" + row.changedInstanceClassName + "]";
        const op: ChangeOpCode = row.opCode as ChangeOpCode;

        return {
          id: instanceChangeId, summaryId: new Id64(row.summaryId), changedInstance: { id: changedInstanceId, className: changedInstanceClassName },
          opCode: op, isIndirect: row.isIndirect,
        };
      });

    return instanceChange;
  }

  /** Retrieves the names of the properties whose values have changed for the given instance change
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @param iModel iModel
   * @param instanceChangeId Id of the InstanceChange to query the properties whose values have changed
   * @returns Returns names of the properties whose values have changed for the given instance change
   * @throws [IModelError]($common) if the change cache file hasn't been attached, or in case of other errors.
   */
  public static getChangedPropertyValueNames(iModel: IModelDb, instanceChangeId: Id64): string[] {
    return iModel.withPreparedStatement("SELECT AccessString FROM ecchange.change.PropertyValueChange WHERE InstanceChange.Id=?",
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, instanceChangeId);

        const selectClauseItems: string[] = [];
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          // access string tokens need to be escaped as they might collide with reserved words in ECSQL or SQLite
          const accessString: string = stmt.getValue(0).getString();
          const accessStringTokens: string[] = accessString.split(".");
          assert(accessStringTokens.length > 0);

          let isFirstToken: boolean = true;
          let item: string = "";
          for (const token of accessStringTokens) {
            if (!isFirstToken)
              item += ".";

            item += "[" + token + "]";
            isFirstToken = false;
          }
          selectClauseItems.push(item);
        }

        return selectClauseItems;
      });
  }

  /** Builds the ECSQL to query the property value changes for the specified instance change and the specified ChangedValueState.
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @param iModel iModel
   * @param instanceChangeInfo InstanceChange to query the property value changes for
   *        changedInstance.className must be fully qualified and schema and class name must be escaped with square brackets if they collide with reserved ECSQL words: `[schema name].[class name]`
   * @param changedValueState The Changed State to query the values for. This must correspond to the [InstanceChange.OpCode]($backend) of the InstanceChange.
   * @param changedPropertyNames List of the property names for which values have changed for the specified instance change.
   *        The list can be obtained by calling [ChangeSummaryManager.getChangedPropertyValueNames]($imodeljs-backend).
   *        If omitted, the method will call the above method by itself. The parameter allows for checking first whether
   *        an instance change has any property value changes at all. If there are no property value changes, this method
   *        should not be called, as it will throw an error.
   * @returns Returns the ECSQL that will retrieve the property value changes
   * @throws [IModelError]($common) if instance change does not exist, if there are not property value changes for the instance change,
   *        if the change cache file hasn't been attached, or in case of other errors.
   */
  public static buildPropertyValueChangesECSql(iModel: IModelDb, instanceChangeInfo: { id: Id64, summaryId: Id64, changedInstance: { id: Id64, className: string } }, changedValueState: ChangedValueState, changedPropertyNames?: string[]): string {
    let selectClauseItems: string[];
    if (!changedPropertyNames) {
      // query property value changes just to build a SELECT statement against the class of the changed instance
      selectClauseItems = ChangeSummaryManager.getChangedPropertyValueNames(iModel, instanceChangeInfo.id);
    } else
      selectClauseItems = changedPropertyNames;

    if (selectClauseItems.length === 0)
      throw new IModelError(IModelStatus.BadArg, `No property value changes found for InstanceChange ${instanceChangeInfo.id.value}.`);

    let ecsql: string = "SELECT ";
    selectClauseItems.map((item: string, index: number) => {
      if (index !== 0)
        ecsql += ",";

      ecsql += item;
    });

    // Avoiding parameters in the Changes function speeds up performance because ECDb can do optimizations
    // if it knows the function args at prepare time
    ecsql += " FROM main." + instanceChangeInfo.changedInstance.className + ".Changes(" + instanceChangeInfo.summaryId.toString() + "," + changedValueState + ") WHERE ECInstanceId=" + instanceChangeInfo.changedInstance.id.toString();
    return ecsql;
  }
}
