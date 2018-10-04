/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { Id64, DbOpcode, RepositoryStatus, assert, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { AccessToken, HubCode, CodeState, CodeQuery, Lock, LockLevel, LockType } from "@bentley/imodeljs-clients";
import { NativeBriefcaseManagerResourcesRequest } from "./imodeljs-native-platform-api";
import { Code, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Element } from "./Element";
import { Model } from "./Model";
import { BriefcaseEntry, BriefcaseManager } from "./BriefcaseManager";
import { LinkTableRelationship } from "./LinkTableRelationship";
import { NativePlatformRegistry } from "./NativePlatformRegistry";
import { IModelDb } from "./IModelDb";

/**
 * ConcurrencyControl enables an app to coordinate local changes with changes that are being made by others to an iModel.
 */
export class ConcurrencyControl {
  private _pendingRequest: ConcurrencyControl.Request;
  private _codes?: ConcurrencyControl.Codes;
  private _policy?: ConcurrencyControl.PessimisticPolicy | ConcurrencyControl.OptimisticPolicy;
  constructor(private _iModel: IModelDb) { this._pendingRequest = ConcurrencyControl.createRequest(); }

  /** @hidden */
  public onSaveChanges() {
    if (this.hasPendingRequests)
      throw new IModelError(IModelStatus.TransactionActive);
  }

  /** @hidden */
  public onSavedChanges() { this.applyTransactionOptions(); }

  /** @hidden */
  public onMergeChanges() {
    if (this.hasPendingRequests)
      throw new IModelError(IModelStatus.TransactionActive);
  }

  /** @hidden */
  public onMergedChanges() { this.applyTransactionOptions(); }

  /** @hidden */
  private applyTransactionOptions() {
    if (!this._policy)
      return;
    if (!this.inBulkOperation())
      this.startBulkOperation();

    // TODO: release all public locks.
  }

  /** Create an empty Request */
  public static createRequest(): ConcurrencyControl.Request { return new (NativePlatformRegistry.getNativePlatform()).NativeBriefcaseManagerResourcesRequest(); }

  /** Convert the request to any */
  public static convertRequestToAny(req: ConcurrencyControl.Request): any { return JSON.parse((req as NativeBriefcaseManagerResourcesRequest).toJSON()); }

  /** @hidden [[Model.buildConcurrencyControlRequest]] */
  public buildRequestForModel(model: Model, opcode: DbOpcode): void {
    if (!this._iModel.briefcase)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this._iModel.briefcase.nativeDb.buildBriefcaseManagerResourcesRequestForModel(this._pendingRequest as NativeBriefcaseManagerResourcesRequest, JSON.stringify(model.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** @hidden [[Element.buildConcurrencyControlRequest]] */
  public buildRequestForElement(element: Element, opcode: DbOpcode): void {
    if (!this._iModel.briefcase)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus;
    if (element.id === undefined || opcode === DbOpcode.Insert)
      rc = this._iModel.briefcase.nativeDb.buildBriefcaseManagerResourcesRequestForElement(this._pendingRequest as NativeBriefcaseManagerResourcesRequest, JSON.stringify({ modelid: element.model, code: element.code }), opcode);
    else
      rc = this._iModel.briefcase.nativeDb.buildBriefcaseManagerResourcesRequestForElement(this._pendingRequest as NativeBriefcaseManagerResourcesRequest, JSON.stringify(element.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** @hidden [[LinkTableRelationship.buildConcurrencyControlRequest]] */
  public buildRequestForLinkTableRelationship(instance: LinkTableRelationship, opcode: DbOpcode): void {
    if (!this._iModel.briefcase)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this._iModel.briefcase.nativeDb.buildBriefcaseManagerResourcesRequestForLinkTableRelationship(this._pendingRequest as NativeBriefcaseManagerResourcesRequest, JSON.stringify(instance), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  private captureBulkOpRequest() {
    if (this._iModel.briefcase)
      this._iModel.briefcase.nativeDb.extractBulkResourcesRequest(this._pendingRequest as NativeBriefcaseManagerResourcesRequest, true, true);
  }

  /** @hidden */
  public get pendingRequest(): ConcurrencyControl.Request {
    this.captureBulkOpRequest();
    return this._pendingRequest;
  }

  /** Are there pending, unprocessed requests for locks or codes? */
  public get hasPendingRequests(): boolean {
    if (!this._iModel.briefcase)
      return false;
    const reqAny: any = ConcurrencyControl.convertRequestToAny(this.pendingRequest);
    return (reqAny.Codes.length !== 0) || (reqAny.Locks.length !== 0);
  }

  /**
   * @hidden
   * Take ownership of all or some of the pending request for locks and codes.
   * @param locksOnly If true, only the locks in the pending request are extracted. The default is to extract all requests.
   * @param codesOnly If true, only the codes in the pending request are extracted. The default is to extract all requests.
   */
  public extractPendingRequest(locksOnly?: boolean, codesOnly?: boolean): ConcurrencyControl.Request {
    if (!this._iModel.briefcase)
      throw new IModelError(IModelStatus.BadRequest);

    const extractLocks: boolean = !codesOnly;
    const extractCodes: boolean = !locksOnly;

    const req: ConcurrencyControl.Request = ConcurrencyControl.createRequest();
    this._iModel.briefcase.nativeDb.extractBriefcaseManagerResourcesRequest(req as NativeBriefcaseManagerResourcesRequest, this.pendingRequest as NativeBriefcaseManagerResourcesRequest, extractLocks, extractCodes);
    return req;
  }

  /**
   * Try to acquire locks and/or reserve codes from iModelHub.
   * This function may fulfill some requests and fail to fulfill others. This function returns a rejection of type RequestError if some or all requests could not be fulfilled.
   * The error object will identify the locks and/or codes that are unavailable.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:ConcurrencyControl.request]]
   * ```
   * @param accessToken The user's iModelHub access token
   * @param req The requests to be sent to iModelHub. If undefined, all pending requests are sent to iModelHub.
   * @throws [[ConcurrencyControl.RequestError]] if some or all of the request could not be fulfilled by iModelHub.
   * @throws [[IModelError]] if the IModelDb is not open or is not connected to an iModel.
   */
  public async request(actx: ActivityLoggingContext, accessToken: AccessToken, req?: ConcurrencyControl.Request): Promise<void> {
    actx.enter();
    if (!this._iModel.briefcase)
      return Promise.reject(this._iModel.newNotOpenError());

    assert(this.inBulkOperation(), "should always be in bulk mode");

    if (req === undefined)
      req = this.extractPendingRequest();

    const codeResults = await this.reserveCodesFromRequest(actx, req, this._iModel.briefcase, accessToken);
    await this.acquireLocksFromRequest(actx, req, this._iModel.briefcase, accessToken);
    actx.enter();

    assert(this.inBulkOperation(), "should always be in bulk mode");

    let err: ConcurrencyControl.RequestError | undefined;
    for (const code of codeResults) {
      if (code.state !== CodeState.Reserved) {
        if (err === undefined)
          err = new ConcurrencyControl.RequestError(IModelStatus.CodeNotReserved);
        err.unavailableCodes.push(code);
      }
    }

    if (err !== undefined)
      return Promise.reject(err);
  }

  private buildHubCodes(briefcaseEntry: BriefcaseEntry, codeSpecId: Id64, codeScope: string, value?: string): HubCode {
    const requestCode = new HubCode();
    requestCode.briefcaseId = briefcaseEntry.briefcaseId;
    requestCode.state = CodeState.Reserved;
    requestCode.codeSpecId = codeSpecId;
    requestCode.codeScope = codeScope;
    requestCode.value = value;
    return requestCode;
  }

  private buildHubCodesFromCode(briefcaseEntry: BriefcaseEntry, code: Code): HubCode {
    return this.buildHubCodes(briefcaseEntry, code.spec, code.scope, code.value);
  }

  private buildHubCodesFromRequest(briefcaseEntry: BriefcaseEntry, req: ConcurrencyControl.Request): HubCode[] | undefined {
    const reqAny = ConcurrencyControl.convertRequestToAny(req);
    if (!reqAny.hasOwnProperty("Codes") || reqAny.Codes.length === 0)
      return undefined;

    return reqAny.Codes.map((cReq: any) => this.buildHubCodes(briefcaseEntry, cReq.Id, cReq.Scope, cReq.Name));
  }

  private buildHubCodesFromCodes(briefcaseEntry: BriefcaseEntry, codes: Code[]): HubCode[] | undefined {
    return codes.map((code: Code) => this.buildHubCodesFromCode(briefcaseEntry, code));
  }

  /** Obtain the schema lock. This is always an immediate request, never deferred. */
  public lockSchema(actx: ActivityLoggingContext, accessToken: AccessToken): Promise<Lock[]> {
    actx.enter();
    const locks: Lock[] = [
      {
        wsgId: "what-is-this",
        ecId: "and-what-is-this",
        lockLevel: LockLevel.Exclusive,
        lockType: LockType.Schemas,
        objectId: new Id64("0x1"),
        briefcaseId: this._iModel.briefcase.briefcaseId,
        seedFileId: new Guid(this._iModel.briefcase.fileId),
        releasedWithChangeSet: this._iModel.briefcase.changeSetId,
      },
    ];
    assert(this.inBulkOperation(), "should always be in bulk mode");
    const res = BriefcaseManager.imodelClient.Locks().update(actx, accessToken, new Guid(this._iModel.iModelToken.iModelId!), locks);
    assert(this.inBulkOperation(), "should always be in bulk mode");
    return res;
  }

  private buildLockRequests(briefcaseInfo: BriefcaseEntry, req: ConcurrencyControl.Request): Lock[] | undefined {
    const reqAny: any = ConcurrencyControl.convertRequestToAny(req);

    if (!reqAny.hasOwnProperty("Locks") || reqAny.Locks.length === 0)
      return undefined;

    const locks: Lock[] = [];
    for (const reqLock of reqAny.Locks) {
      const lock = new Lock();
      lock.briefcaseId = briefcaseInfo.briefcaseId;
      lock.lockLevel = reqLock.Level;
      lock.lockType = reqLock.LockableId.Type;
      lock.objectId = reqLock.LockableId.Id;
      lock.releasedWithChangeSet = this._iModel.briefcase.changeSetId;
      lock.seedFileId = new Guid(this._iModel.briefcase.fileId!);
      locks.push(lock);
    }
    return locks;
  }

  /** process the Lock-specific part of the request. */
  private async acquireLocksFromRequest(actx: ActivityLoggingContext, req: ConcurrencyControl.Request, briefcaseEntry: BriefcaseEntry, accessToken: AccessToken): Promise<Lock[]> {
    actx.enter();
    const locks = this.buildLockRequests(briefcaseEntry, req);
    if (locks === undefined)
      return [];
    return BriefcaseManager.imodelClient.Locks().update(actx, accessToken, new Guid(this._iModel.iModelToken.iModelId!), locks);
  }

  /** process a Code-reservation request. The requests in bySpecId must already be in iModelHub REST format. */
  private async reserveCodes2(actx: ActivityLoggingContext, request: HubCode[], briefcaseEntry: BriefcaseEntry, accessToken: AccessToken): Promise<HubCode[]> {
    actx.enter();
    return BriefcaseManager.imodelClient.Codes().update(actx, accessToken, new Guid(briefcaseEntry.iModelId), request);
  }

  /** process the Code-specific part of the request. */
  private async reserveCodesFromRequest(actx: ActivityLoggingContext, req: ConcurrencyControl.Request, briefcaseEntry: BriefcaseEntry, accessToken: AccessToken): Promise<HubCode[]> {
    actx.enter();
    const request = this.buildHubCodesFromRequest(briefcaseEntry, req);
    if (request === undefined)
      return [];

    return this.reserveCodes2(actx, request, briefcaseEntry, accessToken);
  }

  /** Reserve the specified codes */
  public async reserveCodes(actx: ActivityLoggingContext, accessToken: AccessToken, codes: Code[]): Promise<HubCode[]> {
    actx.enter();
    if (this._iModel.briefcase === undefined)
      return Promise.reject(this._iModel.newNotOpenError());

    const bySpecId = this.buildHubCodesFromCodes(this._iModel.briefcase, codes);
    if (bySpecId === undefined)
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    return this.reserveCodes2(actx, bySpecId, this._iModel.briefcase, accessToken);
  }

  // Query the state of the Codes for the specified CodeSpec and scope.
  public async queryCodeStates(actx: ActivityLoggingContext, accessToken: AccessToken, specId: Id64, scopeId: string, _value?: string): Promise<HubCode[]> {
    actx.enter();
    if (this._iModel.briefcase === undefined)
      return Promise.reject(this._iModel.newNotOpenError());

    const query = new CodeQuery().byCodeSpecId(specId).byCodeScope(scopeId);

    /* NEEDS WORK
    if (value !== undefined) {
      queryOptions.$filter += `+and+Value+eq+'${value}'`;
    }
    */

    return BriefcaseManager.imodelClient.Codes().get(actx, accessToken, new Guid(this._iModel.briefcase.iModelId), query);
  }

  /** Abandon any pending requests for locks or codes. */
  public abandonRequest() { this.extractPendingRequest(); }

  /**
   * Check to see if *all* of the codes in the specified request are available.
   * @param req the list of code requests to be fulfilled. If not specified then all pending requests for codes are queried.
   * @returns true if all codes are available or false if any is not.
   */
  public async areCodesAvailable(actx: ActivityLoggingContext, accessToken: AccessToken, req?: ConcurrencyControl.Request): Promise<boolean> {
    actx.enter();
    if (!this._iModel.briefcase)
      return Promise.reject(this._iModel.newNotOpenError());
    // throw new Error("TBD");
    if (req === undefined)
      req = this.pendingRequest;

    const hubCodes = this.buildHubCodesFromRequest(this._iModel.briefcase, req);

    if (!hubCodes)
      return true;

    const codesHandler = BriefcaseManager.imodelClient.Codes();
    const chunkSize = 100;
    for (let i = 0; i < hubCodes.length; i += chunkSize) {
      const query = new CodeQuery().byCodes(hubCodes.slice(i, i + chunkSize));
      const result = await codesHandler.get(actx, accessToken, new Guid(this._iModel.briefcase.iModelId), query);
      for (const code of result) {
        if (code.state !== CodeState.Available)
          return false;
      }
    }
    return true;
  }

  /**
   * Check to see if *all* of the requested resources could be acquired from iModelHub.
   * @param req the list of resource requests to be fulfilled. If not specified then all pending requests for locks and codes are queried.
   * @returns true if all resources could be acquired or false if any could not be acquired.
   */
  public async areAvailable(actx: ActivityLoggingContext, accessToken: AccessToken, req?: ConcurrencyControl.Request): Promise<boolean> {
    actx.enter();
    if (!this._iModel.briefcase)
      return Promise.reject(this._iModel.newNotOpenError());

    if (req === undefined)
      req = this.pendingRequest;

    const allCodesAreAvailable = await this.areCodesAvailable(actx, accessToken, req);
    actx.enter();
    if (!allCodesAreAvailable)
      return false;

    // TODO: Locks

    return true;
  }

  /** Set the concurrency control policy.
   * Before changing from optimistic to pessimistic, all local changes must be saved and uploaded to iModelHub.
   * Before changing the locking policy of the pessimistic concurrency policy, all local changes must be saved to the IModelDb.
   * Here is an example of setting an optimistic policy:
   * <p><em>Example:</em>
   * ``` ts
   * [[include:ConcurrencyControl.setPolicy]]
   * ```
   * @param policy The policy to used
   * @throws [[IModelError]] if the policy cannot be set.
   */
  public setPolicy(policy: ConcurrencyControl.PessimisticPolicy | ConcurrencyControl.OptimisticPolicy): void {
    this._policy = policy;
    if (!this._iModel.briefcase)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus = RepositoryStatus.Success;
    if (policy instanceof ConcurrencyControl.OptimisticPolicy) {
      const oc: ConcurrencyControl.OptimisticPolicy = policy as ConcurrencyControl.OptimisticPolicy;
      rc = this._iModel.briefcase.nativeDb.setBriefcaseManagerOptimisticConcurrencyControlPolicy(oc.conflictResolution);
    } else {
      rc = this._iModel.briefcase.nativeDb.setBriefcaseManagerPessimisticConcurrencyControlPolicy();
    }
    if (RepositoryStatus.Success !== rc) {
      throw new IModelError(rc);
    }
    this.applyTransactionOptions();
  }

  /**
   * By entering bulk operation mode, an app can insert, update, and delete entities in the IModelDb without first acquiring locks.
   * When the app calls saveChanges, the transaction manager attempts to acquire all needed locks and codes.
   * The transaction manager will roll back all pending changes if any lock or code cannot be acquired at save time. Lock and code acquisition will fail if another user
   * has pushed changes to the same entities or used the same codes as the local transaction.
   * This mode can therefore be used safely only in special cases where contention for locks and codes is not a risk.
   * Normally, that is only possible when writing to a model that is exclusively locked and where codes are scoped to that model.
   * See [[request]] and [[IModelDb.saveChanges]].
   * @throws [[IModelError]] if it would be illegal to enter bulk operation mode.
   */
  private startBulkOperation(): void {
    if (!this._iModel.briefcase)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this._iModel.briefcase.nativeDb.briefcaseManagerStartBulkOperation();
    if (RepositoryStatus.Success !== rc)
      throw new IModelError(rc);
  }

  /** Check if there is a bulk operation in progress */
  private inBulkOperation(): boolean {
    if (!this._iModel.briefcase)
      return false;
    return this._iModel.briefcase.nativeDb.inBulkOperation();
  }

  /*
   * Ends the bulk operation and appends the locks and codes that it recorded to the pending request.
  private endBulkOperation() {
    if (!this._imodel.briefcaseEntry)
      return;
    this.captureBulkOpRequest();
    // Now exit bulk operation mode in the addon. It will then stop collecting (and start enforcing) lock and code requirements.
    const rc: RepositoryStatus = this._imodel.briefcaseEntry.nativeDb.briefcaseManagerEndBulkOperation();
    if (RepositoryStatus.Success !== rc)
      throw new IModelError(rc);
    this.applyTransactionOptions(); // (may re-start the bulk operation)
  }
   */

  /** API to reserve Codes and query the status of Codes */
  get codes(): ConcurrencyControl.Codes {
    if (this._codes === undefined)
      this._codes = new ConcurrencyControl.Codes(this._iModel);
    return this._codes;
  }
}

export namespace ConcurrencyControl {
  /** A request for locks and/or code reservations. */
  export class Request {
    private constructor() { }
  }

  /* Keep this consistent with DgnPlatform/RepositoryManager.h. */
  /** How to handle a conflict. */
  export const enum OnConflict {
    /** Reject the incoming change */
    RejectIncomingChange = 0,
    /** Accept the incoming change */
    AcceptIncomingChange = 1,
  }

  /**
   * The options for how conflicts are to be handled during change-merging in an OptimisticConcurrencyControlPolicy.
   * The scenario is that the caller has made some changes to the *local* IModelDb. Now, the caller is attempting to
   * merge in changes from iModelHub. The properties of this policy specify how to handle the *incoming* changes from iModelHub.
   */
  export class ConflictResolutionPolicy {
    /** What to do with the incoming change in the case where the same element was updated locally and also would be updated by the incoming change. */
    public updateVsUpdate: OnConflict;
    /** What to do with the incoming change in the case where an element was updated locally and would be deleted by the incoming change. */
    public updateVsDelete: OnConflict;
    /** What to do with the incoming change in the case where an element was deleted locally and would be updated by the incoming change. */
    public deleteVsUpdate: OnConflict;

    /**
     * Construct a ConflictResolutionPolicy.
     * @param updateVsUpdate What to do with the incoming change in the case where the same element was updated locally and also would be updated by the incoming change
     * @param updateVsDelete What to do with the incoming change in the case where an element was updated locally and would be deleted by the incoming change
     * @param deleteVsUpdate What to do with the incoming change in the case where an element was deleted locally and would be updated by the incoming change
     */
    constructor(updateVsUpdate?: OnConflict, updateVsDelete?: OnConflict, deleteVsUpdate?: OnConflict) {
      this.updateVsUpdate = updateVsUpdate ? updateVsUpdate! : ConcurrencyControl.OnConflict.RejectIncomingChange;
      this.updateVsDelete = updateVsDelete ? updateVsDelete! : ConcurrencyControl.OnConflict.AcceptIncomingChange;
      this.deleteVsUpdate = deleteVsUpdate ? deleteVsUpdate! : ConcurrencyControl.OnConflict.RejectIncomingChange;
    }
  }

  /** Specifies an optimistic concurrency policy. */
  export class OptimisticPolicy {
    public conflictResolution: ConflictResolutionPolicy;
    constructor(policy?: ConflictResolutionPolicy) { this.conflictResolution = policy ? policy! : new ConflictResolutionPolicy(); }
  }

  /** Specifies a pessimistic concurrency policy. */
  export class PessimisticPolicy {
  }

  /** Thrown when iModelHub denies or cannot process a request. */
  export class RequestError extends IModelError {
    public unavailableCodes: HubCode[] = [];
    public unavailableLocks: HubCode[] = [];
  }

  /** Code manager */
  export class Codes {
    constructor(private _iModel: IModelDb) { }

    /**
     * Reserve Codes.
     * If no Codes are specified, then all of the Codes that are in currently pending requests are reserved.
     * This function may only be able to reserve some of the requested Codes. In that case, this function will return a rejection of type RequestError.
     * The error object will identify the codes that are unavailable.
     * <p><em>Example:</em>
     * ``` ts
     * [[include:ConcurrencyControl_Codes.reserve]]
     * ```
     * @param codes The Codes to reserve
     * @throws [[ConcurrencyControl.RequestError]]
     */
    public async reserve(actx: ActivityLoggingContext, accessToken: AccessToken, codes?: Code[]): Promise<void> {
      actx.enter();

      if (!this._iModel.briefcase)
        return Promise.reject(this._iModel.newNotOpenError());

      if (codes !== undefined) {
        await this._iModel.concurrencyControl.reserveCodes(actx, accessToken, codes);

        // TODO: examine result and throw CodeReservationError if some codes could not be reserved
        return;
      }
      actx.enter();

      const req: ConcurrencyControl.Request = this._iModel.concurrencyControl.extractPendingRequest(false, true);
      this._iModel.briefcase.nativeDb.extractBulkResourcesRequest(req as NativeBriefcaseManagerResourcesRequest, false, true);
      this._iModel.briefcase.nativeDb.extractBriefcaseManagerResourcesRequest(req as NativeBriefcaseManagerResourcesRequest, req as NativeBriefcaseManagerResourcesRequest, false, true);
      return this._iModel.concurrencyControl.request(actx, accessToken, req);
    }

    /**
     * Queries the state of the specified Codes in the code service.
     * @param accessToken The user's iModelHub access token
     * @param specId The CodeSpec to query
     * @param scopeId The scope to query
     * @param value Optional. The Code value to query.
     */
    public async query(actx: ActivityLoggingContext, accessToken: AccessToken, specId: Id64, scopeId: string, value?: string): Promise<HubCode[]> {
      return this._iModel.concurrencyControl.queryCodeStates(actx, accessToken, specId, scopeId, value);
    }
  }
}
