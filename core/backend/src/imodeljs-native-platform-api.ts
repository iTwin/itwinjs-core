/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {
  IModelStatus, StatusCodeWithMessage, RepositoryStatus, BentleyStatus, ChangeSetApplyOption, DbResult, DbOpcode, OpenMode, IDisposable, ChangeSetStatus,
} from "@bentley/bentleyjs-core";

/**
 * The primary key for the DGN_TABLE_Txns table.
 * @hidden
 */
export interface NativeTxnId {
  readonly _id: string;
}

/**
 * The return type of synchronous functions that may return an error or a successful result.
 * @hidden
 */
export interface ErrorStatusOrResult<ErrorCodeType, ResultType> {
  /** Error from the operation. This property is defined if and only if the operation failed. */
  error?: StatusCodeWithMessage<ErrorCodeType>;

  /** Result of the operation. This property is defined if the operation completed successfully */
  result?: ResultType;
}

/**
 * A request to send on to iModelHub.
 * @hidden
 */
export declare class NativeBriefcaseManagerResourcesRequest {
  /** Forget the requests. */
  public reset(): void;

  /** Contains no requests? */
  public isEmpty(): boolean;

  /** Get the request in JSON format */
  public toJSON(): string;
}

/* How to handle a conflict
export const enum NativeBriefcaseManagerOnConflict {
    // Reject the incoming change
    RejectIncomingChange = 0,
    // Accept the incoming change
    AcceptIncomingChange = 1,
}
*/

/**
 * The options for how conflicts are to be handled during change-merging in an OptimisticConcurrencyControlPolicy.
 * The scenario is that the caller has made some changes to the *local* briefcase. Now, the caller is attempting to
 * merge in changes from iModelHub. The properties of this policy specify how to handle the *incoming* changes from iModelHub.
 * @hidden
 */
export interface NativeBriefcaseManagerOnConflictPolicy {
  /** What to do with the incoming change in the case where the same entity was updated locally and also would be updated by the incoming change. */
  updateVsUpdate: /*NativeBriefcaseManagerOnConflict*/number;
  /** What to do with the incoming change in the case where an entity was updated locally and would be deleted by the incoming change. */
  updateVsDelete: /*NativeBriefcaseManagerOnConflict*/number;
  /** What to do with the incoming change in the case where an entity was deleted locally and would be updated by the incoming change. */
  deleteVsUpdate: /*NativeBriefcaseManagerOnConflict*/number;
}

/**
 * The NativeDgnDb class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeDgnDb {
  constructor();

  /** Get the name of the *assets* directory. */
  public static getAssetsDir(): string;

  /** Get the IModelProps of this iModel. */
  public getIModelProps(): string;

  /**
   * Create a local iModel.
   * @param fileName The file name for the new iModel
   * @param props The properties of the new iModel. See CreateIModelProps in IModel.ts
   * @return non-zero error status if operation failed.
   */
  public createIModel(fileName: string, props: string): DbResult;

  /**
   * Open a local iModel.
   * @param dbName The full path to the iModel in the local file system
   * @param mode The open mode
   * @return non-zero error status if operation failed.
   */
  public openIModel(dbName: string, mode: OpenMode): DbResult;

  /** Close this iModel. */
  public closeIModel(): void;

  /**
   * Apply change sets
   * @param cachePath Path to the root of the disk cache
   */
  public applyChangeSets(changeSets: string, processOptions: ChangeSetApplyOption): ChangeSetStatus;

  /**
   * Start creating a new change set with local changes
   */
  public startCreateChangeSet(): ErrorStatusOrResult<ChangeSetStatus, string>;

  /**
   * Finish creating a new change set with local changes
   */
  public finishCreateChangeSet(): ChangeSetStatus;

  /**
   * Abandon creating a new change set with local changes
   */
  public abandonCreateChangeSet(): void;

  /**
   * Dumps a change set
   */
  public dumpChangeSet(changeSet: string): void;

  /**
   * Extract codes from change set that is being created
   */
  public extractCodes(): ErrorStatusOrResult<DbResult, string>;

  /**
   * Extract codes from a change set file
   */
  public extractCodesFromFile(changeSets: string): ErrorStatusOrResult<DbResult, string>;

  /**
   * Get list of change sets that failed updating their codes
   */
  public getPendingChangeSets(): ErrorStatusOrResult<DbResult, string>;

  /**
   * Mark change set as failed to update codes
   */
  public addPendingChangeSet(changeSetId: string): DbResult;

  /**
   * Remove change set from failed change sets list
   */
  public removePendingChangeSet(changeSetId: string): DbResult;

  /** Creates an EC change cache for this iModel (but does not attach it).
   * @param changeCacheFile The created change cache ECDb file
   * @param changeCachePath The full path to the EC change cache file in the local file system
   * @return non-zero error status if operation failed.
   */
  public createChangeCache(changeCacheFile: NativeECDb, changeCachePath: string): DbResult;

  /** Attaches an EC change cache file to this iModel.
   * @param changeCachePath The full path to the EC change cache file in the local file system
   * @return non-zero error status if operation failed.
   */
  public attachChangeCache(changeCachePath: string): DbResult;

  /** Determines whether the EC Changes cache file is attached to this iModel.
   * @return true if the changes cache is attached. false otherwise
   */
  public isChangeCacheAttached(): boolean;

  public detachChangeCache(): number;

  /** Extracts a change summary from the specified Changeset file
   * @param changeCacheFile The change cache ECDb file where the extracted change summary will be persisted
   * @param changesetFilePath The full path to the SQLite changeset file in the local file system
   * @return The ChangeSummary ECInstanceId as hex string or error codes in case of failure
   */
  public extractChangeSummary(changeCacheFile: NativeECDb, changesetFilePath: string): ErrorStatusOrResult<DbResult, string>;

  /**
   * Set the briefcase Id of this iModel.
   * @param idValue The briefcase Id value.
   */
  public setBriefcaseId(idValue: number): DbResult;

  /** Get the briefcase Id of this iModel. */
  public getBriefcaseId(): number;

  /**
   * Get the change set the iModel was reversed to
   * @return Returns the change set id if the iModel was reversed, or undefined if the iModel was not reversed.
   */
  public getReversedChangeSetId(): string | undefined;

  /**
   * Get the Id of the last change set that was merged into or created from the Db. This is the parent for any new change sets that will be created from the iModel.
   * @return Returns an empty string if the iModel is in it's initial state (with no change sets), or if it's a standalone briefcase disconnected from the Hub.
   */
  public getParentChangeSetId(): string;

  /* Get the GUID of this iModel */
  public getDbGuid(): string;

  /* Set the GUID of this iModel */
  public setDbGuid(guid: string): DbResult;

  /* Set as master iModel
   * @param guid optionally provide GUID for the iModel. If not provided one will be generated by the method.
   */
  public setAsMaster(guid?: string): DbResult;

  /**
   * Save any pending changes to this iModel.
   * @param description optional description of changes
   * @return non-zero error status if save failed.
   */
  public saveChanges(description?: string): DbResult;

  /** Abandon changes
   * @return non-zero error status if operation failed.
   */
  public abandonChanges(): DbResult;

  /**
   * Import an EC schema.
   * There are a number of restrictions when importing schemas into a briefcase.
   * When importing into a briefcase, this function will acquire the schema lock. That means that that briefcase must be at the tip of the revision
   * history in iModelHub. If not, this function will return SchemaLockFailed.
   * Importing or upgrading a schema into a briefcase must be done in isolation from all other kinds of changes. That means two things:
   * there must be no pending local changes. All local changes must be pushed to iModelHub. This function will return SchemaImportFailed if that is not true.
   * Also, the caller must push the results of this function to iModelHub before making other changes to the briefcase.
   * @param schemaPathname The full path to the .xml file in the local file system.
   * @return non-zero error status if the operation failed, including SchemaImportFailed if the schema is invalid.
   */
  public importSchema(schemaPathname: string): DbResult;

  /**
   * Get an element's properties
   * @param opts Identifies the element
   * @returns In case of success, the result property of the returned object will be the element's properties.
   */
  public getElement(opts: string): ErrorStatusOrResult<IModelStatus, any>;

  /**
   * Get the properties of a Model
   * @param opts Identifies the model
   * @returns In case of success, the result property of the returned object will be the model's properties in stringified JSON format.
   */
  public getModel(opts: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Query for the extents of a GeometricModel.
   * @param options Identifies the model
   * @returns In case of success, the result property of the returned object will be the model's extents (AxisAlignedBox3d) in stringified JSON format.
   */
  public queryModelExtents(options: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Get the properties of a tile tree
   * @param id Identifies the tile tree
   * @returns In case of success, the result property of the returned object will be the tile tree's properties in stringified JSON format.
   */
  public getTileTree(id: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Get the properties of a set of tiles belonging to a single tile tree
   * @param treeId The ID of the tile tree
   * @param tileIds The IDs of the tiles to retrieve
   * @returns In case of success, the result property will be a stringified JSON array of tile properties.
   */
  public getTiles(treeId: string, tileIds: string[]): ErrorStatusOrResult<IModelStatus, any>;

  /**
   * Insert an element.
   * @param elemProps The element's properties, in stringified JSON format.
   * @return In case of success, the result property of the returned object will be the element's ID (as a hex string)
   */
  public insertElement(elemProps: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Update an element.
   * @param elemProps The element's properties, in stringified JSON format.
   * @return non-zero error status if the operation failed.
   */
  public updateElement(elemProps: string): IModelStatus;

  /**
   * Delete an element from this iModel.
   * @param elemIdJson The element's Id, in stringified JSON format
   * @return non-zero error status if the operation failed.
   */
  public deleteElement(elemIdJson: string): IModelStatus;

  /**
   * Insert a LinkTableRelationship.
   * @param props The linkTableRelationship's properties, in stringified JSON format.
   * @return In case of success, the result property of the returned object will be the ID of the new LinkTableRelationship instance (as a hex string)
   */
  public insertLinkTableRelationship(props: string): ErrorStatusOrResult<DbResult, string>;

  /**
   * Update a LinkTableRelationship.
   * @param props The LinkTableRelationship's properties, in stringified JSON format.
   * @return non-zero error status if the operation failed.
   */
  public updateLinkTableRelationship(props: string): DbResult;

  /**
   * Delete a LinkTableRelationship.
   * @param props The LinkTableRelationship's properties, in stringified JSON format. Only classFullName and id are required.
   * @return non-zero error status if the operation failed.
   */
  public deleteLinkTableRelationship(props: string): DbResult;

  /**
   * Insert a new CodeSpec
   * @param name name of the CodeSpec
   * @param specType must be one of CodeScopeSpec::Type
   * @param scopeReq must be one of CodeScopeSpec::ScopeRequirement
   * @return In case of success, the result property of the returned object will be the ID of the new CodeSpec instance (as a hex string)
   */
  public insertCodeSpec(name: string, specType: number, scopeReq: number): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Insert a model.
   * @param modelProps The model's properties, in stringified JSON format.
   * @return In case of success, the result property of the returned object will be the ID of the new Model (as a hex string)
   */
  public insertModel(modelProps: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Update a model.
   * @param modelProps The model's properties, in stringified JSON format.
   * @return non-zero error status if the operation failed.
   */
  public updateModel(modelProps: string): IModelStatus;

  /**
   * Delete a model.
   * @param modelIdJson The model's Id, in stringified JSON format
   * @return non-zero error status if the operation failed.
   */
  public deleteModel(modelIdJson: string): IModelStatus;

  /**
   * Update the imodel project extents.
   * @param newExtentsJson The new project extents in stringified JSON format
   */
  public updateProjectExtents(newExtentsJson: string): void;

  /**
   * Update the iModel properties see
   * @param props the [IModelProps]($common) in stringified JSON
   */
  public updateIModelProps(props: string): void;

  /**
   * Format an element's properties, suitable for display to the user.
   * @param id The element's Id, in stringified JSON format
   * @param on success, the result property of the returned object will be the object's properties, in stringified JSON format.
   */
  public getElementPropertiesForDisplay(id: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Get information about an ECClass
   * @param schema The name of the ECSchema
   * @param className The name of the ECClass
   * @param on success, the result property of the returned object will be an object containing the properties of the class, in stringified JSON format.
   */
  public getECClassMetaData(schema: string, className: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Get a SchemaItem by schema and item name
   * @param schemaName The name of the ECSchema
   * @param itemName The name of the SchemaItem
   * @param on success, the result property of the returned object will be an object containing the schema item in stringified JSON format.
   */
  public getSchemaItem(schemaName: string, itemName: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Get a Schema by name
   * @param name The name of the ECSchema
   * @param on success, the result property of the returned object will be an object containing the schema in stringified JSON format.
   */
  public getSchema(name: string): ErrorStatusOrResult<IModelStatus, string>;

  /**
   * Add the lock, code, and other resource request that would be needed in order to carry out the specified operation.
   * @param req The request object, which accumulates requests.
   * @param elemId The ID of an existing element or the {modelid, code} properties that specify a new element.
   * @param opcode The operation that will be performed on the element.
   */
  public buildBriefcaseManagerResourcesRequestForElement(req: NativeBriefcaseManagerResourcesRequest, elemId: string, opcode: DbOpcode): RepositoryStatus;

  /**
   * Add the lock, code, and other resource request that would be needed in order to carry out the specified operation.
   * @param req The request object, which accumulates requests.
   * @param modelId The ID of a model
   * @param opcode The operation that will be performed on the model.
   */
  public buildBriefcaseManagerResourcesRequestForModel(req: NativeBriefcaseManagerResourcesRequest, modelId: string, opcode: DbOpcode): RepositoryStatus;

  /**
   * Add the resource request that would be needed in order to carry out the specified operation.
   * @param req The request object, which accumulates requests.
   * @param relKey Identifies a LinkTableRelationship: {classFullName, id}
   * @param opcode The operation that will be performed on the LinkTableRelationships.
   */
  public buildBriefcaseManagerResourcesRequestForLinkTableRelationship(req: NativeBriefcaseManagerResourcesRequest, relKey: string, opcode: DbOpcode): RepositoryStatus;

  /**
   * Extract requests from the current bulk operation and append them to reqOut
   * @param req The pending requests.
   * @param locks Extract lock requests?
   * @param codes Extract Code requests?
   */
  public extractBulkResourcesRequest(req: NativeBriefcaseManagerResourcesRequest, locks: boolean, codes: boolean): void;

  /**
   * Extract requests from reqIn and append them to reqOut
   * @param reqOut The output request
   * @param reqIn The input request
   * @param locks Extract lock requests?
   * @param codes Extract Code requests?
   */
  public extractBriefcaseManagerResourcesRequest(reqOut: NativeBriefcaseManagerResourcesRequest, reqIn: NativeBriefcaseManagerResourcesRequest, locks: boolean, codes: boolean): void;

  /**
   * Append reqIn to reqOut
   * @param reqOut The request to be augmented
   * @param reqIn The request to read
   */
  public appendBriefcaseManagerResourcesRequest(reqOut: NativeBriefcaseManagerResourcesRequest, reqIn: NativeBriefcaseManagerResourcesRequest): void;

  /** Start bulk update mode. Valid only with the pessimistic concurrency control policy */
  public briefcaseManagerStartBulkOperation(): RepositoryStatus;

  /** End bulk update mode. This will wait for locks and codes. Valid only with the pessimistic concurrency control policy */
  public briefcaseManagerEndBulkOperation(): RepositoryStatus;

  /** Check if there is a bulk operation in progress. */
  public inBulkOperation(): boolean;

  /**
   *  The the pessimistic concurrency control policy.
   */
  public setBriefcaseManagerPessimisticConcurrencyControlPolicy(): RepositoryStatus;

  /** Set the optimistic concurrency control policy.
   * @param policy The policy to used
   * @return non-zero if the policy could not be set
   */
  public setBriefcaseManagerOptimisticConcurrencyControlPolicy(conflictPolicy: NativeBriefcaseManagerOnConflictPolicy): RepositoryStatus;

  /** Query the ID of the first entry in the local Txn table, if any. */
  public txnManagerQueryFirstTxnId(): NativeTxnId;
  /** Query the ID of the entry in the local Txn table that comes after the specified Txn, if any. */
  public txnManagerQueryNextTxnId(txnId: NativeTxnId): NativeTxnId;
  /** Query the ID of the entry in the local Txn table that comes before the specified Txn, if any. */
  public txnManagerQueryPreviousTxnId(txnId: NativeTxnId): NativeTxnId;
  /** Query the ID of the most recent entry in the local Txn table, if any. */
  public txnManagerGetCurrentTxnId(): NativeTxnId;
  /** Get the description of the specified Txn. */
  public txnManagerGetTxnDescription(txnId: NativeTxnId): string;
  /** Check if the specified TxnId is valid. The above query functions will return an invalid ID to indicate failure. */
  public txnManagerIsTxnIdValid(txnId: NativeTxnId): boolean;
  /** Check if there are un-saved changes in memory. */
  public txnManagerHasUnsavedChanges(): boolean;

  /** read the font map. */
  public readFontMap(): string;

  /** embed a font. */
  public embedFont(fontProps: string): string;

  /** query a file property.
   * @param props the stringified version of the FilePropertyProps
   * @param wantString true to query the string property, false for the blob property
   * @returns requested value or undefined if property does not exist
   */
  public queryFileProperty(props: string, wantString: boolean): string | ArrayBuffer | undefined;

  /** save or delete a file property.
   * @param props the stringified version of the FilePropertyProps
   * @param value the value to save. If undefined, the file property is deleted.
   * @returns 0 if property was saved (or deleted), error status otherwise
   */
  public saveFileProperty(props: string, value: string | ArrayBuffer | undefined): number;

  /** query the next available major id for the given file property. If no properties yet exist, will return 0. */
  public queryNextAvailableFileProperty(props: string): number;

  /**
   * Execute a test by name
   * @param testName The name of the test to execute
   * @param params A JSON string with the parameters for the test
   */
  public executeTest(testName: string, params: string): string;
}

/**
 * The NativeECDb class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECDb implements IDisposable {
  constructor();
  /**
   * Create a new ECDb.
   * @param dbName The full path to the ECDb in the local file system
   * @return non-zero error status if operation failed.
   */
  public createDb(dbName: string): DbResult;

  /** Open a existing ECDb.
   * @param dbName The full path to the ECDb in the local file system
   * @param mode The open mode
   * @param upgradeProfiles If true and open mode is read/write, the file's profiles are upgraded (if necessary)
   * @return non-zero error status if operation failed.
   */
  public openDb(dbName: string, mode: OpenMode, upgradeProfiles?: boolean): DbResult;

  /** Check to see if connection to ECDb is open or not.
   * @return true if connection is open
   */
  public isOpen(): boolean;

  /** Check to see if connection to ECDb is open or not.
   * @return true if connection was closed
   */
  public closeDb(): void;

  /** Dispose of the native ECDb object. */
  public dispose(): void;

  /** Save changes to ecdb
   * @param changesetName The name of the operation that generated these changes. If transaction tracking is enabled.
   * @return non-zero error status if operation failed.
   */
  public saveChanges(changesetName?: string): DbResult;

  /** Abandon changes
   * @return non-zero error status if operation failed.
   */
  public abandonChanges(): DbResult;

  /** Import ECSchema into ECDb
   * @param schemaPathName Path to ECSchema file on disk. All reference schema should also be present on same path.
   * @return non-zero error status if operation failed.
   */
  public importSchema(schemaPathName: string): DbResult;
}

/**
 * The NativeECSqlStatement class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECSqlStatement implements IDisposable {
  constructor();

  /**
   * Prepare an ECSQL statement.
   * @param db The NativeDgnDb or NativeECDb object
   * @param ecsql The ECSQL to prepare
   * @return Returns the Zero status in case of success. Non-zero error status in case of failure. The error's message property will contain additional information.
   */
  public prepare(db: NativeDgnDb | NativeECDb, ecsql: string): StatusCodeWithMessage<DbResult>;

  /** Reset the statement to just before the first row.
   * @return Returns non-zero error status in case of failure.
   */
  public reset(): DbResult;

  /** Dispose of the native ECSqlStatement object - call this when finished stepping a statement, but only if the statement is not shared. */
  public dispose(): void;

  /**
   * Gets a binder for the specified parameter. It can be used to bind any type of values to the parameter.
   * @param param Index (1-based) or name (without leading colon) of the parameter.
   * @return Returns the binder for the specified parameter
   */
  public getBinder(param: number | string): NativeECSqlBinder;

  /** Clear the bindings of this statement. See bindValues.
   * @return Returns a non-zero error status in case of failure.
   */
  public clearBindings(): DbResult;

  /** Step this statement to move to the next row.
   * @return Returns BE_SQLITE_ROW if the step moved to a new row. Returns BE_SQLITE_DONE if the step failed because there is no next row. Another non-zero error status if step failed because of an error.
   */
  public step(): DbResult;

  /** Step this INSERT statement and returns the status along with the ECInstanceId of the newly inserted row.
   * @return Returns BE_SQLITE_DONE if the insert was successful. Returns another non-zero error status if step failed because of an error.
   */
  public stepForInsert(): { status: DbResult, id: string };

  /**
   * Get the value of the specified column for the current row
   * @param columnIndex Index (0-based) of the column in the ECSQL SELECT clause for which the value is to be retrieved.
   * @return Returns the ECSQL value of the specified column for the current row
   */
  public getValue(columnIndex: number): NativeECSqlValue;

  /**
   * Get the number of ECSQL columns in the result set after calling step on a SELECT statement.
   * @return Returns the ECSQL value of the specified column for the current row
   */
  public getColumnCount(): number;
}

/**
 * The NativeECSqlBinder class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECSqlBinder {
  constructor();

  /** Binds null to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindNull(): DbResult;

  /** Binds a BLOB, formatted as Base64 string, to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindBlob(base64String: string | ArrayBuffer | SharedArrayBuffer): DbResult;

  /** Binds a Boolean to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindBoolean(val: boolean): DbResult;

  /** Binds a DateTime, formatted as ISO string, to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindDateTime(isoString: string): DbResult;

  /** Binds a double to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindDouble(val: number): DbResult;

  /** Binds an Guid, formatted as GUID string, to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindGuid(guidStr: string): DbResult;

  /** Binds an Id, formatted as hexadecimal string, to the parameter represented by this binder
   * @return non-zero error status in case of failure.
   */
  public bindId(hexStr: string): DbResult;

  /** Binds an int to the parameter represented by this binder
   * @param val Integral value, either as number or as decimal or hexadecimal string (for the case
   * where the integer is larger than the JS accuracy threshold)
   * @return non-zero error status in case of failure.
   */
  public bindInteger(val: number | string): DbResult;

  /** Binds a Point2d to the parameter represented by this binder.
   * @return non-zero error status in case of failure.
   */
  public bindPoint2d(x: number, y: number): DbResult;

  /** Binds a Point3d to the parameter represented by this binder.
   * @return non-zero error status in case of failure.
   */
  public bindPoint3d(x: number, y: number, z: number): DbResult;

  /** Binds a string to the parameter represented by this binder.
   * @return non-zero error status in case of failure.
   */
  public bindString(val: string): DbResult;

  /** Binds a Navigation property value to the parameter represented by this binder.
   * @param navIdHexStr Id of the related instance represented by the navigation property (formatted as hexadecimal string)
   * @param relClassName Name of the relationship class of the navigation property (can be undefined if it is not mandatory)
   * @param relClassTableSpace In case the relationship of the navigation property is persisted in an attached ECDb file, specify the table space.
   *                           If undefined, ECDb will first look in the primary file and then in the attached ones.
   * @return non-zero error status in case of failure.
   */
  public bindNavigation(navIdHexStr: string, relClassName?: string, relClassTableSpace?: string): DbResult;

  /** Gets a binder for the specified member of a struct parameter
   * @return Struct member binder.
   */
  public bindMember(memberName: string): NativeECSqlBinder;

  /** Adds a new array element to the array parameter and returns the binder for the new array element
   * @return Binder for the new array element.
   */
  public addArrayElement(): NativeECSqlBinder;
}

/**
 * The NativeECSqlColumnInfo class that is projected by IModelJsNative.
 * @remarks No need to dispose this is its native counterpart is owned by the IECSqlValue.
 * @hidden
 */
export declare class NativeECSqlColumnInfo {
  constructor();

  /** Gets the data type of the column.
   *  @returns one of the values of the enum ECSqlValueType values, defined in imodeljs-core/common.
   *  (enums cannot be defined in the Native)
   */
  public getType(): number;

  /** Gets the name of the property backing the column.
   * @remarks If this column is backed by a generated property, i.e. it represents ECSQL expression,
   * the access string consists of the name of the generated property.
   */
  public getPropertyName(): string;

  /** Gets the full access string to the corresponding ECSqlValue starting from the root class.
   * @remarks If this column is backed by a generated property, i.e. it represents ECSQL expression,
   * the access string consists of the ECSQL expression.
   */
  public getAccessString(): string;

  /** Indicates whether the column refers to a system property (e.g. id, className) backing the column. */
  public isSystemProperty(): boolean;

  /** Indicates whether the column is backed by a generated property or not. For SELECT clause items that are expressions other
   * than simply a reference to an ECProperty, a property is generated containing the expression name.
   */
  public isGeneratedProperty(): boolean;

  /** Gets the table space in which this root class is persisted.
   * @remarks for classes in the primary file the table space is MAIN. For classes in attached
   * files, the table space is the name by which the file was attached (see BentleyApi::BeSQLite::Db::AttachDb)
   * For generated properties the table space is empty
   */
  public getRootClassTableSpace(): string;

  /** Gets the fully qualified name of the ECClass of the top-level ECProperty backing this column. */
  public getRootClassName(): string;

  /** Gets the class alias of the root class to which the column refers to.
   * @returns Returns the alias of root class the column refers to or an empty string if no class alias was specified in the select clause
   */
  public getRootClassAlias(): string;
}

/**
 * The NativeECSqlValue class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECSqlValue {
  constructor();

  /** Get information about the ECSQL SELECT clause column this value refers to. */
  public getColumnInfo(): NativeECSqlColumnInfo;

  public isNull(): boolean;
  /** Get value as a BLOB. */
  public getBlob(): ArrayBuffer;
  /** Get value as boolean. */
  public getBoolean(): boolean;
  /** Get value as date time, formatted as ISO8601 string. */
  public getDateTime(): string;
  /** Get value as double. */
  public getDouble(): number;
  /** Get value as IGeometry formatted as JSON. */
  public getGeometry(): string;
  /** Get value as GUID, formatted as GUID string. */
  public getGuid(): string;
  /** Get value as id, formatted as hexadecimal string. */
  public getId(): string;
  /** If this ECSqlValue represents a class id, this method returns the fully qualified class name. */
  public getClassNameForClassId(): string;
  /** Get value as int. */
  public getInt(): number;
  /** Get value as int64. This method does not deal with JS accuracy issues of int64 values greater than 2^53. */
  public getInt64(): number;
  /** Get value as Point2d. */
  public getPoint2d(): { x: number, y: number };
  /** Get value as Point3d. */
  public getPoint3d(): { x: number, y: number, z: number };
  /** Get value as string. */
  public getString(): string;
  /** Get value as Navigation property value. */
  public getNavigation(): { id: string, relClassName?: string };

  /** Get an iterator for iterating the struct members of this struct value. */
  public getStructIterator(): NativeECSqlValueIterator;
  /** Get an iterator for iterating the array elements of this array value. */
  public getArrayIterator(): NativeECSqlValueIterator;
}

/**
 * The NativeECSqlValueIterator class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECSqlValueIterator {
  constructor();
  /**
   * Move the iterator to the next ECSqlValue.
   * @returns Returns true if the iterator now points to the next element. Returns false if the iterator reached the end.
   */
  public moveNext(): boolean;
  /**
   * Get the ECSqlValue the iterator is currently pointing to.
   */
  public getCurrent(): NativeECSqlValue;
}

/**
 * The NativeSqliteStatement class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeSqliteStatement implements IDisposable {
  constructor();

  /**
   * Prepare a SQLite SQL statement.
   * @param db The NativeDgnDb or NativeECDb object
   * @param sql The SQL to prepare
   * @return Returns the Zero status in case of success. Non-zero error status in case of failure. The error's message property will contain additional information.
   */
  public prepare(db: NativeDgnDb | NativeECDb, sql: string): StatusCodeWithMessage<DbResult>;

  /**
   * Indicates whether the prepared statement makes no **direct* changes to the content of the file
   * or not. See [SQLite docs](https://www.sqlite.org/c3ref/stmt_readonly.html) for details.
   * @return Returns True, if the statement is readonly. False otherwise.
   */
  public isReadonly(): boolean;

  /** Reset the statement to just before the first row.
   * @return Returns non-zero error status in case of failure.
   */
  public reset(): DbResult;

  /** Dispose of the NativeSqliteStatement object - call this when finished stepping a statement, but only if the statement is not shared. */
  public dispose(): void;

  /** Binds null to the specified SQL parameter.
   * @param param Index (1-based) or name (without leading colon) of the parameter.
   * @return non-zero error status in case of failure.
   */
  public bindNull(param: number | string): DbResult;

  /** Binds a BLOB to the specified SQL parameter.
   * @param param Index (1-based) or name (without leading colon) of the parameter.
   * @param val BLOB value
   * @return non-zero error status in case of failure.
   */
  public bindBlob(param: number | string, val: ArrayBuffer | SharedArrayBuffer): DbResult;

  /** Binds a double to the specified SQL parameter.
   * @param param Index (1-based) or name (without leading colon) of the parameter.
   * @param val Double value
   * @return non-zero error status in case of failure.
   */
  public bindDouble(param: number | string, val: number): DbResult;

  /** Binds an integer to the specified SQL parameter.
   * @param param Index (1-based) or name (without leading colon) of the parameter.
   * @param val Integral value, either as number or as decimal or hexadecimal string (for the case
   * where the integer is larger than the JS accuracy threshold)
   * @return non-zero error status in case of failure.
   */
  public bindInteger(param: number | string, val: number | string): DbResult;

  /** Binds a string to the specified SQL parameter.
   * @param param Index (1-based) or name (without leading colon) of the parameter.
   * @param val String value
   * @return non-zero error status in case of failure.
   */
  public bindString(param: number | string, val: string): DbResult;

  /** Clear the bindings of this statement.
   * @return Returns a non-zero error status in case of failure.
   */
  public clearBindings(): DbResult;

  /** Step this statement to move to the next row.
   * @return Returns BE_SQLITE_ROW if the step moved to a new row. Returns BE_SQLITE_DONE if the step failed because there is no next row. Another non-zero error status if step failed because of an error.
   */
  public step(): DbResult;

  /**
   * Get the number of SQL columns in the result set after calling step on a SELECT statement.
   * @return Returns the SQL value of the specified column for the current row
   */
  public getColumnCount(): number;

  /**
   * Get the data type of the specified column for the current row.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   * @return Returns the data type of the specified column for the current row (as values of the DbValueType enum in native BeSQLite)
   */
  public getColumnType(columnIndex: number): number;

  /**
   * Get the name of the specified column for the current row.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   * @return Returns the name of the specified column for the current row
   */
  public getColumnName(columnIndex: number): string;

  /**
   * Indicates whether the value of the specified column for the current row is null or not.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   * @return Returns true if the value of the specified column for the current row is null. false otherwise.
   */
  public isValueNull(columnIndex: number): boolean;
  /**
   * Get value as a BLOB of the specified column for the current row.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   */
  public getValueBlob(columnIndex: number): ArrayBuffer;
  /** Get value as boolean of the specified column for the current row.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   */
  public getValueDouble(columnIndex: number): number;
  /** Get value as GUID, formatted as GUID string of the specified column for the current row.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   */
  public getValueInteger(columnIndex: number): number;
  /** Get value as string of the specified column for the current row.
   * @param columnIndex Index (0-based) of the column in the SQL SELECT clause for which the value is to be retrieved.
   */
  public getValueString(columnIndex: number): string;
}

/**
 * Status codes used by NativeECPresentationManager APIs.
 * @hidden
 */
export const enum NativeECPresentationStatus {
  Success = 0,
  Error = 1,                            /** Base error */
  InvalidArgument = Error + 1,          /** Argument is invalid */
}

/**
 * The NativeECPresentationManager class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECPresentationManager implements IDisposable {
  constructor();
  /**
   * Sets up a ruleset locater that looks for rulesets in the specified directories
   * @param directories Ruleset locations
   */
  public setupRulesetDirectories(directories: string[]): ErrorStatusOrResult<NativeECPresentationStatus, void>;
  /**
   * Sets up a list of directories to lookup for localization files
   * @param directories Localization-related files' locations
   */
  public setupLocaleDirectories(directories: string[]): ErrorStatusOrResult<NativeECPresentationStatus, void>;
  /**
   * Set user setting value.
   * @param ruleSetId Id of the ruleset setting is associated with.
   * @param settingId Id of the setting.
   * @param jsonValue Value and type of setting in json format.
   */
  public setUserSetting(ruleSetId: string, settingId: string, jsonValue: string): ErrorStatusOrResult<NativeECPresentationStatus, void>;
  /**
   * Set user setting value.
   * @param ruleSetId Id of the ruleset setting is associated with.
   * @param settingId Id of the setting.
   * @param settingType Type of the setting..
   */
  public getUserSetting(ruleSetId: string, settingId: string, settingType: string): ErrorStatusOrResult<NativeECPresentationStatus, any>;
  /**
   * Get serialized JSON string of available rulesets array
   * @param rulesetId Id of the lookup rulesets
   * @return Serialized JSON array of tuples [ruleset, hash]
   */
  public getRulesets(rulesetId: string): ErrorStatusOrResult<NativeECPresentationStatus, string>;
  /**
   * Adds ruleset that can be used by NativeECPresentationManager
   * @param serializedRuleset Serialized JSON string of a ruleset to be added
   * @return Hash of the ruleset
   */
  public addRuleset(serializedRuleset: string): ErrorStatusOrResult<NativeECPresentationStatus, string>;
  /**
   * Removes a ruleset
   * @param rulesetId Id of a ruleset to be removed
   * @param hash Hash of the ruleset to be removed
   * @return True if removal was successful
   */
  public removeRuleset(rulesetId: string, hash: string): ErrorStatusOrResult<NativeECPresentationStatus, boolean>;
  /**
   * Removes all rulesets
   */
  public clearRulesets(): ErrorStatusOrResult<NativeECPresentationStatus, void>;
  /**
   * Handles an ECPresentation manager request
   * @param db The db to run the request on
   * @param options Serialized JSON object that contains parameters for the request
   * @param callback Callback which is called with ECPresentation result to request
   */
  public handleRequest(db: NativeDgnDb, options: string, callback: (result: ErrorStatusOrResult<NativeECPresentationStatus, string>) => void): void;
  /**
   * Terminates the presentation manager.
   */
  public dispose(): void;
}

/**
 * Some types used by the NativeECSchemaXmlContext class.
 * @hidden
 */
export declare namespace NativeECSchemaXmlContext {
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

/**
 * The NativeECSchemaXmlContext class that is projected by IModelJsNative.
 * @hidden
 */
export declare class NativeECSchemaXmlContext {
  constructor();
  public addSchemaPath(path: string): void;
  public setSchemaLocater(locater: NativeECSchemaXmlContext.SchemaLocaterCallback): void;
  public readSchemaFromXmlFile(filePath: string): ErrorStatusOrResult<BentleyStatus, string>;
}

export declare class SnapRequest {
  constructor();
  public doSnap(db: NativeDgnDb, request: any, callback: (result: ErrorStatusOrResult<IModelStatus, any>) => void): void;
  public cancelSnap(): void;
}

/**
 * Helper class for iModelJs tests to disable native assertions
 * @hidden
 */
export declare class DisableNativeAssertions implements IDisposable {
  constructor();
  public dispose(): void;
}
