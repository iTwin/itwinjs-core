/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  BentleyStatus, ChangeSetApplyOption, ChangeSetStatus, DbOpcode, DbResult, GuidString, Id64String,
  IDisposable, IModelStatus, Logger, OpenMode, RepositoryStatus, StatusCodeWithMessage,
} from "@bentley/bentleyjs-core";
import { ElementProps, ChangedElements, QueryLimit, QueryQuota, QueryPriority } from "@bentley/imodeljs-common";
import { ExportGraphicsProps } from "./ExportGraphics";
import { IModelDb, TxnIdString } from "./IModelDb";
import { Config, PollStatus, PostStatus } from "./ConcurrentQuery";

/** Logger categories used by the native addon
 * @internal
 */
export enum NativeLoggerCategory {
  Success = 0,
  BeSQLite = "BeSQLite",
  Changeset = "Changeset",
  DgnCore = "DgnCore",
  ECDb = "ECDb",
  ECObjectsNative = "ECObjectsNative",
  UnitsNative = "UnitsNative",
}

// tslint:disable:prefer-get
/** Module that declares the IModelJs native code.
 * @internal
 */
export declare namespace IModelJsNative {
  export interface NativeCrashReportingConfigNameValuePair {
    name: string;
    value: string;
  }

  export interface NativeCrashReportingConfig {
    /** The directory to which *.dmp and/or iModelJsNativeCrash*.properties.txt files are written. */
    crashDir: string;
    /** Write .dmp files to crashDir? The default is false. Even if writeDumpsToCrashDir is false, the iModelJsNativeCrash*.properties.txt file will be written to crashDir. */
    writeDumpsToCrashDir?: boolean;
    /** max # .dmp files that may exist in crashDir */
    maxDumpsInDir?: number;
    /** If writeDumpsToCrashDir is true, do you want a full-memory dump? Defaults to false. */
    wantFullMemory?: boolean;
    /** Additional name, value pairs to write to iModelJsNativeCrash*.properties.txt file in the event of a crash. */
    params?: NativeCrashReportingConfigNameValuePair[];
  }

  export const version: string;
  export let logger: Logger;
  export function initializeRegion(region: number): void;
  export function setUseTileCache(useTileCache: boolean): void;
  export function setCrashReporting(cfg: NativeCrashReportingConfig): void;
  export function storeObjectInVault(obj: any, id: string): void;
  export function getObjectFromVault(id: string): any;
  export function dropObjectFromVault(id: string): void;
  export function addReferenceToObjectInVault(id: string): void;
  export function getObjectRefCountFromVault(id: string): number;
  export function clearLogLevelCache(): void;

  /** The return type of synchronous functions that may return an error or a successful result. */
  export interface ErrorStatusOrResult<ErrorCodeType, ResultType> {
    /** Error from the operation. This property is defined if and only if the operation failed. */
    error?: StatusCodeWithMessage<ErrorCodeType>;

    /** Result of the operation. This property is defined if the operation completed successfully */
    result?: ResultType;
  }
  export interface IConcurrentQueryManager {
    concurrentQueryInit(config: Config): boolean;
    postConcurrentQuery(ecsql: string, bindings: string, limit: QueryLimit, quota: QueryQuota, priority: QueryPriority): { status: PostStatus, taskId: number };
    pollConcurrentQuery(taskId: number): { status: PollStatus, result: string, rowCount: number };
  }
  export interface TileContent {
    content: Uint8Array;
    elapsedSeconds: number;
  }

  export class BriefcaseManagerResourcesRequest {
    public reset(): void;
    public isEmpty(): boolean;
    public toJSON(): string;
  }

  /** The options for how conflicts are to be handled during change-merging in an OptimisticConcurrencyControlPolicy.
   * The scenario is that the caller has made some changes to the *local* briefcase. Now, the caller is attempting to
   * merge in changes from iModelHub. The properties of this policy specify how to handle the *incoming* changes from iModelHub.
   */
  export interface BriefcaseManagerOnConflictPolicy {
    /** What to do with the incoming change in the case where the same entity was updated locally and also would be updated by the incoming change. */
    updateVsUpdate: number;
    /** What to do with the incoming change in the case where an entity was updated locally and would be deleted by the incoming change. */
    updateVsDelete: number;
    /** What to do with the incoming change in the case where an entity was deleted locally and would be updated by the incoming change. */
    deleteVsUpdate: number;
  }

  /** The native object for a Briefcase. */
  export class DgnDb implements IConcurrentQueryManager {
    constructor();
    public static getAssetsDir(): string;
    public abandonChanges(): DbResult;
    public abandonCreateChangeSet(): void;
    public addPendingChangeSet(changeSetId: string): DbResult;
    public appendBriefcaseManagerResourcesRequest(reqOut: BriefcaseManagerResourcesRequest, reqIn: BriefcaseManagerResourcesRequest): void;
    public applyChangeSets(changeSets: string, processOptions: ChangeSetApplyOption): ChangeSetStatus;
    public attachChangeCache(changeCachePath: string): DbResult;
    public beginMultiTxnOperation(): DbResult;
    public briefcaseManagerEndBulkOperation(): RepositoryStatus;
    public briefcaseManagerStartBulkOperation(): RepositoryStatus;
    public buildBriefcaseManagerResourcesRequestForElement(req: BriefcaseManagerResourcesRequest, elemId: string, opcode: DbOpcode): RepositoryStatus;
    public buildBriefcaseManagerResourcesRequestForLinkTableRelationship(req: BriefcaseManagerResourcesRequest, relKey: string, opcode: DbOpcode): RepositoryStatus;
    public buildBriefcaseManagerResourcesRequestForModel(req: BriefcaseManagerResourcesRequest, modelId: string, opcode: DbOpcode): RepositoryStatus;
    public cancelTo(txnId: TxnIdString): IModelStatus;
    public closeIModel(): void;
    public createChangeCache(changeCacheFile: ECDb, changeCachePath: string): DbResult;
    public createIModel(accessToken: string, appVersion: string, projectId: GuidString, fileName: string, props: string): DbResult;
    public createStandaloneIModel(fileName: string, props: string): DbResult;
    public deleteElement(elemIdJson: string): IModelStatus;
    public deleteElementAspect(aspectIdJson: string): IModelStatus;
    public deleteLinkTableRelationship(props: string): DbResult;
    public deleteModel(modelIdJson: string): IModelStatus;
    public detachChangeCache(): number;
    public dumpChangeSet(changeSet: string): void;
    public embedFont(fontProps: string): string;
    public enableTxnTesting(): void;
    public endMultiTxnOperation(): DbResult;
    public executeTest(testName: string, params: string): string;
    public exportGraphics(exportProps: ExportGraphicsProps): DbResult;
    public extractBriefcaseManagerResourcesRequest(reqOut: BriefcaseManagerResourcesRequest, reqIn: BriefcaseManagerResourcesRequest, locks: boolean, codes: boolean): void;
    public extractBulkResourcesRequest(req: BriefcaseManagerResourcesRequest, locks: boolean, codes: boolean): void;
    public extractChangeSummary(changeCacheFile: ECDb, changesetFilePath: string): ErrorStatusOrResult<DbResult, string>;
    public extractCodes(): ErrorStatusOrResult<DbResult, string>;
    public extractCodesFromFile(changeSets: string): ErrorStatusOrResult<DbResult, string>;
    public finishCreateChangeSet(): ChangeSetStatus;
    public getBriefcaseId(): number;
    public getCurrentTxnId(): TxnIdString;
    public getDbGuid(): GuidString;
    public getECClassMetaData(schema: string, className: string): ErrorStatusOrResult<IModelStatus, string>;
    public getElement(opts: string): ErrorStatusOrResult<IModelStatus, ElementProps>;
    public getGeoCoordinatesFromIModelCoordinates(points: string): string;
    public getIModelCoordinatesFromGeoCoordinates(points: string): string;
    public getIModelProps(): string;
    public getModel(opts: string): ErrorStatusOrResult<IModelStatus, string>;
    public getMultiTxnOperationDepth(): number;
    public getParentChangeSetId(): string;
    public getPendingChangeSets(): ErrorStatusOrResult<DbResult, string>;
    public getRedoString(): string;
    public getReversedChangeSetId(): string | undefined;
    public getSchema(name: string): ErrorStatusOrResult<IModelStatus, string>;
    public getSchemaItem(schemaName: string, itemName: string): ErrorStatusOrResult<IModelStatus, string>;
    public getTileContent(treeId: string, tileId: string, callback: (result: ErrorStatusOrResult<IModelStatus, Uint8Array>) => void): void;
    public pollTileContent(treeId: string, tileId: string): ErrorStatusOrResult<IModelStatus, IModelDb.TileContentState | TileContent>;
    public getTileTree(id: string, callback: (result: ErrorStatusOrResult<IModelStatus, any>) => void): void;
    public getTxnDescription(txnId: TxnIdString): string;
    public getUndoString(): string;
    public hasFatalTxnError(): boolean;
    public hasUnsavedChanges(): boolean;
    public importFunctionalSchema(): DbResult;
    public importSchema(schemaPathname: string): DbResult;
    public inBulkOperation(): boolean;
    public insertCodeSpec(name: string, specType: number, scopeReq: number): ErrorStatusOrResult<IModelStatus, string>;
    public insertElement(elemProps: string): ErrorStatusOrResult<IModelStatus, string>;
    public insertElementAspect(aspectProps: string): IModelStatus;
    public insertLinkTableRelationship(props: string): ErrorStatusOrResult<DbResult, string>;
    public insertModel(modelProps: string): ErrorStatusOrResult<IModelStatus, string>;
    public isChangeCacheAttached(): boolean;
    public isOpen(): boolean;
    public isRedoPossible(): boolean;
    public isTxnIdValid(txnId: TxnIdString): boolean;
    public isUndoPossible(): boolean;
    public logTxnError(fatal: boolean): void;
    public openIModel(dbName: string, mode: OpenMode): DbResult;
    public queryFileProperty(props: string, wantString: boolean): string | Uint8Array | undefined;
    public queryFirstTxnId(): TxnIdString;
    public queryModelExtents(options: string): ErrorStatusOrResult<IModelStatus, string>;
    public queryNextAvailableFileProperty(props: string): number;
    public queryNextTxnId(txnId: TxnIdString): TxnIdString;
    public queryPreviousTxnId(txnId: TxnIdString): TxnIdString;
    public queryProjectGuid(): GuidString;
    public readFontMap(): string;
    public reinstateTxn(): IModelStatus;
    public removePendingChangeSet(changeSetId: string): DbResult;
    public reverseAll(): IModelStatus;
    public reverseTo(txnId: TxnIdString): IModelStatus;
    public reverseTxns(numOperations: number): IModelStatus;
    public saveChanges(description?: string): DbResult;
    public saveFileProperty(props: string, strValue: string | undefined, blobVal: Uint8Array | undefined): number;
    public saveProjectGuid(guid: GuidString): DbResult;
    public setAsMaster(guid?: GuidString): DbResult;
    public setBriefcaseId(idValue: number): DbResult;
    public setBriefcaseManagerOptimisticConcurrencyControlPolicy(conflictPolicy: BriefcaseManagerOnConflictPolicy): RepositoryStatus;
    public setBriefcaseManagerPessimisticConcurrencyControlPolicy(): RepositoryStatus;
    public setDbGuid(guid: GuidString): DbResult;
    public setIModelDb(iModelDb?: IModelDb): void;
    public startCreateChangeSet(): ErrorStatusOrResult<ChangeSetStatus, string>;
    public updateElement(elemProps: string): IModelStatus;
    public updateElementAspect(aspectProps: string): IModelStatus;
    public updateIModelProps(props: string): void;
    public updateLinkTableRelationship(props: string): DbResult;
    public updateModel(modelProps: string): IModelStatus;
    public updateProjectExtents(newExtentsJson: string): void;
    public concurrentQueryInit(config: Config): boolean;
    public postConcurrentQuery(ecsql: string, bindings: string, limit: QueryLimit, quota: QueryQuota, priority: QueryPriority): { status: PostStatus, taskId: number };
    public pollConcurrentQuery(taskId: number): { status: PollStatus, result: string, rowCount: number };
    public static vacuum(dbName: string, pageSize?: number): DbResult;
  }

  export class ECDb implements IDisposable, IConcurrentQueryManager {
    constructor();
    public createDb(dbName: string): DbResult;
    public openDb(dbName: string, mode: OpenMode, upgradeProfiles?: boolean): DbResult;
    public isOpen(): boolean;
    public closeDb(): void;
    public dispose(): void;
    public saveChanges(changesetName?: string): DbResult;
    public abandonChanges(): DbResult;
    public importSchema(schemaPathName: string): DbResult;
    public concurrentQueryInit(config: Config): boolean;
    public postConcurrentQuery(ecsql: string, bindings: string, limit: QueryLimit, quota: QueryQuota, priority: QueryPriority): { status: PostStatus, taskId: number };
    public pollConcurrentQuery(taskId: number): { status: PollStatus, result: string, rowCount: number };
  }

  export class ChangedElementsECDb implements IDisposable {
    constructor();
    public dispose(): void;
    public createDb(db: DgnDb, dbName: string): DbResult;
    public openDb(dbName: string, mode: OpenMode, upgradeProfiles?: boolean): DbResult;
    public isOpen(): boolean;
    public closeDb(): void;
    public processChangesets(db: DgnDb, changesets: string, rulesetId: string, filterSpatial: boolean): DbResult;
    public getChangedElements(startChangesetId: string, endChangesetId: string): ErrorStatusOrResult<IModelStatus, ChangedElements>;
    public isProcessed(changesetId: string): boolean;
  }

  export class ECSqlStatement implements IDisposable {
    constructor();
    public prepare(db: DgnDb | ECDb, ecsql: string): StatusCodeWithMessage<DbResult>;
    public reset(): DbResult;
    public dispose(): void;
    public getBinder(param: number | string): ECSqlBinder;
    public clearBindings(): DbResult;
    public step(): DbResult;
    public stepAsync(callback: (result: DbResult) => void): void;
    public stepForInsert(): { status: DbResult, id: string };
    public stepForInsertAsync(callback: (result: { status: DbResult, id: string }) => void): void;
    public getValue(columnIndex: number): ECSqlValue;
    public getColumnCount(): number;
  }

  export class ECSqlBinder {
    constructor();
    public bindNull(): DbResult;
    public bindBlob(base64String: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): DbResult;
    public bindBoolean(val: boolean): DbResult;
    public bindDateTime(isoString: string): DbResult;
    public bindDouble(val: number): DbResult;
    public bindGuid(guidStr: GuidString): DbResult;
    public bindId(hexStr: Id64String): DbResult;
    public bindInteger(val: number | string): DbResult;
    public bindPoint2d(x: number, y: number): DbResult;
    public bindPoint3d(x: number, y: number, z: number): DbResult;
    public bindString(val: string): DbResult;
    public bindNavigation(navIdHexStr: Id64String, relClassName?: string, relClassTableSpace?: string): DbResult;
    public bindMember(memberName: string): ECSqlBinder;
    public addArrayElement(): ECSqlBinder;
  }

  export class ECSqlColumnInfo {
    constructor();
    public getType(): number;
    public getPropertyName(): string;
    public getAccessString(): string;
    public isEnum(): boolean;
    public isSystemProperty(): boolean;
    public isGeneratedProperty(): boolean;
    public getRootClassTableSpace(): string;
    public getRootClassName(): string;
    public getRootClassAlias(): string;
  }

  export class ECSqlValue {
    constructor();
    public getColumnInfo(): ECSqlColumnInfo;
    public isNull(): boolean;
    public getBlob(): Uint8Array;
    public getBoolean(): boolean;
    public getDateTime(): string;
    public getDouble(): number;
    public getGeometry(): string;
    public getGuid(): GuidString;
    public getId(): Id64String;
    public getClassNameForClassId(): string;
    public getInt(): number;
    public getInt64(): number;
    public getPoint2d(): { x: number, y: number };
    public getPoint3d(): { x: number, y: number, z: number };
    public getString(): string;
    public getEnum(): Array<{ schema: string, name: string, key: string, value: number | string }> | undefined;
    public getNavigation(): { id: Id64String, relClassName?: string };
    public getStructIterator(): ECSqlValueIterator;
    public getArrayIterator(): ECSqlValueIterator;
  }

  export class ECSqlValueIterator {
    constructor();
    public moveNext(): boolean;
    public getCurrent(): ECSqlValue;
  }

  export class SqliteStatement implements IDisposable {
    constructor();
    public prepare(db: DgnDb | ECDb, sql: string): StatusCodeWithMessage<DbResult>;
    public isReadonly(): boolean;
    public reset(): DbResult;
    public dispose(): void;
    public bindNull(param: number | string): DbResult;
    public bindBlob(param: number | string, val: Uint8Array | ArrayBuffer | SharedArrayBuffer): DbResult;
    public bindDouble(param: number | string, val: number): DbResult;
    public bindInteger(param: number | string, val: number | string): DbResult;
    public bindString(param: number | string, val: string): DbResult;
    public bindId(param: number | string, hexStr: Id64String): DbResult;
    public bindGuid(param: number | string, guidStr: GuidString): DbResult;
    public clearBindings(): DbResult;
    public step(): DbResult;
    public stepAsync(callback: (result: DbResult) => void): void;
    public getColumnCount(): number;
    public getColumnType(columnIndex: number): number;
    public getColumnName(columnIndex: number): string;
    public isValueNull(columnIndex: number): boolean;
    public getValueBlob(columnIndex: number): Uint8Array;
    public getValueDouble(columnIndex: number): number;
    public getValueInteger(columnIndex: number): number;
    public getValueString(columnIndex: number): string;
    public getValueId(columnIndex: number): Id64String;
    public getValueGuid(columnIndex: number): GuidString;
  }

  export const enum ECPresentationStatus { // tslint:disable-line:no-const-enum
    Success = 0,
    Error = 1,
    InvalidArgument = Error + 1,
  }

  export class ECPresentationManager implements IDisposable {
    constructor(id?: string);
    public forceLoadSchemas(db: DgnDb, callback: (result: ECPresentationStatus) => void): void;
    public setupRulesetDirectories(directories: string[]): ErrorStatusOrResult<ECPresentationStatus, void>;
    public setupLocaleDirectories(directories: string[]): ErrorStatusOrResult<ECPresentationStatus, void>;
    public setRulesetVariableValue(rulesetId: string, variableId: string, type: string, value: any): ErrorStatusOrResult<ECPresentationStatus, void>;
    public getRulesetVariableValue(rulesetId: string, variableId: string, type: string): ErrorStatusOrResult<ECPresentationStatus, any>;
    public getRulesets(rulesetId: string): ErrorStatusOrResult<ECPresentationStatus, string>;
    public addRuleset(serializedRuleset: string): ErrorStatusOrResult<ECPresentationStatus, string>;
    public removeRuleset(rulesetId: string, hash: string): ErrorStatusOrResult<ECPresentationStatus, boolean>;
    public clearRulesets(): ErrorStatusOrResult<ECPresentationStatus, void>;
    public handleRequest(db: DgnDb, options: string, callback: (result: ErrorStatusOrResult<ECPresentationStatus, string>) => void): void;
    public dispose(): void;
  }

  export namespace ECSchemaXmlContext {
    interface SchemaKey {
      name: string;
      readVersion: number;
      writeVersion: number;
      minorVersion: number;
    }

    const enum SchemaMatchType {
      Identical = 0,               // Find exact VersionRead, VersionWrite, VersionMinor match as well as Data
      Exact = 1,                   // Find exact VersionRead, VersionWrite, VersionMinor match.
      LatestWriteCompatible = 2,   // Find latest version with matching VersionRead and VersionWrite
      Latest = 3,                  // Find latest version.
      LatestReadCompatible = 4,    // Find latest version with matching VersionRead
    }

    type SchemaLocaterCallback = (key: SchemaKey, matchType: SchemaMatchType) => string | undefined | void;
  }

  export class ECSchemaXmlContext {
    constructor();
    public addSchemaPath(path: string): void;
    public setSchemaLocater(locater: ECSchemaXmlContext.SchemaLocaterCallback): void;
    public readSchemaFromXmlFile(filePath: string): ErrorStatusOrResult<BentleyStatus, string>;
  }

  export class SnapRequest {
    constructor();
    public doSnap(db: DgnDb, request: any, callback: (result: ErrorStatusOrResult<IModelStatus, any>) => void): void;
    public cancelSnap(): void;
  }

  export class DisableNativeAssertions implements IDisposable {
    constructor();
    public dispose(): void;
  }

  export class ImportContext implements IDisposable {
    constructor(sourceDb: DgnDb, targetDb: DgnDb);
    public dispose(): void;
    public addCodeSpecId(sourceId: Id64String, targetId: Id64String): BentleyStatus;
    public addElementId(sourceId: Id64String, targetId: Id64String): BentleyStatus;
    public findCodeSpecId(sourceId: Id64String): Id64String;
    public findElementId(sourceId: Id64String): Id64String;
    public cloneElement(sourceId: Id64String): ElementProps;
    public importCodeSpec(sourceId: Id64String): Id64String;
    public importFont(sourceId: number): number;
  }

  /**
   * Temporary implementation to allow crashing the backend for testing purposes
   * @internal
   */
  export class NativeDevTools {
    public static signal(signalType: number): boolean;
  }
}
