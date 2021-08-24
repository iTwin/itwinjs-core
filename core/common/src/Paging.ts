/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSQL
 */

/** The desired ECSql query quota constraint. It is not guaranteed exactly but will be met as accurately as possible as long as it narrows the constraints imposed by the backend.
 * @public
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
  /** Maximum rows allowed to be returned */
  maxRowAllowed?: number;
  /** If set number of rows to skip before returning results */
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
 * @public
 */
export enum QueryResponseStatus {
  Partial = 3, /** Partial result due to query exceeded allocated quota */
  Done = 2, /** There is no more rows */
  Error = 5, /** Error while preparing or stepping into query */
  Timeout = 4, /** Query time quota while it was in queue */
  PostError = 6, /** Submitting query task failed. May happen if queue size exceeds */
  Cancelled = 7, /** Query cancelled */
}

/** Result of a query. Its not intended to be used directly by client
 * @public
 */
export interface QueryResponse {
  rows: any[];
  status: QueryResponseStatus;
}
