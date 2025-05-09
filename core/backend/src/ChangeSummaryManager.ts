/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { AccessToken, assert, DbResult, GuidString, Id64String, IModelStatus, Logger } from "@itwin/core-bentley";
import { ChangedValueState, ChangeOpCode, ChangesetRange, IModelError, IModelVersion } from "@itwin/core-common";
import * as path from "path";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseManager } from "./BriefcaseManager";
import { ECDb, ECDbOpenMode } from "./ECDb";
import { ECSqlInsertResult, ECSqlStatement, ECSqlWriteStatement } from "./ECSqlStatement";
import { BriefcaseDb, IModelDb, TokenArg } from "./IModelDb";
import { IModelHost, KnownLocations } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { _hubAccess, _nativeDb } from "./internal/Symbols";

const loggerCategory: string = BackendLoggerCategory.ECDb;

/** Represents an instance of the `ChangeSummary` ECClass from the `ECDbChange` ECSchema
 * combined with the information from the related `Changeset` instance (from the `IModelChange` ECSchema) from
 * which the Change Summary was extracted.
 *
 * See also
 * - [ChangeSummaryManager.queryChangeSummary]($backend)
 * - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 * @beta
 */
export interface ChangeSummary {
  id: Id64String;
  changeSet: { wsgId: GuidString, parentWsgId: GuidString, description: string, pushDate: string, userCreated: GuidString };
}

/** Represents an instance of the `InstanceChange` ECClass from the `ECDbChange` ECSchema
 *
 * See also
 * - [ChangeSummaryManager.queryInstanceChange]($backend)
 * - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 * @beta
 */
export interface InstanceChange {
  id: Id64String;
  summaryId: Id64String;
  changedInstance: { id: Id64String, className: string };
  opCode: ChangeOpCode;
  isIndirect: boolean;
}

/** Options for [ChangeSummaryManager.createChangeSummaries]($backend).
 * @beta
 */
export interface CreateChangeSummaryArgs extends TokenArg {
  /** Id of the iTwin that contains the iModel */
  iTwinId: GuidString;

  /** Id of the iModel */
  iModelId: GuidString;

  /**
   * Range of change sets
   * - the Change Summary for the first and last versions are also included
   * - if unspecified, all change sets until the latest version are processed
   */
  range: ChangesetRange;
}

/** Class to extract Change Summaries for a briefcase.
 *
 * See also:
 * - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 * @beta
 */
export class ChangeSummaryManager {
  private static readonly _currentIModelChangeSchemaVersion = { read: 2, write: 0, minor: 0 };

  /** Determines whether the *Change Cache file* is attached to the specified iModel or not
   * @param iModel iModel to check whether a *Change Cache file* is attached
   * @returns Returns true if the *Change Cache file* is attached to the iModel. false otherwise
   */
  public static isChangeCacheAttached(iModel: IModelDb): boolean {
    if (!iModel || !iModel.isOpen)
      throw new IModelError(IModelStatus.BadRequest, "Briefcase must be open");

    return iModel[_nativeDb].isChangeCacheAttached();
  }

  /** Attaches the *Change Cache file* to the specified iModel if it hasn't been attached yet.
   * A new *Change Cache file* will be created for the iModel if it hasn't existed before.
   * @param iModel iModel to attach the *Change Cache file* file to
   * @throws [IModelError]($common)
   */
  public static attachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.isOpen)
      throw new IModelError(IModelStatus.BadRequest, "Briefcase must be open");

    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      return;

    const changesCacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModel.iModelId);
    if (!IModelJsFs.existsSync(changesCacheFilePath)) {
      using changeCacheFile = new ECDb();
      ChangeSummaryManager.createChangeCacheFile(iModel, changeCacheFile, changesCacheFilePath);
    }

    assert(IModelJsFs.existsSync(changesCacheFilePath));
    const res: DbResult = iModel[_nativeDb].attachChangeCache(changesCacheFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach Change Cache file to ${iModel.pathName}.`);
  }

  /** Detaches the *Change Cache file* from the specified iModel.
   * - note that this method will cause any pending (currently running or queued) queries to fail
   * @param iModel iModel to detach the *Change Cache file* to
   * @throws [IModelError]($common) in case of errors, e.g. if no *Change Cache file* was attached before.
   */
  public static detachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.isOpen)
      throw new IModelError(IModelStatus.BadRequest, "Briefcase must be open");

    iModel.clearCaches();
    const res: DbResult = iModel[_nativeDb].detachChangeCache();
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to detach Change Cache file from ${iModel.pathName}.`);
  }

  private static openOrCreateChangesFile(iModel: BriefcaseDb): ECDb {
    if (!iModel?.isOpen)
      throw new IModelError(IModelStatus.BadArg, "Invalid iModel handle. iModel must be open.");

    const changesFile = new ECDb();
    const changeCacheFilePath = BriefcaseManager.getChangeCachePathName(iModel.iModelId);
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
    if (!iModel?.isOpen)
      throw new IModelError(IModelStatus.BadArg, "Invalid iModel object. iModel must be open.");

    const stat: DbResult = iModel[_nativeDb].createChangeCache(changesFile[_nativeDb], changeCacheFilePath);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, `Failed to create Change Cache file at "${changeCacheFilePath}".`);

    // Extended information like changeset ids, push dates are persisted in the IModelChange ECSchema
    changesFile.importSchema(ChangeSummaryManager.getExtendedSchemaPath());
  }

  private static openChangeCacheFile(changesFile: ECDb, changeCacheFilePath: string): void {
    changesFile.openDb(changeCacheFilePath, ECDbOpenMode.FileUpgrade);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const actualSchemaVersion: { read: number, write: number, minor: number } = changesFile.withPreparedStatement("SELECT VersionMajor read,VersionWrite write,VersionMinor minor FROM meta.ECSchemaDef WHERE Name='IModelChange'", (stmt: ECSqlStatement) => {
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

  private static getExtendedSchemaPath(): string { return path.join(KnownLocations.packageAssetsDir, "IModelChange.02.00.00.ecschema.xml"); }

  private static isSummaryAlreadyExtracted(changesFile: ECDb, changeSetId: GuidString): Id64String | undefined {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return changesFile.withPreparedStatement("SELECT Summary.Id summaryid FROM imodelchange.ChangeSet WHERE WsgId=?", (stmt: ECSqlStatement) => {
      stmt.bindString(1, changeSetId);
      if (DbResult.BE_SQLITE_ROW === stmt.step())
        return stmt.getValue(0).getId();

      return undefined;
    });
  }

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: Id64String, changesetWsgId: GuidString, changesetParentWsgId?: GuidString, description?: string, changesetPushDate?: string, changeSetUserCreated?: GuidString): void {
    changesFile.withCachedWriteStatement("INSERT INTO imodelchange.ChangeSet(Summary.Id,WsgId,ParentWsgId,Description,PushDate,UserCreated) VALUES(?,?,?,?,?,?)",
      (stmt: ECSqlWriteStatement) => {
        stmt.bindId(1, changeSummaryId);
        stmt.bindString(2, changesetWsgId);
        if (changesetParentWsgId)
          stmt.bindString(3, changesetParentWsgId);

        if (description)
          stmt.bindString(4, description);

        if (changesetPushDate)
          stmt.bindDateTime(5, changesetPushDate);

        if (changeSetUserCreated)
          stmt.bindString(6, changeSetUserCreated);

        const r: ECSqlInsertResult = stmt.stepForInsert();
        if (r.status !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(r.status, `Failed to add changeset information to extracted change summary ${changeSummaryId}`);
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
  public static queryChangeSummary(iModel: BriefcaseDb, changeSummaryId: Id64String): ChangeSummary {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadArg, "Change Cache file must be attached to iModel.");

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return iModel.withPreparedStatement("SELECT WsgId,ParentWsgId,Description,PushDate,UserCreated FROM ecchange.imodelchange.ChangeSet WHERE Summary.Id=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, changeSummaryId);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        throw new IModelError(IModelStatus.BadArg, `No ChangeSet information found for ChangeSummary ${changeSummaryId}.`);

      const row = stmt.getRow();
      return { id: changeSummaryId, changeSet: { wsgId: row.wsgId, parentWsgId: row.parentWsgId, description: row.description, pushDate: row.pushDate, userCreated: row.userCreated } };
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
  public static queryInstanceChange(iModel: BriefcaseDb, instanceChangeId: Id64String): InstanceChange {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadArg, "Change Cache file must be attached to iModel.");

    // query instance changes
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const instanceChange: InstanceChange = iModel.withPreparedStatement(`SELECT ic.Summary.Id summaryId, s.Name changedInstanceSchemaName, c.Name changedInstanceClassName, ic.ChangedInstance.Id changedInstanceId,
       ic.OpCode, ic.IsIndirect FROM ecchange.change.InstanceChange ic JOIN main.meta.ECClassDef c ON c.ECInstanceId = ic.ChangedInstance.ClassId
       JOIN main.meta.ECSchemaDef s ON c.Schema.Id = s.ECInstanceId WHERE ic.ECInstanceId =? `,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, instanceChangeId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(IModelStatus.BadArg, `No InstanceChange found for id ${instanceChangeId}.`);

        const row = stmt.getRow();
        const changedInstanceId: Id64String = row.changedInstanceId;
        const changedInstanceClassName: string = `[${row.changedInstanceSchemaName}].[${row.changedInstanceClassName}]`;
        const op: ChangeOpCode = row.opCode as ChangeOpCode;

        return {
          id: instanceChangeId, summaryId: row.summaryId, changedInstance: { id: changedInstanceId, className: changedInstanceClassName },
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
  public static getChangedPropertyValueNames(iModel: IModelDb, instanceChangeId: Id64String): string[] {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return iModel.withPreparedStatement("SELECT AccessString FROM ecchange.change.PropertyValueChange WHERE InstanceChange.Id=?", (stmt: ECSqlStatement) => {
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

          item += `[${token}]`;
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
   *        The list can be obtained by calling [ChangeSummaryManager.getChangedPropertyValueNames]($core-backend).
   *        If omitted, the method will call the above method by itself. The parameter allows for checking first whether
   *        an instance change has any property value changes at all. If there are no property value changes, this method
   *        should not be called, as it will throw an error.
   * @returns Returns the ECSQL that will retrieve the property value changes
   * @throws [IModelError]($common) if instance change does not exist, if there are not property value changes for the instance change,
   *        if the change cache file hasn't been attached, or in case of other errors.
   */
  public static buildPropertyValueChangesECSql(iModel: IModelDb, instanceChangeInfo: { id: Id64String, summaryId: Id64String, changedInstance: { id: Id64String, className: string } }, changedValueState: ChangedValueState, changedPropertyNames?: string[]): string {
    let selectClauseItems: string[];
    if (!changedPropertyNames) {
      // query property value changes just to build a SELECT statement against the class of the changed instance
      selectClauseItems = ChangeSummaryManager.getChangedPropertyValueNames(iModel, instanceChangeInfo.id);
    } else
      selectClauseItems = changedPropertyNames;

    if (selectClauseItems.length === 0)
      throw new IModelError(IModelStatus.BadArg, `No property value changes found for InstanceChange ${instanceChangeInfo.id}.`);

    let ecsql: string = "SELECT ";
    selectClauseItems.map((item: string, index: number) => {
      if (index !== 0)
        ecsql += ",";

      ecsql += item;
    });

    // Avoiding parameters in the Changes function speeds up performance because ECDb can do optimizations
    // if it knows the function args at prepare time
    ecsql += ` FROM main.${instanceChangeInfo.changedInstance.className}.Changes(${instanceChangeInfo.summaryId},${changedValueState}) WHERE ECInstanceId=${instanceChangeInfo.changedInstance.id}`;
    return ecsql;
  }

  /**
   * Creates a change summary for the last applied change set to the iModel
   * @param accessToken A valid access token string
   * @param iModel iModel to extract change summaries for. The iModel must not be a standalone iModel, and must have at least one change set applied to it.
   * @returns The id of the extracted change summary.
   * @beta
   */
  public static async createChangeSummary(accessToken: AccessToken, iModel: BriefcaseDb): Promise<Id64String> {
    if (!iModel?.isOpen)
      throw new IModelError(IModelStatus.BadRequest, "Briefcase must be open");
    const changesetId = iModel.changeset.id;
    if (!changesetId)
      throw new IModelError(IModelStatus.BadRequest, "No change set was applied to the iModel");
    if (this.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadRequest, "Change cache must be detached before extraction");

    const iModelId = iModel.iModelId;
    const changesetsFolder: string = BriefcaseManager.getChangeSetsPath(iModelId);
    const changeset = await IModelHost[_hubAccess].downloadChangeset({ accessToken: IModelHost.authorizationClient ? undefined : accessToken, iModelId, changeset: { id: iModel.changeset.id }, targetDir: changesetsFolder });

    if (!IModelJsFs.existsSync(changeset.pathname))
      throw new IModelError(IModelStatus.FileNotFound, `Failed to download change set: ${changeset.pathname}`);

    try {
      using changesFile = ChangeSummaryManager.openOrCreateChangesFile(iModel);
      assert(changesFile[_nativeDb] !== undefined, "Invalid changesFile - should've caused an exception");

      let changeSummaryId = ChangeSummaryManager.isSummaryAlreadyExtracted(changesFile, changesetId);
      if (changeSummaryId !== undefined) {
        Logger.logInfo(loggerCategory, `Change Summary for changeset already exists. It is not extracted again.`, () => ({ iModelId, changeSetId: changesetId }));
        return changeSummaryId;
      }

      const stat = iModel[_nativeDb].extractChangeSummary(changesFile[_nativeDb], changeset.pathname);
      if (stat.error && stat.error.status !== DbResult.BE_SQLITE_OK)
        throw new IModelError(stat.error.status, stat.error.message);

      assert(undefined !== stat.result);
      changeSummaryId = stat.result;
      ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, changesetId, changeset.parentId, changeset.description, changeset.pushDate, changeset.userCreated);

      changesFile.saveChanges();
      return changeSummaryId;
    } finally {
      IModelJsFs.unlinkSync(changeset.pathname);
    }
  }

  /**
   * Creates change summaries for the specified iModel and a specified range of versions
   * @note This may be an expensive operation - downloads the first version and starts applying the change sets, extracting summaries one by one
   * @param args Arguments including the range of versions for which Change Summaries are to be created, and other necessary input for creation
   */
  public static async createChangeSummaries(args: CreateChangeSummaryArgs): Promise<Id64String[]> {
    // if we pass undefined to hubAccess methods they will use our authorizationClient to refresh the token as needed.
    const accessToken = IModelHost.authorizationClient ? undefined : args.accessToken ?? "";
    const { iModelId, iTwinId, range } = args;
    range.end = range.end ?? (await IModelHost[_hubAccess].getChangesetFromVersion({ accessToken, iModelId, version: IModelVersion.latest() })).index;
    if (range.first > range.end)
      throw new IModelError(IModelStatus.BadArg, "Invalid range of changesets");
    if (range.first === 0 && range.end === 0)
      return []; // no changesets exist, so the inclusive range is empty

    const changesets = await IModelHost[_hubAccess].queryChangesets({ accessToken, iModelId, range });

    // Setup a temporary briefcase to help with extracting change summaries
    const briefcasePath = BriefcaseManager.getBriefcaseBasePath(iModelId);
    const fileName: string = path.join(briefcasePath, `ChangeSummaryBriefcase.bim`);
    if (IModelJsFs.existsSync(fileName))
      IModelJsFs.removeSync(fileName);

    let iModel: BriefcaseDb | undefined;
    try {
      // Download a version that has the first change set applied
      const props = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId, asOf: { afterChangeSetId: changesets[0].id }, briefcaseId: 0, fileName });
      iModel = await BriefcaseDb.open({ fileName: props.fileName });

      const summaryIds = new Array<Id64String>();
      for (let index = 0; index < changesets.length; index++) {
        // Apply a change set if necessary
        if (index > 0)
          await iModel.pullChanges({ accessToken, toIndex: changesets[index].index });

        // Create a change summary for the last change set that was applied
        const summaryId = await this.createChangeSummary(accessToken ?? await IModelHost.authorizationClient?.getAccessToken() ?? "", iModel);
        summaryIds.push(summaryId);
      }
      return summaryIds;
    } finally {
      if (iModel !== undefined)
        iModel.close();
      IModelJsFs.removeSync(fileName);
    }
  }
}
