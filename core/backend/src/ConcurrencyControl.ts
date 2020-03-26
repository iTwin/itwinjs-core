/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { assert, DbOpcode, DbResult, Id64String, Logger, RepositoryStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, CodeQuery, CodeState, HubCode, Lock, LockLevel, LockQuery, LockType } from "@bentley/imodeljs-clients";
import { CodeProps, ElementProps, IModelError, IModelStatus, IModelWriteRpcInterface, ModelProps } from "@bentley/imodeljs-common";
import * as deepAssign from "deep-assign";
import * as path from "path";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseManager } from "./BriefcaseManager";
import { ECDb, ECDbOpenMode } from "./ECDb";
import { Element } from "./Element";
import { BriefcaseDb, SyncMode } from "./IModelDb";
import { IModelJsFs } from "./IModelJsFs";
import { Model } from "./Model";
import { RelationshipProps } from "./Relationship";

const loggerCategory: string = BackendLoggerCategory.ConcurrencyControl;

/** ConcurrencyControl enables an app to coordinate local changes with changes that are being made by others to an iModel.
 * @beta
 */
export class ConcurrencyControl {
  private _pendingRequest = new ConcurrencyControl.Request();
  private _codes?: ConcurrencyControl.Codes;
  private _policy: ConcurrencyControl.PessimisticPolicy | ConcurrencyControl.OptimisticPolicy;
  private _bulkMode: boolean = false;
  private _cache: ConcurrencyControl.StateCache;
  private _modelsAffectedByWrites = new Set<Id64String>(); // TODO: Remove this when we get tile healing

  constructor(private _iModel: BriefcaseDb) {
    this._cache = new ConcurrencyControl.StateCache(this);
    this._policy = ConcurrencyControl.PessimisticPolicy;
  }

  /** @internal */
  public get iModel(): BriefcaseDb { return this._iModel; }

  /** @internal */
  public get modelsAffectedByWrites(): Id64String[] { return Array.from(this._modelsAffectedByWrites); }

  /** @internal */
  public getPolicy(): ConcurrencyControl.PessimisticPolicy | ConcurrencyControl.OptimisticPolicy { return this._policy; }

  /** @internal */
  public get needLocks(): boolean {
    return this._policy === ConcurrencyControl.PessimisticPolicy;
  }

  /** @internal */
  public startBulkMode() {
    if (this._bulkMode)
      throw new IModelError(IModelStatus.BadRequest, "Already in bulk mode", Logger.logError, loggerCategory);
    if (this._iModel.txns.hasUnsavedChanges)
      throw new IModelError(IModelStatus.BadRequest, "has unsaved changes", Logger.logError, loggerCategory);
    this._bulkMode = true;
  }

  /** @internal */
  public get isBulkMode() {
    return this._bulkMode;
  }

  /** @internal */
  public async endBulkMode(rqctx: AuthorizedClientRequestContext) {
    if (!this._bulkMode)
      throw new IModelError(IModelStatus.BadRequest, "Not in bulk mode", Logger.logError, loggerCategory);
    if (this.hasPendingRequests)
      await this.request(rqctx);
    this._bulkMode = false;
  }

  /** @internal */
  public onSaveChanges() {
    if (this.hasPendingRequests)
      throw new IModelError(IModelStatus.TransactionActive, "Call iModelDb.concurrencyControl.request before saving changes", Logger.logError, loggerCategory);
  }

  /** @internal */
  public onSavedChanges() {
    this.applyTransactionOptions();

    if (this._modelsAffectedByWrites.size !== 0) { // TODO: Remove this when we get tile healing
      this._iModel.nativeDb.purgeTileTrees(Array.from(this._modelsAffectedByWrites)); // TODO: Remove this when we get tile healing
      this._modelsAffectedByWrites.clear(); // TODO: Remove this when we get tile healing
    }
  }

  /** @internal */
  public onMergeChanges() {
    if (this.hasPendingRequests)
      throw new IModelError(IModelStatus.TransactionActive, "Call iModelDb.concurrencyControl.request and iModelDb.saveChanges before applying changesets", Logger.logError, loggerCategory);
  }

  /** @internal */
  public onMergedChanges() {
    this.applyTransactionOptions();
    this._iModel.nativeDb.purgeTileTrees(undefined); // TODO: Remove this when we get tile healing
    const data = { parentChangeSetId: this.iModel.briefcase.parentChangeSetId };
    this._iModel.eventSink!.emit(IModelWriteRpcInterface.name, "onPulledChanges", data);
  }

  /** @internal */
  public onUndoRedo() { this.applyTransactionOptions(); }

  private applyTransactionOptions() { }

  public async syncCache(requestContext: AuthorizedClientRequestContext): Promise<void> {
    this._cache.clear();
    return this._cache.populate(requestContext);
  }

  public async openOrCreateCache(requestContext: AuthorizedClientRequestContext): Promise<void> {
    if (this.iModel.isReadonly)
      throw new IModelError(IModelStatus.BadRequest, "not read-write", Logger.logError, loggerCategory);
    if (this._cache.isOpen)
      return;
    if (this._cache.open())
      return;
    this._cache.create();
    return this._cache.populate(requestContext);
  }

  private addToPendingRequestIfNotHeld(req: ConcurrencyControl.Request) {
    if (this.needLocks)
      this._pendingRequest.addLocks(req.locks.filter((lock) => !this._cache.isLockHeld(lock)));
    this._pendingRequest.addCodes(req.codes.filter((code) => !this._cache.isCodeReserved(code)));
  }

  private applyPolicyBeforeWrite(req: ConcurrencyControl.Request) {
    if (!this.needLocks || this.isBulkMode)
      return;

    for (const lock of req.locks) {
      if (!this._cache.isLockHeld(lock)) {
        const notHeld = req.locks.filter((l) => !this._cache.isLockHeld(l));  // report *all* locks not held
        throw new IModelError(RepositoryStatus.LockNotHeld, "", Logger.logError, loggerCategory, () => notHeld);
      }
    }

    for (const code of req.codes) {
      if (!this._cache.isCodeReserved(code)) {
        const notHeld = req.codes.filter((c) => !this._cache.isCodeReserved(c));  // report *all* codes not held
        throw new IModelError(RepositoryStatus.CodeNotReserved, "", Logger.logError, loggerCategory, () => notHeld);
      }
    }
  }

  /**
   * An app calls this method directly (or via Model.buildConcurrencyControlRequest) when it wants to acquire resources preemptively, before performing an editing operation.
   * @internal [[Model.buildConcurrencyControlRequest]]
   */
  public buildRequestForModel(model: ModelProps, opcode: DbOpcode): void {
    const req = new ConcurrencyControl.Request();
    this.buildRequestForModelTo(req, model, opcode);
    this.addToPendingRequestIfNotHeld(req);
  }

  private buildRequestForModelTo(request: ConcurrencyControl.Request, model: ModelProps, opcode: DbOpcode, modelClass?: typeof Model): void {
    if (modelClass === undefined)
      modelClass = this.iModel.getJsClass(model.classFullName) as typeof Model;
    modelClass.populateRequest(request, model, this.iModel, opcode);
  }

  /*
   * This is an internal callback that is invoked by the Model class just before a model is inserted, updated, or deleted.
   * @internal
   */
  public onModelWrite(modelClass: typeof Model, model: ModelProps, opcode: DbOpcode): void {
    if (this._iModel.isReadonly) {
      throw new IModelError(IModelStatus.ReadOnly, "iModel is read-only", Logger.logError, loggerCategory);
    }
    const resourcesNeeded = new ConcurrencyControl.Request();
    this.buildRequestForModelTo(resourcesNeeded, model, opcode, modelClass);
    this.applyPolicyBeforeWrite(resourcesNeeded);
    this.addToPendingRequestIfNotHeld(resourcesNeeded);

    if (DbOpcode.Delete === opcode) // TODO: Remove this when we get tile healing
      this._modelsAffectedByWrites.add(model.id!); // TODO: Remove this when we get tile healing
  }

  /*
   * This is an internal callback that is invoked by the Element class just after an element is inserted.
   * @internal
   */
  public onModelWritten(_modelClass: typeof Model, id: Id64String, opcode: DbOpcode): void {
    if (opcode !== DbOpcode.Insert || !this.needLocks)
      return;
    this._cache.insertLocks([ConcurrencyControl.Request.getModelLock(id, LockLevel.Exclusive)]);
  }

  /**
   * An app calls this method directly (or via Element.buildConcurrencyControlRequest) when it wants to acquire resources preemptively, before performing an editing operation.
   * @internal [[Element.buildConcurrencyControlRequest]]
   */
  public buildRequestForElement(element: ElementProps, opcode: DbOpcode): void {
    const req = new ConcurrencyControl.Request();
    this.buildRequestForElementTo(req, element, opcode);
    this.addToPendingRequestIfNotHeld(req);
  }

  /**
   * This is public only because Model.populateRequest must be able to call it.
   * @internal
   */
  public buildRequestForElementTo(request: ConcurrencyControl.Request, element: ElementProps, opcode: DbOpcode, elementClass?: typeof Element): void {
    const original = (DbOpcode.Update === opcode) ? this.iModel.elements.getElement(element.id!) : undefined;
    if (elementClass === undefined)
      elementClass = this.iModel.getJsClass(element.classFullName) as typeof Element;
    elementClass.populateRequest(request, element, this.iModel, opcode, original);
  }

  /*
   * This is an internal callback that is invoked by the Element class just before an element is inserted, updated, or deleted.
   * @internal
   */
  public onElementWrite(elementClass: typeof Element, element: ElementProps, opcode: DbOpcode): void {
    if (this._iModel.openParams.syncMode !== SyncMode.PullAndPush) {
      throw new IModelError(IModelStatus.ReadOnly, "iModel is read-only - changes cannot be pushed to the iModelHub", Logger.logError, loggerCategory);
    }
    const resourcesNeeded = new ConcurrencyControl.Request();
    this.buildRequestForElementTo(resourcesNeeded, element, opcode, elementClass);
    this.applyPolicyBeforeWrite(resourcesNeeded);
    this.addToPendingRequestIfNotHeld(resourcesNeeded);
    this._modelsAffectedByWrites.add(element.model);  // TODO: Remove this when we get tile healing
  }

  /*
   * This is an internal callback that is invoked by the Element class just after an element is inserted.
   * @internal
   */
  public onElementWritten(_elementClass: typeof Element, id: Id64String, opcode: DbOpcode): void {
    if (opcode !== DbOpcode.Insert || !this.needLocks)
      return;
    this._cache.insertLocks([ConcurrencyControl.Request.getElementLock(id, LockLevel.Exclusive)]);
  }

  /** @internal [[LinkTableRelationship.buildConcurrencyControlRequest]] */
  public buildRequestForRelationship(_instance: RelationshipProps, _opcode: DbOpcode): void {
    // TODO: We don't have any locks for relationship instances. Get rid of this method?
  }

  /**
   * Request the locks and/or Codes that will be required to carry out the intended write operations. This is a convenience method. It builds the requests and then sends them to the iModel server.
   * @param ctx RequestContext
   * @param elements The elements that will be written
   * @param models The models that will be written
   * @param relationships The relationships that will be written
   * See [[ConcurrencyControl.requestResourcesForInsert]], [[ConcurrencyControl.requestResourcesForUpdate]], [[ConcurrencyControl.requestResourcesForDelete]]
   */
  public async requestResources(ctx: AuthorizedClientRequestContext, elements: ConcurrencyControl.ElementAndOpcode[], models?: ConcurrencyControl.ModelAndOpcode[], relationships?: ConcurrencyControl.RelationshipAndOpcode[]): Promise<void> {
    ctx.enter();

    const prevRequest = this.pendingRequest.clone();

    try {

      for (const e of elements)
        this.buildRequestForElement(e.element, e.opcode);

      if (models) {
        for (const m of models)
          this.buildRequestForModel(m.model, m.opcode);
      }

      if (relationships) {
        for (const r of relationships)
          this.buildRequestForRelationship(r.relationship, r.opcode);
      }

      await this.request(ctx);

      assert(!this.hasPendingRequests);

    } catch (err) {
      // This operation must be atomic - if we didn't obtain the resources, then we must not leave anything in pendingRequests. Caller must re-try after fixing the underlying problem.
      this._pendingRequest = prevRequest;
      throw err;
    }
  }

  /** @internal */
  public async requestResourcesForOpcode(ctx: AuthorizedClientRequestContext, opcode: DbOpcode, elements: ElementProps[], models?: ModelProps[], relationships?: RelationshipProps[]): Promise<void> {
    ctx.enter();

    for (const e of elements)
      this.buildRequestForElement(e, opcode);

    if (models) {
      for (const m of models)
        this.buildRequestForModel(m, opcode);
    }

    if (relationships) {
      for (const r of relationships)
        this.buildRequestForRelationship(r, opcode);
    }

    await this.request(ctx);

    assert(!this._iModel.concurrencyControl.hasPendingRequests);
  }

  /** @internal */
  public async requestResourcesForInsert(ctx: AuthorizedClientRequestContext, elements: ElementProps[], models?: ModelProps[], relationships?: RelationshipProps[]): Promise<void> {
    return this.requestResourcesForOpcode(ctx, DbOpcode.Insert, elements, models, relationships);
  }

  /** @internal */
  public async requestResourcesForUpdate(ctx: AuthorizedClientRequestContext, elements: ElementProps[], models?: ModelProps[], relationships?: RelationshipProps[]): Promise<void> {
    return this.requestResourcesForOpcode(ctx, DbOpcode.Update, elements, models, relationships);
  }

  /** @internal */
  public async requestResourcesForDelete(ctx: AuthorizedClientRequestContext, elements: ElementProps[], models?: ModelProps[], relationships?: RelationshipProps[]): Promise<void> {
    return this.requestResourcesForOpcode(ctx, DbOpcode.Delete, elements, models, relationships);
  }

  /** @internal */
  public get pendingRequest(): ConcurrencyControl.Request {
    return this._pendingRequest;
  }

  /** Are there pending, unprocessed requests for locks or codes? */
  public get hasPendingRequests(): boolean {
    if (!this._iModel.briefcase)
      return false;
    return (this.pendingRequest.codes.length !== 0) || (this.pendingRequest.locks.length !== 0);
  }

  /**
   * Try to acquire locks and/or reserve codes from iModelHub.
   * This function may fulfill some requests and fail to fulfill others. This function returns a rejection of type IModelHubError if some or all requests could not be fulfilled.
   * The error object will identify the locks and/or codes that are unavailable.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:ConcurrencyControl.request]]
   * ```
   * Note that this function will request resources even in bulk mode.
   * @param requestContext The client request context
   * @param req The requests to be sent to iModelHub. If undefined, all pending requests are sent to iModelHub.
   * @throws [[IModelHubError]] if some or all of the request could not be fulfilled by iModelHub.
   * @throws [[IModelError]] if the IModelDb is not open or is not connected to an iModel.
   * See [CodeHandler]($clients) and [LockHandler]($clients) for details on what errors may be thrown.
   * See [[ConcurrencyControl.requestResources]] for a convenience method that builds and makes a request in one step.
   */
  public async request(requestContext: AuthorizedClientRequestContext, req?: ConcurrencyControl.Request): Promise<void> {
    requestContext.enter();
    if (!this._iModel.isOpen)
      return Promise.reject(new Error("not open"));

    if (req === undefined)
      req = this.pendingRequest;
    else
      this.cull(req);

    await this.reserveCodes(requestContext, req.codes); // throws if any code cannot be reserved
    requestContext.enter();

    await this.acquireLocks(requestContext, req.locks); // throws if any lock cannot be acquired.
    requestContext.enter();

    // Now that we know that we have acquired these resources, update the cache to record that fact.
    // (pushChanges will release them all and clear the cache.)
    this._cache.insertCodes(req.codes);
    this._cache.insertLocks(req.locks);
    this._cache.saveChanges();

    // The locks and codes that we acquired are no longer *pending*.
    if (req === this._pendingRequest) {
      this._pendingRequest.clear();
    } else {
      this.cull(this._pendingRequest); // req's locks and codes are no longer *pending* but held.
    }
  }

  private cull(req: ConcurrencyControl.Request, notLocks?: boolean, notCodes?: boolean) {
    if (!notLocks)
      req.removeLocks(this._cache.isLockHeld, this._cache);
    if (!notCodes)
      req.removeCodes(this._cache.isCodeReserved, this._cache);
  }

  public async onPushChanges(_requestContext: AuthorizedClientRequestContext): Promise<void> {
    // Must do this to guarantee that the cache does not become stale if the client crashes after pushing but
    // before performing the various post-push clean-up tasks, such as marking reserved codes as used and releasing
    // locks. I cannot know what state things are in until all of that is done. If onPushedChanges is called, then
    // I can re-populate from the iModel server. If onPushedChanges is never called because of a crash, I need to be
    // able to detect that. The only way I can do that reliably is to find, the next time the briefcase is opened,
    // that the cache does not exist.
    this._cache.deleteFile();
  }

  public async onPushedChanges(requestContext: AuthorizedClientRequestContext): Promise<void> {
    requestContext.enter();

    const data = { parentChangeSetId: this.iModel.briefcase.parentChangeSetId };
    this._iModel.eventSink!.emit(IModelWriteRpcInterface.name, "onPushedChanges", data);

    return this.openOrCreateCache(requestContext); // re-create after we know that push has succeeded
  }

  private emitOnSavedChangesEvent() {
    // tslint:disable-next-line:no-debugger
    const data = { hasPendingTxns: this.iModel.txns.hasPendingTxns, time: Date.now() }; // Note that not all calls to saveChanges create a txn. For example, an update to be_local does not.
    this._iModel.eventSink!.emit(IModelWriteRpcInterface.name, "onSavedChanges", data);
  }

  public async onOpened(requestContext: AuthorizedClientRequestContext): Promise<void> {
    if (this._iModel.openParams.syncMode !== SyncMode.PullAndPush)
      return;

    assert(!this._iModel.concurrencyControl._cache.isOpen, "BriefcaseDb.onOpened should be raised only once");

    this._iModel.txns.onCommitted.addListener(this.emitOnSavedChangesEvent, this);

    return this.openOrCreateCache(requestContext);
  }

  public async onClose(_requestContext: AuthorizedClientRequestContext): Promise<void> {
    this._iModel.txns.onCommitted.removeListener(this.emitOnSavedChangesEvent, this);
    this._cache.close(true);
  }

  /** Schedule the shared Db lock. */
  public buildConcurrencyControlRequestForDb() {
    const req = new ConcurrencyControl.Request();
    req.addLocks([ConcurrencyControl.Request.dbLock]);
    this.addToPendingRequestIfNotHeld(req);
  }

  /** Obtain the schema lock. This is always an immediate request, never deferred. See [LockHandler]($clients) for details on what errors may be thrown. */
  public async lockSchema(requestContext: AuthorizedClientRequestContext): Promise<Lock[]> {
    const locks = [ConcurrencyControl.Request.getHubSchemaLock(this)];

    if (this.hasSchemaLock)
      return locks;

    requestContext.enter();

    Logger.logTrace(loggerCategory, `lockSchema`);
    const res = await BriefcaseManager.imodelClient.locks.update(requestContext, this._iModel.iModelToken.iModelId!, locks);
    if (res.length !== 1 || res[0].lockLevel !== LockLevel.Exclusive) {
      Logger.logError(loggerCategory, `lockSchema failed`);
      assert(false, "update should have thrown if it could not satisfy the request.");
    }

    this._cache.insertLocks([ConcurrencyControl.Request.schemaLock]);
    return res;
  }

  /** Returns `true` if the schema lock is held.
   * @param requestContext The client request context
   * @alpha Need to determine if we want this method
   */
  public get hasSchemaLock(): boolean {
    return this._cache.isLockHeld(ConcurrencyControl.Request.schemaLock);
  }

  /** Returns `true` if the CodeSpecs lock is held.
   * @param requestContext The client request context
   * @alpha Need to determine if we want this method
   */
  public get hasCodeSpecsLock(): boolean {
    return this._cache.isLockHeld(ConcurrencyControl.Request.codeSpecsLock);
  }

  /** Obtain the CodeSpec lock. This is always an immediate request, never deferred. See [LockHandler]($clients) for details on what errors may be thrown. */
  public async lockCodeSpecs(requestContext: AuthorizedClientRequestContext): Promise<Lock[]> {

    const locks = [ConcurrencyControl.Request.getHubCodeSpecsLock(this)];

    if (this.hasCodeSpecsLock)
      return locks;

    requestContext.enter();
    Logger.logTrace(loggerCategory, `lockCodeSpecs`);
    const res = await BriefcaseManager.imodelClient.locks.update(requestContext, this._iModel.iModelToken.iModelId!, locks);
    if (res.length !== 1 || res[0].lockLevel !== LockLevel.Exclusive) {
      Logger.logError(loggerCategory, `lockCodeSpecs failed`);
      assert(false, "update should have thrown if it could not satisfy the request.");
    }

    this._cache.insertLocks([ConcurrencyControl.Request.codeSpecsLock]);

    return res;
  }

  public getHeldLock(type: LockType, objectId: Id64String): LockLevel {
    return this._cache.getHeldLock(type, objectId);
  }

  public getHeldModelLock(modelId: Id64String): LockLevel {
    return this.getHeldLock(LockType.Model, modelId);
  }

  public getHeldElementLock(elementId: Id64String): LockLevel {
    return this.getHeldLock(LockType.Element, elementId);
  }

  private async acquireLocks(requestContext: AuthorizedClientRequestContext, locks: ConcurrencyControl.LockProps[]): Promise<Lock[]> {
    requestContext.enter();

    if (locks.length === 0)
      return [];

    if (!this.needLocks)
      return [];

    const hubLocks = ConcurrencyControl.Request.toHubLocks(this, locks);

    Logger.logTrace(loggerCategory, `acquireLocksFromRequest ${JSON.stringify(locks)}`);
    const lockStates = await BriefcaseManager.imodelClient.locks.update(requestContext, this._iModel.iModelToken.iModelId!, hubLocks);
    requestContext.enter();
    Logger.logTrace(loggerCategory, `result = ${JSON.stringify(lockStates)}`);

    return lockStates;
  }

  /** Reserve the specified codes. See [CodeHandler]($clients) for details on what errors may be thrown. */
  public async reserveCodes(requestContext: AuthorizedClientRequestContext, codes: CodeProps[]): Promise<HubCode[]> {
    requestContext.enter();

    if (codes.length === 0)
      return [];

    const hubCodes = ConcurrencyControl.Request.toHubCodes(this, codes);

    if (!this._iModel.isOpen)
      return Promise.reject(new Error("not open"));

    Logger.logTrace(loggerCategory, `reserveCodes ${JSON.stringify(hubCodes)}`);
    const codeStates = await BriefcaseManager.imodelClient.codes.update(requestContext, this._iModel.briefcase.iModelId, hubCodes);
    requestContext.enter();
    Logger.logTrace(loggerCategory, `result = ${JSON.stringify(codeStates)}`);

    return codeStates;
  }

  // Query the state of the Codes for the specified CodeSpec and scope. See [CodeHandler]($clients) for details on what errors may be thrown.
  public async queryCodeStates(requestContext: AuthorizedClientRequestContext, specId: Id64String, scopeId: string, value?: string): Promise<HubCode[]> {
    requestContext.enter();
    if (!this._iModel.isOpen)
      return Promise.reject(new Error("not open"));

    const query = new CodeQuery();

    if (value !== undefined) {
      query.byCodes(ConcurrencyControl.Request.toHubCodes(this, [{ spec: specId, scope: scopeId, value }]));
    } else {
      query.byCodeSpecId(specId).byCodeScope(scopeId);
    }

    return BriefcaseManager.imodelClient.codes.get(requestContext, this._iModel.briefcase.iModelId, query);
  }

  /**
   * Check to see if *all* of the specified codes are available.
   * @param requestContext The client request context
   * @param req the list of code requests to be fulfilled. If not specified then all pending requests for codes are queried.
   * @returns true if all codes are available or false if any is not.
   * @beta
   */
  public async areCodesAvailable2(requestContext: AuthorizedClientRequestContext, codes: CodeProps[]): Promise<boolean> {
    requestContext.enter();
    const req = new ConcurrencyControl.Request();
    req.addCodes(codes);
    return this.areCodesAvailable(requestContext, req);
  }

  /** Abandon any pending requests for locks or codes. */
  public abandonRequest() { this._pendingRequest.clear(); }

  /**
   * Check to see that this briefcase could reserve (or has already reserved) all of the specified Codes.
   * @param requestContext The client request context
   * @param req the codes to be checked for their available status. If not specified then all pending requests for codes are queried.
   * @returns true if all codes are available or false if any is not.
   */
  public async areCodesAvailable(requestContext: AuthorizedClientRequestContext, req?: ConcurrencyControl.Request): Promise<boolean> {
    requestContext.enter();
    if (!this._iModel.isOpen)
      return Promise.reject(new Error("not open"));

    if (req === undefined)
      req = this.pendingRequest;
    else
      this.cull(req, true, false); // remove any codes and locks that are known to be held by this briefcase already. We'll say they are "available".

    if (req.codes.length === 0)
      return true;

    const hubCodes = ConcurrencyControl.Request.toHubCodes(this, req.codes);

    const codesHandler = BriefcaseManager.imodelClient.codes;
    const chunkSize = 100;
    for (let i = 0; i < hubCodes.length; i += chunkSize) {
      const query = new CodeQuery().byCodes(hubCodes.slice(i, i + chunkSize));
      const result = await codesHandler.get(requestContext, this._iModel.briefcase.iModelId, query);
      for (const code of result) {
        if (code.state !== CodeState.Available)
          return false;
      }
    }
    return true;
  }

  /**
   * Check to see if this briefcase could acquire (or already has acquired) the specified locks at that specified levels.
   * @param requestContext The client request context
   * @param req the lock requests to check. If not specified then all pending requests for locks are queried.
   * @returns true if all locks are available or false if any is not.
   */
  public async areLocksAvailable(requestContext: AuthorizedClientRequestContext, req?: ConcurrencyControl.Request): Promise<boolean> {
    requestContext.enter();
    if (!this._iModel.isOpen)
      return Promise.reject(new Error("not open"));

    if (req === undefined)
      req = this.pendingRequest;
    else
      this.cull(req, false, true);

    if (req.locks.length === 0)
      return true;

    // req.locks is a list of locks that this briefcase does not hold, either at all or at the requested higher level.

    const hubLocks = ConcurrencyControl.Request.toHubLocks(this, req.locks);

    const briefcaseId = this.iModel.getBriefcaseId();

    const locksHandler = BriefcaseManager.imodelClient.locks;
    const chunkSize = 100;
    for (let i = 0; i < hubLocks.length; i += chunkSize) {
      const query = new LockQuery().byLocks(hubLocks.slice(i, i + chunkSize));
      const result = await locksHandler.get(requestContext, this._iModel.briefcase.iModelId, query);
      for (const lock of result) {
        // If the lock is not held at all, then it's available.
        if (lock.lockLevel === LockLevel.None || lock.lockLevel === undefined || lock.briefcaseId === undefined)
          continue;
        // If the lock is held by this briefcase, but at a lower level, then it *might* be available for an upgrade.
        // Wait and see if we encounter a conflicting claim by another briefcase later in the list.
        if (lock.briefcaseId === briefcaseId)
          continue;
        // This lock is held by some other briefcase at some level.
        // If we are requesting it at a higher level, then our request would be denied.
        if (undefined !== req.locks.find((reqLock) => (reqLock.level > lock.lockLevel!)))
          return false;
      }
    }
    return true; // no unavailable locks were found.
  }

  /**
   * Check to see if *all* of the requested resources could be acquired from iModelHub.
   * @param requestContext The client request context
   * @param req the list of resource requests to be fulfilled. If not specified then all pending requests for locks and codes are queried.
   * @returns true if all resources could be acquired or false if any could not be acquired.
   */
  public async areAvailable(requestContext: AuthorizedClientRequestContext, req?: ConcurrencyControl.Request): Promise<boolean> {
    requestContext.enter();
    if (!this._iModel.isOpen)
      return Promise.reject(new Error("not open"));

    if (req === undefined)
      req = this.pendingRequest;
    else
      this.cull(req);

    if (req.isEmpty)
      return true;

    const allCodesAreAvailable = await this.areCodesAvailable(requestContext, req);
    requestContext.enter();
    if (!allCodesAreAvailable)
      return false;

    requestContext.enter();
    if (!allCodesAreAvailable)
      return false;

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
      throw new IModelError(IModelStatus.BadRequest, "Invalid briefcase", Logger.logError, loggerCategory);
    let rc: RepositoryStatus;
    if (policy instanceof ConcurrencyControl.OptimisticPolicy) {
      const oc: ConcurrencyControl.OptimisticPolicy = policy as ConcurrencyControl.OptimisticPolicy;
      rc = this._iModel.briefcase.nativeDb.setBriefcaseManagerOptimisticConcurrencyControlPolicy(oc.conflictResolution);
    } else {
      rc = this._iModel.briefcase.nativeDb.setBriefcaseManagerPessimisticConcurrencyControlPolicy();
    }
    if (RepositoryStatus.Success !== rc) {
      throw new IModelError(rc, "Error setting concurrency control policy", Logger.logError, loggerCategory);
    }
    this.applyTransactionOptions();
  }

  /** API to reserve Codes and query the status of Codes */
  get codes(): ConcurrencyControl.Codes {
    if (this._codes === undefined)
      this._codes = new ConcurrencyControl.Codes(this._iModel);
    return this._codes;
  }
}

/** @beta */
export namespace ConcurrencyControl {

  /**
   * The properties of an iModel server lock.
   * @beta
   */
  export interface LockProps {
    type: LockType;
    objectId: string;
    level: LockLevel;
  }

  /** A request for locks and/or code reservations. */
  export class Request {
    private _locks: ConcurrencyControl.LockProps[] = [];
    private _codes: CodeProps[] = [];

    public clone(): Request {
      const c = new Request();
      deepAssign(c, this);
      return c;
    }

    public get locks(): ConcurrencyControl.LockProps[] { return this._locks; }
    public get codes(): CodeProps[] { return this._codes; }

    public static get dbLock(): LockProps {
      return { type: LockType.Db, objectId: "1", level: LockLevel.Shared };
    }

    public static get schemaLock(): LockProps {
      return { type: LockType.Schemas, objectId: "1", level: LockLevel.Exclusive };
    }

    public static get codeSpecsLock(): LockProps {
      return { type: LockType.CodeSpecs, objectId: "1", level: LockLevel.Exclusive };
    }

    public static getElementLock(objectId: Id64String, level: LockLevel): LockProps {
      return { type: LockType.Element, objectId, level };
    }

    public static getModelLock(objectId: Id64String, level: LockLevel): LockProps {
      return { type: LockType.Model, objectId, level };
    }

    public getLockByKey(type: LockType, objectId: string): LockProps | undefined {
      // We don't expect a large number locks in a request. Therefore, simple brute-force search should be fine.
      // If that proves to be false, we can implement a Map on the side to help with look-ups and de-duping.
      for (const l of this.locks) {
        if (l.type === type && l.objectId === objectId)
          return l;
      }
      return undefined;
    }

    public addLocks(locks: LockProps[]): this {
      locks.forEach((lock) => {
        const existingLock = this.getLockByKey(lock.type, lock.objectId);
        if (existingLock === undefined)
          this.locks.push(lock);
        else {
          if (existingLock.level < lock.level)
            existingLock.level = lock.level;
          // If the lock is already in the request at a higher level, stick with that. The user must delete and re-add to demote.
        }
      });
      return this;
    }

    public addCodes(codes: CodeProps[]): this {
      codes.forEach((code) => this.codes.push(code));
      return this;
    }

    public removeLocks(filter: (l: LockProps) => boolean, context: any) {
      // NB: The supplied `filter` function chooses the locks to *remove*.
      // The JS array filter function takes as its argument a function that indicates which items to *retain*.
      // Therefore, we return the negation of the supplied `filter` function to the JS filter operation.
      this._locks = this._locks.filter((lock) => !filter.apply(context, [lock]));
    }

    public removeCodes(filter: (c: CodeProps) => boolean, context: any) {
      this._codes = this._codes.filter((code) => !filter.apply(context, [code]));
    }

    public get isEmpty(): boolean {
      return this.codes.length === 0 && this.locks.length === 0;
    }

    public clear() {
      this.codes.length = 0;
      this.locks.length = 0;
      assert(this.isEmpty);
    }

    public static toHubCode(concurrencyControl: ConcurrencyControl, code: CodeProps): HubCode {
      const requestCode = new HubCode();
      requestCode.briefcaseId = concurrencyControl.iModel.briefcase.briefcaseId;
      requestCode.state = CodeState.Reserved;
      requestCode.codeSpecId = code.spec;
      requestCode.codeScope = code.scope;
      requestCode.value = code.value;
      return requestCode;
    }

    public static toHubCodes(concurrencyControl: ConcurrencyControl, codes: CodeProps[]): HubCode[] {
      return codes.map((cReq) => this.toHubCode(concurrencyControl, cReq));
    }

    public static toHubLock(concurrencyControl: ConcurrencyControl, reqLock: LockProps): Lock {
      const lock = new Lock();
      lock.briefcaseId = concurrencyControl.iModel.briefcase.briefcaseId;
      lock.lockLevel = reqLock.level;
      lock.lockType = reqLock.type;
      lock.objectId = reqLock.objectId;
      lock.releasedWithChangeSet = concurrencyControl.iModel.briefcase.currentChangeSetId;
      lock.seedFileId = concurrencyControl.iModel.briefcase.fileId!;
      return lock;
    }

    public static getHubSchemaLock(concurrencyControl: ConcurrencyControl): Lock {
      return this.toHubLock(concurrencyControl, this.schemaLock);
    }

    public static getHubCodeSpecsLock(concurrencyControl: ConcurrencyControl): Lock {
      return this.toHubLock(concurrencyControl, this.codeSpecsLock);
    }

    public static toHubLocks(concurrencyControl: ConcurrencyControl, locks: LockProps[]): Lock[] {
      return locks.map((lock) => this.toHubLock(concurrencyControl, lock));
    }
  }

  export interface ElementAndOpcode {
    element: ElementProps;
    opcode: DbOpcode;
  }

  export interface ModelAndOpcode {
    model: ModelProps;
    opcode: DbOpcode;
  }

  export interface RelationshipAndOpcode {
    relationship: RelationshipProps;
    opcode: DbOpcode;
  }

  /* Keep this consistent with DgnPlatform/RepositoryManager.h. */
  /** How to handle a conflict. */
  export enum OnConflict {
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

  /** Code manager */
  export class Codes {
    constructor(private _iModel: BriefcaseDb) { }

    /**
     * Reserve Codes.
     * If no Codes are specified, then all of the Codes that are in currently pending requests are reserved.
     * This function may only be able to reserve some of the requested Codes. In that case, this function will return a rejection of type RequestError.
     * The error object will identify the codes that are unavailable.
     * <p><em>Example:</em>
     * ``` ts
     * [[include:ConcurrencyControl_Codes.reserve]]
     * ```
     * @param requestContext The client request context
     * @param codes The Codes to reserve
     * @throws [[IModelHubError]]
     */
    public async reserve(requestContext: AuthorizedClientRequestContext, codes?: CodeProps[]): Promise<void> {
      requestContext.enter();

      if (codes === undefined)
        codes = this._iModel.concurrencyControl.pendingRequest.codes;

      const req = new ConcurrencyControl.Request();
      req.addCodes(codes);

      await this._iModel.concurrencyControl.request(requestContext, req);
    }

    /**
     * Queries the state of the specified Codes in the code service.
     * @param requestContext The client request context
     * @param specId The CodeSpec to query
     * @param scopeId The scope to query
     * @param value Optional. The Code value to query.
     */
    public async query(requestContext: AuthorizedClientRequestContext, specId: Id64String, scopeId: string, value?: string): Promise<HubCode[]> {
      return this._iModel.concurrencyControl.queryCodeStates(requestContext, specId, scopeId, value);
    }
  }

  /**
   * Manages locally cached information about the resources currently held by this briefcase.
   * @internal
   */
  export class StateCache {
    private static _cachesOpen = new Set<string>();

    private _db: ECDb = new ECDb();

    public constructor(public concurrencyControl: ConcurrencyControl) { }

    public get isOpen(): boolean { return this._db.isOpen; }

    private mustHaveBriefcase() {
      if (this.concurrencyControl.iModel === undefined || this.concurrencyControl.iModel.briefcase === undefined
        || this.concurrencyControl.iModel.openParams.syncMode !== SyncMode.PullAndPush)
        throw new IModelError(IModelStatus.NotOpenForWrite, "not a briefcase that can be used to push changes to the IModel Hub", Logger.logError, loggerCategory, () => this.concurrencyControl.iModel.briefcase.getDebugInfo());
    }

    private mustBeOpenAndWriteable() {
      if (this.concurrencyControl.iModel.openParams.syncMode !== SyncMode.PullAndPush)
        throw new IModelError(IModelStatus.NotOpenForWrite, "not a briefcase that can be used to push changes to the IModel Hub", Logger.logError, loggerCategory, () => this.concurrencyControl.iModel.briefcase.getDebugInfo());
      if (!this.isOpen)
        throw new IModelError(IModelStatus.NotOpen, "not open", Logger.logError, loggerCategory, () => this.computeCacheFileName());
    }

    private static onOpen(fn: string) {
      if (this._cachesOpen.has(fn))
        throw new IModelError(IModelStatus.AlreadyOpen, `ConcurrencyControl StateCache is already open ${fn}`, Logger.logError, loggerCategory);
      this._cachesOpen.add(fn);
    }

    private static onClose(fn: string) {
      this._cachesOpen.delete(fn);
    }

    private computeCacheFileName(): string {
      this.mustHaveBriefcase();
      const fn = this.concurrencyControl.iModel.briefcase.pathname;
      return path.join(path.dirname(fn), path.basename(fn, ".bim") + ".cctl.bim");
    }

    private isCorrupt(): boolean {
      let foundSignature = false;
      this._db.withPreparedSqliteStatement("select count(*) from be_local where name='cctl_version' and val='0.1' limit 1", ((stmt) => {
        foundSignature = (stmt.step() === DbResult.BE_SQLITE_ROW);
      }));
      return !foundSignature;
    }

    public close(saveChanges: boolean) {
      if (saveChanges)
        this._db.saveChanges();
      else
        this._db.abandonChanges();
      this._db.closeDb();

      StateCache.onClose(this.computeCacheFileName());
    }

    private initializeDb() {
      const initStmts = [
        `create table reservedCodes ( specid TEXT NOT NULL, scope TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (specid, scope, value) )`,
        `create table heldLocks ( type INTEGER NOT NULL, objectId TEXT NOT NULL, level INTEGER NOT NULL, PRIMARY KEY (type, objectId, level) )`,
        `insert into be_local (name,val) values('cctl_version','0.1')`,
      ];

      initStmts.forEach((sql) => {
        const stmt = this._db.prepareSqliteStatement(sql);
        const rc = stmt.step();
        if (DbResult.BE_SQLITE_DONE !== rc)
          throw new IModelError(rc, "", Logger.logError, loggerCategory, () => sql);
        stmt.dispose();
      });
    }

    public open(): boolean {
      this.mustHaveBriefcase();
      const fn = this.computeCacheFileName();

      if (!IModelJsFs.existsSync(fn))
        return false;

      this._db.openDb(fn, ECDbOpenMode.ReadWrite);

      if (this.isCorrupt()) {
        this.close(false);
        IModelJsFs.unlinkSync(fn);
        return false;
      }

      StateCache.onOpen(fn);

      return true;
    }

    public create() {
      this.mustHaveBriefcase();
      const fn = this.computeCacheFileName();

      this._db.createDb(fn);
      this.initializeDb();
      this._db.saveChanges();

      StateCache.onOpen(fn);
    }

    public deleteFile() {
      this.close(false);
      IModelJsFs.unlinkSync(this.computeCacheFileName());
    }

    public clear() {
      this.mustBeOpenAndWriteable();
      this._db.withPreparedSqliteStatement("delete from heldLocks", (stmt) => stmt.step());
      this._db.withPreparedSqliteStatement("delete from reservedCodes", (stmt) => stmt.step());
      this._db.saveChanges();
    }

    public getHeldLock(type: LockType, objectId: string): LockLevel {
      this.mustBeOpenAndWriteable();
      let ll = LockLevel.None;
      this._db.withPreparedSqliteStatement("select level from heldLocks where (type=?) and (objectId=?)", (stmt) => {
        stmt.bindValue(1, type);
        stmt.bindValue(2, objectId);
        if (stmt.step() === DbResult.BE_SQLITE_ROW)
          ll = stmt.getValue(0).getInteger();
      });
      return ll;
    }

    public isLockHeld(lock: LockProps): boolean {
      return this.getHeldLock(lock.type, lock.objectId) >= lock.level;
    }

    public isCodeReserved(code: CodeProps): boolean {
      this.mustBeOpenAndWriteable();
      let isFound = false;
      this._db.withPreparedSqliteStatement("select count(*) from reservedCodes where (specid=?) and (scope=?) and (value=?) limit 1", (stmt) => {
        stmt.bindValue(1, code.spec);
        stmt.bindValue(2, code.scope);
        stmt.bindValue(3, code.value);
        if (stmt.step() === DbResult.BE_SQLITE_ROW) // (note that result is always ROW for a count aggregate query.)
          isFound = (0 !== stmt.getValue(0).getInteger());
      });
      return isFound;
    }

    public insertCodes(codes: CodeProps[]) {
      this.mustBeOpenAndWriteable();
      this._db.withPreparedSqliteStatement("insert into reservedCodes (specid,scope,value) VALUES(?,?,?)", (stmt) => {
        for (const code of codes) {
          stmt.reset();
          stmt.clearBindings();
          stmt.bindValue(1, code.spec);
          stmt.bindValue(2, code.scope);
          stmt.bindValue(3, code.value);
          const rc = stmt.step();
          if (rc !== DbResult.BE_SQLITE_DONE)
            throw new IModelError(IModelStatus.SQLiteError, "", Logger.logError, loggerCategory, () => ({ rc, code }));
        }
      });
    }

    public insertLocks(locks: LockProps[]) {
      this.mustBeOpenAndWriteable();
      this._db.withPreparedSqliteStatement("insert into heldLocks (type,objectId,level) VALUES(?,?,?)", (stmt) => {
        for (const lock of locks) {
          stmt.reset();
          stmt.clearBindings();
          stmt.bindValue(1, lock.type);
          stmt.bindValue(2, lock.objectId);
          stmt.bindValue(3, lock.level);
          const rc = stmt.step();
          if (rc !== DbResult.BE_SQLITE_DONE)
            throw new IModelError(IModelStatus.SQLiteError, "", Logger.logError, loggerCategory, () => ({ rc, lock }));
        }
      });
    }

    public saveChanges() {
      this._db.saveChanges();
    }

    public async populate(requestContext: AuthorizedClientRequestContext): Promise<void> {
      this.mustHaveBriefcase();

      this.clear();

      const bcId = this.concurrencyControl.iModel.briefcase.briefcaseId;
      const iModelId = this.concurrencyControl.iModel.iModelToken.iModelId!;

      const heldLocks = await BriefcaseManager.imodelClient.locks.get(requestContext, iModelId, new LockQuery().byBriefcaseId(bcId));
      const lockProps: LockProps[] = heldLocks.map((lock) => ({ type: lock.lockType!, objectId: lock.objectId!, level: lock.lockLevel! }));
      assert(undefined === lockProps.find((lp) => (lp.level === LockLevel.None)));
      this.insertLocks(lockProps);

      const reservedCodes: HubCode[] = await BriefcaseManager.imodelClient.codes.get(requestContext, iModelId, new CodeQuery().byBriefcaseId(bcId));
      const codeProps: CodeProps[] = reservedCodes.map((code) => ({ spec: code.codeSpecId!, scope: code.codeScope!, value: code.value! }));
      assert(undefined === codeProps.find((cp) => (cp.value === undefined || cp.value === "")));
      this.insertCodes(codeProps);

      this.saveChanges();
    }

  }

}
