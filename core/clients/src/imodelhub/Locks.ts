/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import * as deepAssign from "deep-assign";

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { ResponseError } from "./../Request";
import { AccessToken } from "../Token";
import { Logger, IModelHubStatus } from "@bentley/bentleyjs-core";
import { AggregateResponseError, Query } from "./index";
import { IModelHubError, ArgumentCheck } from "./Errors";
import { IModelBaseHandler } from "./BaseHandler";
import { WsgRequestOptions } from "../WsgClient";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Lock Type enumeration */
export enum LockType {
  Db,
  Model,
  Element,
  Schemas,
}

/** Lock Level enumeration */
export enum LockLevel {
  None,
  Shared,
  Exclusive,
}

/**
 * Gets encoded instance id for a lock to be used in an URI.
 * @param lock Lock to get instance id for.
 * @returns Encoded lock instance id.
 */
function getLockInstanceId(lock: Lock): string | undefined {
  if (!lock || lock.briefcaseId === undefined || lock.lockType === undefined || !lock.objectId)
    return undefined;

  return `${lock.lockType}-${lock.objectId}-${lock.briefcaseId}`;
}

/**
 * Object for specifying options when sending locks update requests.
 */
export interface LockUpdateOptions {
  /** Return locks that couldn't be acquired. */
  deniedLocks?: boolean;
  /** Attempt to send all failed locks, ignoring iModel Hub limits. */
  unlimitedReporting?: boolean;
  /** Number of locks per single request. Multiple requests will be sent if there are more locks. */
  locksPerRequest?: number;
  /** If conflict happens, continue updating remaining locks instead of reverting everything. */
  continueOnConflict?: boolean;
}

/**
 * Provider for default LockUpdateOptions, used by LockHandler to set defaults.
 */
export class DefaultLockUpdateOptionsProvider {
  protected _defaultOptions: LockUpdateOptions;
  /**
   * Creates an instance of DefaultRequestOptionsProvider and sets up the default options.
   */
  constructor() {
    this._defaultOptions = {
      locksPerRequest: 2000,
    };
  }

  /**
   * Augments options with the provider's default values.
   * @note The options passed in override any defaults where necessary.
   * @param options Options that should be augmented.
   */
  public async assignOptions(options: LockUpdateOptions): Promise<void> {
    const clonedOptions: LockUpdateOptions = Object.assign({}, options);
    deepAssign(options, this._defaultOptions);
    deepAssign(options, clonedOptions); // ensure the supplied options override the defaults
    return Promise.resolve();
  }
}

/** Error for conflicting locks */
export class ConflictingLocksError extends IModelHubError {
  public conflictingLocks?: Lock[];

  /**
   * Create ConflictingLocksError from IModelHubError instance.
   * @param error IModelHubError to get error data from.
   * @returns Undefined if the error is not for a lock conflict, otherwise newly created error instance.
   */
  public static fromError(error: IModelHubError): ConflictingLocksError | undefined {
    if (error.errorNumber !== IModelHubStatus.LockOwnedByAnotherBriefcase
      && error.errorNumber !== IModelHubStatus.ConflictsAggregate) {
      return undefined;
    }
    const result = new ConflictingLocksError(error.errorNumber);
    deepAssign(result, error);
    result.addLocks(error);
    return result;
  }

  /**
   * Amends this error instance with conflicting locks from another IModelHubError.
   * @param error Error to get additional conflicting locks from.
   */
  public addLocks(error: IModelHubError) {
    if (!error.data || !error.data.ConflictingLocks) {
      return;
    }
    if (!this.conflictingLocks) {
      this.conflictingLocks = [];
    }
    for (const value of (error.data.ConflictingLocks as any[])) {
      const instance = { className: "Lock", schemaName: "iModelScope", properties: value };
      const lock = ECJsonTypeMap.fromJson<Lock>(Lock, "wsg", instance);
      if (lock) {
        this.conflictingLocks.push(lock);
      }
    }
  }
}

/** Base class for Lock and MultiLock */
export class LockBase extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.LockType")
  public lockType?: LockType;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LockLevel")
  public lockLevel?: LockLevel;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.SeedFileId")
  public seedFileId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReleasedWithChangeSet")
  public releasedWithChangeSet?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReleasedWithChangeSetIndex")
  public releasedWithChangeSetIndex?: string;
}

/** Lock */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Lock", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Lock extends LockBase {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ObjectId")
  public objectId?: string;
}

/**
 * MultiLock
 * Data about locks grouped by BriefcaseId, LockLevel and LockType.
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.MultiLock", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class MultiLock extends LockBase {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ObjectIds")
  public objectIds?: string[];
}

/**
 * Query object for getting Locks. You can use this to modify the query.
 * @see LockHandler.get()
 */
export class LockQuery extends Query {
  private _isMultiLockQuery = true;

  /**
   * Used by the hanlder to check whether locks in query can be grouped.
   */
  public get isMultiLockQuery() {
    return this._isMultiLockQuery;
  }

  /**
   * Query Locks by Briefcase id.
   * @param briefcaseId Id of the Briefcase.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * or [IModelHubStatus.InvalidArgumentError]($bentley) if briefcaseId is undefined or it
   * contains not valid [[Briefcase]] id value.
   */
  public byBriefcaseId(briefcaseId: number) {
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);
    this.addFilter(`BriefcaseId+eq+${briefcaseId}`);
    return this;
  }

  /**
   * Query Locks by LockType.
   * @param lockType lockType.
   * @returns This query.
   */
  public byLockType(lockType: LockType) {
    this.addFilter(`LockType+eq+${lockType}`);
    return this;
  }

  /**
   * Query Locks by LockLevel.
   * @param lockLevel lockLevel.
   * @returns This query.
   */
  public byLockLevel(lockLevel: LockLevel) {
    this.addFilter(`LockLevel+eq+${lockLevel}`);
    return this;
  }

  /**
   * Query Locks by ObjectId.
   * @param objectId Id of the object.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * if objectId is undefined.
   */
  public byObjectId(objectId: string) {
    ArgumentCheck.defined("objectId", objectId);
    this._isMultiLockQuery = false;
    this.addFilter(`ObjectId+eq+'${objectId}'`);
    return this;
  }

  /**
   * Query Locks by ReleasedWithChangeSet.
   * @param changesetId Id of the changeSet.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * or [IModelHubStatus.InvalidArgumentError]($bentley) if changeSetId is undefined or
   * empty, or it contains not valid [[ChangeSet]] id value.
   */
  public byReleasedWithChangeSet(changeSetId: string) {
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId);
    this.addFilter(`ReleasedWithChangeSet+eq+'${changeSetId}'`);
    return this;
  }

  /**
   * Query Locks by ReleasedWithChangeSetIndex.
   * @param changeSetIndex Index of the changeSet.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * if changeSetIndex is undefined.
   */
  public byReleasedWithChangeSetIndex(changeSetIndex: number) {
    ArgumentCheck.definedNumber("changeSetIndex", changeSetIndex);
    this.addFilter(`ReleasedWithChangeSetIndex+eq+${changeSetIndex}`);
    return this;
  }

  /**
   * Query Locks by their instance ids.
   * @param locks Locks to query. They must have their BriefcaseId, LockType and ObjectId set.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley)
   * or [IModelHubStatus.InvalidArgumentError]($bentley) if locks array is undefined or
   * empty, or it contains not valid [[Lock]] values.
   */
  public byLocks(locks: Lock[]) {
    ArgumentCheck.nonEmptyArray("locks", locks);

    let filter = "$id+in+[";

    let index = 0;
    for (const lock of locks) {
      const id = getLockInstanceId(lock);
      ArgumentCheck.valid(`locks[${index}]`, id);

      if (0 !== index++)
        filter += ",";
      filter += `'${id}'`;
    }

    filter += "]";
    this.addFilter(filter);
    this._isMultiLockQuery = false;
    return this;
  }

  /**
   * Select only top entries from the query.
   * This is applied after @see Query.skip parameter.
   * @param n Number of top entries to select.
   * @returns This query.
   */
  public top(n: number) {
    this._isMultiLockQuery = false;
    return super.top(n);
  }

  /**
   * Query unavailable Locks.
   * @param briefcaseId Id of the briefcase.
   * @param lastChangeSetIndex Index of the last changeSet.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the values is undefined or briefcaseId is not in valid [[Briefcase.id]] range.
   */
  public unavailableLocks(briefcaseId: number, lastChangeSetIndex: string) {
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);
    ArgumentCheck.defined("lastChangeSetIndex", lastChangeSetIndex);
    let filter = `BriefcaseId+ne+${briefcaseId}`;
    filter += `+and+(LockLevel+gt+0+or+ReleasedWithChangeSetIndex+gt+${lastChangeSetIndex})`;
    this.addFilter(filter);
    return this;
  }
}

/**
 * Handler for all methods related to @see Lock instances.
 */
export class LockHandler {
  private _handler: IModelBaseHandler;
  private static _defaultUpdateOptionsProvider: DefaultLockUpdateOptionsProvider;

  /**
   * Constructor for LockHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   * @hidden
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for Lock requests.
   * @param imodelId Id of the iModel.
   * @param lockId Id of the lock.
   */
  private getRelativeUrl(imodelId: string, multilock = true, lockId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/${multilock ? "MultiLock" : "Lock"}/${lockId || ""}`;
  }

  /** Convert Locks to MultiLocks. */
  private static convertLocksToMultiLocks(locks: Lock[]): MultiLock[] {
    const map = new Map<string, MultiLock>();
    for (const lock of locks) {
      const id: string = `${lock.lockType}-${lock.lockLevel}`;

      if (map.has(id)) {
        map.get(id)!.objectIds!.push(lock.objectId!);
      } else {
        const multiLock = new MultiLock();
        multiLock.changeState = "new";
        multiLock.briefcaseId = lock.briefcaseId;
        multiLock.seedFileId = lock.seedFileId;
        multiLock.releasedWithChangeSet = lock.releasedWithChangeSet;
        multiLock.releasedWithChangeSetIndex = lock.releasedWithChangeSetIndex;
        multiLock.lockLevel = lock.lockLevel;
        multiLock.lockType = lock.lockType;
        multiLock.objectIds = [lock.objectId!];
        map.set(id, multiLock);
      }
    }
    return Array.from(map.values());
  }

  /** Convert MultiLocks to Locks. */
  private static convertMultiLocksToLocks(multiLocks: MultiLock[]): Lock[] {
    const result: Lock[] = [];

    for (const multiLock of multiLocks) {
      for (const value of multiLock.objectIds!) {
        const lock = new Lock();
        lock.objectId = value;
        lock.briefcaseId = multiLock.briefcaseId;
        if (lock.seedFileId)
          lock.seedFileId = multiLock.seedFileId;
        lock.lockLevel = multiLock.lockLevel;
        lock.lockType = multiLock.lockType;
        result.push(lock);
      }
    }

    return result;
  }

  /**
   * Augments update options with defaults returned by the DefaultLockUpdateOptionsProvider.
   * @note The options passed in by clients override any defaults where necessary.
   * @param options Options the caller wants to eaugment with the defaults.
   * @returns Promise resolves after the defaults are setup.
   */
  private async setupOptionDefaults(options: LockUpdateOptions): Promise<void> {
    if (!LockHandler._defaultUpdateOptionsProvider)
      LockHandler._defaultUpdateOptionsProvider = new DefaultLockUpdateOptionsProvider();
    return LockHandler._defaultUpdateOptionsProvider.assignOptions(options);
  }

  /** Send partial request for lock updates */
  private async updateInternal(token: AccessToken, imodelId: string, locks: Lock[], updateOptions?: LockUpdateOptions): Promise<Lock[]> {
    let requestOptions: WsgRequestOptions | undefined;
    if (updateOptions) {
      requestOptions = {};
      requestOptions.CustomOptions = {};
      if (updateOptions.deniedLocks === false) {
        requestOptions.CustomOptions.DetailedError_Codes = "false";
      }
      if (updateOptions.unlimitedReporting) {
        requestOptions.CustomOptions.DetailedError_MaximumInstances = "-1";
      }
      if (updateOptions.continueOnConflict) {
        requestOptions.CustomOptions.ConflictStrategy = "Continue";
      }
      if (Object.getOwnPropertyNames(requestOptions.CustomOptions).length === 0) {
        requestOptions = undefined;
      }
    }

    const result = await this._handler.postInstances<MultiLock>(MultiLock, token, `/Repositories/iModel--${imodelId}/$changeset`, LockHandler.convertLocksToMultiLocks(locks), requestOptions);
    return LockHandler.convertMultiLocksToLocks(result);
  }

  // iModelHubOperationFailedException duplicates
  // InvalidBriefcaseException multiple briefcases

  /**
   * Updates multiple locks.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param locks Locks to acquire. Requires briefcaseId, seedFileId to be set in the lock. Set queryOnly to true
   * to just check if a lock is available.
   * @param updateOptions Options for the update request.
   * @returns The lock that was just obtained from the server.
   * @throws [[ConflictingLocksError]] when [[LockUpdateOptions.deniedLocks]] is set and conflicts occured. See [Handling Conflicts]($docs/learning/iModelHub/Locks/#handling-conflicts) section for more information.
   * @throws [[AggregateResponseError]] when multiple requests where sent and more than 1 of the following errors occured.
   * @throws [[IModelHubError]] with status indicating a conflict. See [Handling Conflicts]($docs/learning/iModelHub/Locks/#handling-conflicts) section for more information.
   * @throws [[IModelHubError]] with [IModelHubStatus.InvalidBriefcase]($bentley) when including locks with different briefcaseId values in the request.
   * @throws [[IModelHubError]] with [IModelHubStatus.IModelHubOperationFailed]($bentley) when including multiple identical locks in the request.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(token: AccessToken, imodelId: string, locks: Lock[], updateOptions?: LockUpdateOptions): Promise<Lock[]> {
    Logger.logInfo(loggingCategory, `Requesting locks for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.nonEmptyArray("locks", locks);

    updateOptions = updateOptions || {};
    this.setupOptionDefaults(updateOptions);

    const result: Lock[] = [];
    let conflictError: ConflictingLocksError | undefined;
    const aggregateError = new AggregateResponseError();

    for (let i = 0; i < locks.length; i += updateOptions.locksPerRequest!) {
      const chunk = locks.slice(i, i + updateOptions.locksPerRequest!);
      try {
        result.push(...await this.updateInternal(token, imodelId, chunk, updateOptions));
      } catch (error) {
        if (error instanceof ResponseError) {
          if (updateOptions && updateOptions.deniedLocks && error instanceof IModelHubError
            && (error.errorNumber === IModelHubStatus.LockOwnedByAnotherBriefcase || error.errorNumber === IModelHubStatus.ConflictsAggregate)) {
            if (conflictError) {
              conflictError.addLocks(error);
            } else {
              conflictError = ConflictingLocksError.fromError(error);
            }
            if (!updateOptions.continueOnConflict) {
              return Promise.reject(conflictError);
            }
          } else {
            aggregateError.errors.push(error);
          }
        }
      }
    }

    if (conflictError) {
      return Promise.reject(conflictError);
    }

    if (aggregateError.errors.length > 0) {
      return Promise.reject(aggregateError.errors.length > 1 ? aggregateError : aggregateError.errors[0]);
    }

    Logger.logTrace(loggingCategory, `Requested ${locks.length} locks for iModel ${imodelId}`);

    return result;
  }

  /**
   * Gets the locks that have been acquired for the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param query Object used to modify results of this query.
   * @returns Resolves to an array of locks.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(token: AccessToken, imodelId: string, query: LockQuery = new LockQuery()): Promise<Lock[]> {
    Logger.logInfo(loggingCategory, `Querying locks for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let locks: Lock[];
    if (query.isMultiLockQuery) {
      const result = await this._handler.getInstances<MultiLock>(MultiLock, token, this.getRelativeUrl(imodelId), query.getQueryOptions());
      locks = LockHandler.convertMultiLocksToLocks(result);
    } else {
      locks = await this._handler.postQuery<Lock>(Lock, token, this.getRelativeUrl(imodelId, false), query.getQueryOptions());
      locks = locks.map((value: Lock) => {
        const result = new Lock();
        result.briefcaseId = value.briefcaseId;
        result.lockLevel = value.lockLevel;
        result.lockType = value.lockType;
        result.objectId = value.objectId;
        if (value.seedFileId)
          result.seedFileId = value.seedFileId;
        return result;
      });
    }

    Logger.logTrace(loggingCategory, `Queried ${locks.length} locks for iModel ${imodelId}`);

    return locks;
  }

  // BriefcaseDoesNotExistException
  // UserDoesNotHavePermissionException ManageResources
  /**
   * Deletes all locks owned by the specified briefcase
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param briefcaseId Id of the briefcacase
   * @throws [[IModelHubError]] with [IModelHubStatus.BriefcaseDoesNotExistException]($bentley) if [[Briefcase]] with specified briefcaseId does not exist. This can happen if number was not given as a briefcase id yet, or briefcase with that id was already deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermissionException]($bentley) if [[Briefcase]] belongs to another user and user sending the request doesn't have ManageResources permission.
   * @throws [Common iModel Hub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async deleteAll(token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    Logger.logInfo(loggingCategory, `Deleting all locks from briefcase ${briefcaseId} in iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(token, this.getRelativeUrl(imodelId, false, `DeleteAll-${briefcaseId}`));

    Logger.logTrace(loggingCategory, `Deleted all locks from briefcase ${briefcaseId} in iModel ${imodelId}`);
  }
}
