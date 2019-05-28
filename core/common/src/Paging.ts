/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
/** ECSql query quota constraint. Its not guaranteed exactly but will be meet as accuratly as possiable
 * @internal
 */
export interface QueryQuota {
  /** Maximum time in seconds after which query will be stopped */
  maxTimeAllowed?: number;
  /** Maximum size of result in bytes after which query will be stopped */
  maxMemoryAllowed?: number;
}

/** ECSql query subset specification
 * @public
 */
export interface QueryLimit {
  /** Maximum time in seconds after which query will be stopped */
  maxRowAllowed?: number;
  /** Maximum size of result in bytes after which query will be stopped */
  startRowOffset?: number;
}
/** Queue priority for query and its not guaranteed
 * @public
 */
export enum QueryPriority {
  Low = 0,
  Normal = 1,
  High = 2,
}

/** State of query operations
 * @internal
 */
export enum QueryResponseStatus {
  Partial = 3, /** Partial result due to query exceded allocated quota */
  Done = 2, /** There is no more rows */
  Error = 5, /** Error while preparing or stepping into query */
  Timeout = 4, /** Query time quota while it was in queue */
  PostError = 6, /** Submitting query task failed. May happen if queue size execeds */
}
/** Result of a query. Its not intented to be used directly by client
 * @internal
 */
export interface QueryResponse {
  rows: any[];
  status: QueryResponseStatus;
}
