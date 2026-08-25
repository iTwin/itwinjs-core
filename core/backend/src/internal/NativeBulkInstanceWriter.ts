/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */

import { Id64String } from "@itwin/core-bentley";

/** The subset of the native db interface that performs batched instance writes.
 * @internal
 */
export interface NativeBulkInstanceWriter {
  bulkInsertInstances(instances: object[], options: object): Id64String[];
  bulkUpdateInstances(instances: object[], options: object): number;
  bulkDeleteInstances(keys: object[], options: object): number;
}

/**
 * Bridges to the batched instance-write entry points of the native addon.
 *
 * These methods were added to `@bentley/imodeljs-native` after the version currently pinned by this
 * repository, so they are described here rather than being consumed from the addon's own typings.
 * Once the pinned `@bentley/imodeljs-native` version exposes them, this module can be deleted and
 * callers can use the addon typings directly.
 *
 * @internal
 */
export function tryGetNativeBulkWriter(nativeDb: object): NativeBulkInstanceWriter | undefined {
  const candidate = nativeDb as Partial<NativeBulkInstanceWriter>;
  return typeof candidate.bulkInsertInstances === "function"
    && typeof candidate.bulkUpdateInstances === "function"
    && typeof candidate.bulkDeleteInstances === "function"
    ? candidate as NativeBulkInstanceWriter
    : undefined;
}

/** True if the loaded native addon supports the bulk instance write API.
 * @internal
 */
export function isNativeBulkWriteSupported(nativeDb: object): boolean {
  return undefined !== tryGetNativeBulkWriter(nativeDb);
}

/** @internal */
export function getNativeBulkWriter(nativeDb: object): NativeBulkInstanceWriter {
  const writer = tryGetNativeBulkWriter(nativeDb);
  if (undefined === writer) {
    throw new Error("The bulk instance write API requires a newer version of @bentley/imodeljs-native than the one currently loaded.");
  }
  return writer;
}
