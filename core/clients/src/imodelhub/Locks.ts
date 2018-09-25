/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import * as deepAssign from "deep-assign";

import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { ResponseError } from "./../Request";
import { AccessToken } from "../Token";
import { Logger, IModelHubStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AggregateResponseError, Query } from "./index";
import { IModelHubError, ArgumentCheck } from "./Errors";
import { IModelBaseHandler } from "./BaseHandler";
import { WsgRequestOptions } from "../WsgClient";

const loggingCategory = "imodeljs-clients.imodelhub";

/** [[Lock]] type describes the kind of object that is locked. */
export enum LockType {
  /** Lock for the entire file. This is a global Lock that can only be taken with objectId 1. */
  Db,
  /** Lock for a model. It should be acquired together with a [[LockLevel.Shared]] Db Lock. */
  Model,
  /** Lock for a single element. It should be acquired together with a [[LockLevel.Shared]] Model Lock. */
  Element,
  /** Lock used to change schemas. This is a global Lock that can only be taken with objectId 1. This lock cannot have [[LockLevel.Shared]]. */
  Schemas,
  /** Lock used to change CodeSpecs. This is a global Lock that can only be taken with objectId 1. This lock cannot have [[LockLevel.Shared]]. */
  CodeSpecs,
}

/** [[Lock]] level describes how restrictive the Lock is. */
export enum LockLevel {
  /** Lock is not owned. */
  None,
  /**
   * Lock can be owned by multiple [[Briefcase]]s. Shared Lock is usually acquired together with Locks for lower level objects that depend on this object.
   */
  Shared,
  /**
   * Lock can only be owned by a single briefcase. Exclusive Lock is required to modify model or element when using pessimistic concurrency.
   */
  Exclusive,
}

/**
 * Gets encoded instance id for a lock to be used in an URI.
 * @hidden
 * @param lock Lock to get instance id for.
 * @returns Encoded lock instance id.
 */
function getLockInstanceId(lock: Lock): string | undefined {
  if (!lock || lock.briefcaseId === undefined || lock.lockType === undefined || !lock.objectId)
    return undefined;

  return `${lock.lockType}-${lock.objectId}-${lock.briefcaseId}`;
}

/**
 * Object for specifying options when sending [[Lock]]s update requests. See [[LockHandler.update]].
 */
export interface LockUpdateOptions {
  /** Return [[Lock]]s that could not be acquired. Conflicting Locks will be set to [[ConflictingLocksError.conflictingLocks]]. If unlimitedReporting is enabled and locksPerRequest value is high, some conflicting Locks could be missed. */
  deniedLocks?: boolean;
  /** Attempt to get all failed [[Lock]]s, ignoring iModelHub limits. Server responses might fail when trying to return large number of conflicting Locks. */
  unlimitedReporting?: boolean;
  /** Number of [[Lock]]s per single request. Multiple requests will be sent if there are more Locks. If an error happens on a subsequent request, previous successful updates will not be reverted. */
  locksPerRequest?: number;
  /** Don't fail request on a conflict. If conflict occurs, [[Lock]]s that didn't have conflicts will be updated and any remaining subsequent requests will still be sent. */
  continueOnConflict?: boolean;
}

/**
 * Provider for default LockUpdateOptions, used by LockHandler to set defaults.
 * @hidden
 */
export class DefaultLockUpdateOptionsProvider {
  protected _defaultOptions: LockUpdateOptions;
  /**
   * Creates an instance of DefaultRequestOptionsProvider and sets up the default options.
   * @hidden
   */
  constructor() {
    this._defaultOptions = {
      locksPerRequest: 2000,
    };
  }

  /**
   * Augments options with the provider's default values.
   * @hidden
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

/**
 * Error for conflicting [[Lock]]s. It contains an array of Locks that failed to acquire. This is returned when calling [[LockHandler.update]] with [[LockUpdateOptions.deniedLocks]] set to true.
 */
export class ConflictingLocksError extends IModelHubError {
  /** Locks that couldn't be updated due to other users owning them. */
  public conflictingLocks?: Lock[];

  /**
   * Create ConflictingLocksError from IModelHubError instance.
   * @hidden
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
   * @hidden
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

/**
 * Base class for [[Lock]]s.
 */
export class LockBase extends WsgInstance {
  /** Type of the Lock. It describes what kind of object is locked. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.LockType")
  public lockType?: LockType;

  /** Level of the Lock. It describes how restrictive the Lock is. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.LockLevel")
  public lockLevel?: LockLevel;

  /** Id of the [[Briefcase]] that owns the Lock. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.BriefcaseId")
  public briefcaseId?: number;

  /** Id of the file, that the Lock belongs to. See [[Briefcase.fileId]]. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.SeedFileId")
  public seedFileId?: string;

  /** Id of the [[ChangeSet]] that the Lock was last used with. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReleasedWithChangeSet")
  public releasedWithChangeSet?: string;

  /** Index of the [[ChangeSet]] that the Lock was last used with. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReleasedWithChangeSetIndex")
  public releasedWithChangeSetIndex?: string;
}

/**
 * Lock instance. When using pessimistic concurrency, locks ensure that only a single user can modify an object at a time.
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.Lock", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Lock extends LockBase {
  /** Id of the locked object. */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ObjectId")
  public objectId?: string;
}

/**
 * MultiLock
 * Data about locks grouped by BriefcaseId, LockLevel and LockType.
 * @hidden
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.MultiLock", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class MultiLock extends LockBase {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ObjectIds")
  public objectIds?: string[];
}

/**
 * Query object for getting [[Lock]]s. You can use this to modify the [[LockHandler.get]] results.
 */
export class LockQuery extends Query {
  private _isMultiLockQuery = true;

  /**
   * Used by the hanlder to check whether locks in query can be grouped.
   * @hidden
   */
  public get isMultiLockQuery() {
    return this._isMultiLockQuery;
  }

  /**
   * Query [[Lock]]s by [[Briefcase]] id.
   * @param briefcaseId Id of the Briefcase.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if briefcaseId is undefined or it contains an invalid [[Briefcase]] id value.
   */
  public byBriefcaseId(briefcaseId: number) {
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);
    this.addFilter(`BriefcaseId+eq+${briefcaseId}`);
    return this;
  }

  /**
   * Query [[Lock]]s by [[LockType]].
   * @param lockType Lock type to query.
   * @returns This query.
   */
  public byLockType(lockType: LockType) {
    this.addFilter(`LockType+eq+${lockType}`);
    return this;
  }

  /**
   * Query [[Lock]]s by [[LockLevel]].
   * @param lockLevel Lock level to query.
   * @returns This query.
   */
  public byLockLevel(lockLevel: LockLevel) {
    this.addFilter(`LockLevel+eq+${lockLevel}`);
    return this;
  }

  /**
   * Query [[Lock]]s by ObjectId.
   * @param objectId Id of the object.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) if objectId is undefined.
   */
  public byObjectId(objectId: string) {
    ArgumentCheck.defined("objectId", objectId);
    this._isMultiLockQuery = false;
    this.addFilter(`ObjectId+eq+'${objectId}'`);
    return this;
  }

  /**
   * Query [[Lock]]s by [[ChangeSet]] id that it was released with.
   * @param changesetId Id of the ChangeSet.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if changeSetId is undefined or empty, or it contains an invalid [[ChangeSet]] id value.
   */
  public byReleasedWithChangeSet(changeSetId: string) {
    ArgumentCheck.validChangeSetId("changeSetId", changeSetId);
    this.addFilter(`ReleasedWithChangeSet+eq+'${changeSetId}'`);
    return this;
  }

  /**
   * Query [[Lock]]s by [[ChangeSet]] index that it was released with.
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
   * Query [[Lock]]s by their instance ids.
   * @param locks Locks to query. They must have their BriefcaseId, LockType and ObjectId set.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if locks array is undefined or empty, or it contains invalid [[Lock]] values.
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
   * Select only top entries from the query. This is applied after [[Query.skip]] parameter.
   * @param n Number of top entries to select.
   * @returns This query.
   */
  public top(n: number) {
    this._isMultiLockQuery = false;
    return super.top(n);
  }

  /**
   * Query unavailable [[Lock]]s. It will include all Locks owned by other [[Briefcase]]s and locks that were released with a newer [[ChangeSet]].
   * @param briefcaseId Id of the Briefcase.
   * @param lastChangeSetIndex Index of the last ChangeSet that user has pulled.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the values is undefined or briefcaseId is not in a valid [[Briefcase]] id value.
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
 * Handler for managing [[Lock]]s. Use [[IModelClient.Locks]] to get an instance of this class.
 *
 * In most cases, you should use [ConcurrencyControl]($backend) methods instead. You can read more about concurrency control [here]($docs/learning/backend/concurrencycontrol).
 */
export class LockHandler {
  private _handler: IModelBaseHandler;
  private static _defaultUpdateOptionsProvider: DefaultLockUpdateOptionsProvider;

  /**
   * Constructor for LockHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  private getRelativeUrl(imodelId: string, multilock = true, lockId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/${multilock ? "MultiLock" : "Lock"}/${lockId || ""}`;
  }

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
   * Augment update options with defaults returned by the DefaultLockUpdateOptionsProvider.
   * The options passed in by clients override any defaults where necessary.
   * @hidden
   * @param options Options the caller wants to eaugment with the defaults.
   */
  private async setupOptionDefaults(options: LockUpdateOptions): Promise<void> {
    if (!LockHandler._defaultUpdateOptionsProvider)
      LockHandler._defaultUpdateOptionsProvider = new DefaultLockUpdateOptionsProvider();
    return LockHandler._defaultUpdateOptionsProvider.assignOptions(options);
  }

  /** Send partial request for lock updates */
  private async updateInternal(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, locks: Lock[], updateOptions?: LockUpdateOptions): Promise<Lock[]> {
    alctx.enter();
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

    const result = await this._handler.postInstances<MultiLock>(alctx, MultiLock, token, `/Repositories/iModel--${imodelId}/$changeset`, LockHandler.convertLocksToMultiLocks(locks), requestOptions);
    alctx.enter();
    return LockHandler.convertMultiLocksToLocks(result);
  }

  /**
   * Update multiple [[Lock]]s. This call can simultaneously acquire new Locks and update states of already owned Locks. If large amount of Locks are updated, they are split across multiple requests. See [[LockUpdateOptions.locksPerRequest]]. Default is 2000 Locks per request.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param locks Locks to acquire. Requires briefcaseId, seedFileId to be set for every
   * Lock instance. They must be consistent throughout all of the Locks.
   * @param updateOptions Options for the update request. You can set this to change
   * how conflicts are handled or to handle different amount of Locks per request.
   * @returns Updated Lock values.
   * @throws [[ConflictingLocksError]] when [[LockUpdateOptions.deniedLocks]] is set and conflicts occured. See [Handling Conflicts]($docs/learning/iModelHub/CodesAndLocksConflicts.md) for more information.
   * @throws [[AggregateResponseError]] when multiple requests where sent and more than 1 of the following errors occured.
   * @throws [[IModelHubError]] with status indicating a conflict. See [Handling Conflicts]($docs/learning/iModelHub/CodesAndLocksConflicts.md) section for more information.
   * @throws [[IModelHubError]] with [IModelHubStatus.InvalidBriefcase]($bentley) when including locks with different briefcaseId values in the request.
   * @throws [[IModelHubError]] with [IModelHubStatus.OperationFailed]($bentley) when including multiple identical locks in the request.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async update(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, locks: Lock[], updateOptions?: LockUpdateOptions): Promise<Lock[]> {
    alctx.enter();
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
        result.push(...await this.updateInternal(alctx, token, imodelId, chunk, updateOptions));
        alctx.enter();
      } catch (error) {
        alctx.enter();
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
   * Get the [[Lock]]s that have been issued for the iModel.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param query Optional query object to filter the queried Locks or select different data from them.
   * @returns Resolves to an array of Locks matching the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, query: LockQuery = new LockQuery()): Promise<Lock[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying locks for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let locks: Lock[];
    if (query.isMultiLockQuery) {
      const result = await this._handler.getInstances<MultiLock>(alctx, MultiLock, token, this.getRelativeUrl(imodelId), query.getQueryOptions());
      alctx.enter();
      locks = LockHandler.convertMultiLocksToLocks(result);
    } else {
      locks = await this._handler.postQuery<Lock>(alctx, Lock, token, this.getRelativeUrl(imodelId, false), query.getQueryOptions());
      alctx.enter();
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

  /**
   * Delete all [[Lock]]s owned by the specified [[Briefcase]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param briefcaseId Id of the Briefcacase.
   * @throws [[IModelHubError]] with [IModelHubStatus.BriefcaseDoesNotExist]($bentley) if [[Briefcase]] with specified briefcaseId does not exist. This can happen if number was not given as a Briefcase id yet, or Briefcase with that id was already deleted.
   * @throws [[IModelHubError]] with [IModelHubStatus.UserDoesNotHavePermission]($bentley) if [[Briefcase]] belongs to another user and user sending the request does not have ManageResources permission.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async deleteAll(alctx: ActivityLoggingContext, token: AccessToken, imodelId: string, briefcaseId: number): Promise<void> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Deleting all locks from briefcase ${briefcaseId} in iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);
    ArgumentCheck.validBriefcaseId("briefcaseId", briefcaseId);

    await this._handler.delete(alctx, token, this.getRelativeUrl(imodelId, false, `DeleteAll-${briefcaseId}`));
    alctx.enter();
    Logger.logTrace(loggingCategory, `Deleted all locks from briefcase ${briefcaseId} in iModel ${imodelId}`);
  }
}
