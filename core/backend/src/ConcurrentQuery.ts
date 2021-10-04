/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { QueryQuota } from "@itwin/core-common";

/** Configuration for concurrent query manager
 * @internal
 */
export interface Config {
  /** Time seconds after which any completed query result will be purged */
  autoExpireTimeForCompletedQuery?: number;
  /** Number of concurrent worker to use. By default set to available CPUs */
  concurrent?: number;
  /** Number of ECSQL cached statement held by a single worker */
  cachedStatementsPerThread?: number;
  /** Maximum size of query queue after which incoming queries are rejected */
  maxQueueSize?: number;
  /** Minimum time interval in seconds after which monitor starts. */
  minMonitorInterval?: number;
  /** idle period of time in seconds after which resources and caches are purged */
  idleCleanupTime?: number;
  /** Poll interval in milliseconds. */
  pollInterval?: number;
  /** Global restriction on query quota */
  quota?: QueryQuota;
  /** Use sqlite shared cache option */
  useSharedCache?: boolean;
  /** Read uncommitted read for better performance */
  useUncommittedRead?: boolean;
  /** Reset statistics after query manager is not used for following amount of time in minutes. Cannot be less then 10 minutes */
  resetStatisticsInterval?: number;
  /** Log statistics interval in minutes. Cannot be less then 5 minutes */
  logStatisticsInterval?: number;
}
