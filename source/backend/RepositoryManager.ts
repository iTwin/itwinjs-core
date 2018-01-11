/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb } from "./IModelDb";
import { NodeAddonDgnDb, NodeAddonHeldResources, NodeAddonRepositoryManagerResponse } from "@bentley/imodeljs-nodeaddonapi";
import { RepositoryStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import { IModelError } from "../common/IModelError";

// TODO: Move this into a common location that both imodeljs-backend and imodeljs-nodeaddonapi can see.
export enum NodeAddonRepositoryManagerResponseOptions {
  None = 0, // No special options
  LockState = 1 << 0, // If a request to acquire locks is denied, the response will include the current lock state of each denied lock
  CodeState = 1 << 1, // Include DgnCodeState for any codes for which the request was denied
  RevisionIds = 1 << 2, // For locks or codes requiring a revision to be pulled, include the specific revision IDs.
  UnlimitedReporting = 1 << 3, // Acuire all denied instances despite server side thresholds
  All = 0xff, // Include all options
}

// TODO: Move this into a common location that both imodeljs-backend and imodeljs-nodeaddonapi can see.
export enum NodeAddonRepositoryManagerRequestPurpose {
  Acquire,    // Attempted to acquire locks/codes
  Query,      // Queried server for availability of locks/codes
  FastQuery,  // Queried local cache for availability of locks/codes. Response may not include full ownership details for denied request.
}

export class RepositoryManager {
  public db: IModelDb;

  constructor(db: IModelDb) {
    this.db = db;
  }

  /**
   * Process a request.
   * @param reqJson The request in stringified JSON format.
   * @param db The DgnDb
   * @param queryOnly Is the request only to query the locks and codes? Otherwise, the request is to acquire them.
   * @return non-zero error status if the request fails.
   */
  public processRequest(reqJsonStr: string, _db: NodeAddonDgnDb, queryOnly: boolean): NodeAddonRepositoryManagerResponse {
    if (queryOnly)
      return {Status: RepositoryStatus.Success, Purpose: NodeAddonRepositoryManagerRequestPurpose.Acquire, Options: NodeAddonRepositoryManagerResponseOptions.None, LockStates: "", CodeStates: ""};

    const req = JSON.parse(reqJsonStr);
    if (req.Codes.length !== 0 || req.Locks.length !== 0) {
      throw new IModelError(RepositoryStatus.InvalidRequest, "TBD: only supporting optimistic concurrency for now. All codes must be reserved before calling saveChanges");
    }

    return {Status: RepositoryStatus.Success, Purpose: NodeAddonRepositoryManagerRequestPurpose.Acquire, Options: req.Options, LockStates: "", CodeStates: ""};
  }

  /**
   * Retrieves the set of resources held by a briefcase as recorded in the repository
   * @param db    The requesting briefcase
   * @remarks This method shoudld only return resources tracked by the repository. It should exclude locks that are implicitly
   * held for elements/models created locally by this briefcase and not yet committed to the repository
   * @return the locks and codes that are held, plus a list of locks and codes that are unavailable.
   */
  public queryHeldResources(_db: NodeAddonDgnDb): NodeAddonHeldResources {
    // TBD: For now, we pretend that we hold all needed codes.
    // TBD: For now, we support only optimistic concurrency, where locks are not needed.
    return {status: RepositoryStatus.Success, codes: "", locks: "", unavailableCodes: "", unavailableLocks: ""};
  }

}
