import { QueryQuota } from "@bentley/imodeljs-common";

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** Wrapper around a promise that allows synchronous queries of it's state
 * @internal
 */



/** Configuration for concurrent query manager
 * @internal
 */
export interface Config {
  /** Time seconds after which any completed query result will be purged */
  autoExpireTimeForCompletedQuery?: number;
  /** Number of concurrent worker to use. By default set to avaliable CPUs */
  concurrent?: number;
  /** Number of ECSQL cached statement held by a single worker */
  cachedStatementsPerThread?: number;
  /** Maximum size of query queue after which incomming queries are rejected */
  maxQueueSize?: number;
  /** Minimum time interval in seconds after which monitor kickin. */
  minMonitorInterval?: number;
  /** Idol period of time in seconds after which resouces and caches are purged */
  idolCleanupTime?: number;
  /** Global restriction on query quota */
  quota?: QueryQuota;
}


/** Post status for concurrent query manager */
export enum PostStatus {
  NotInitalized = 0,
  Done = 1,
  QueueSizeExceded = 2,
}

/** Poll status for concurrent query manager */
export enum PollStatus {
  NotInitalized = 0,
  Done = 1,
  Pending = 2,
  Partial = 3,
  Timeout = 4,
  Error = 5,
  NotFound = 6,
}

