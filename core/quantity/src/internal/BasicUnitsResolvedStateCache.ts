/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SerializedUnitSchema } from "../SerializedUnitSchema";
import { buildResolvedBasicUnitsData, type ResolvedBasicUnitsData } from "./BasicUnitConversionData";

// Shared module-level cache for the built-in basic-units indexes used by BasicUnitsProvider.
let _resolvedData: ResolvedBasicUnitsData | undefined;
let _resolvePromise: Promise<ResolvedBasicUnitsData> | undefined;
// Cache the first load/build failure so later callers observe the same module-level failure
// instead of silently retrying with a different partial-initialization state.
let _permanentError: Error | undefined;

function rememberFailure(err: unknown): never {
  _permanentError = err instanceof Error ? err : new Error(String(err));
  _resolvePromise = undefined;
  throw _permanentError;
}

/** Returns the shared resolved data for the built-in basic units, loading/building it asynchronously if needed.
 * @internal
 */
export async function resolveBasicUnitsData(loadSchema: () => Promise<SerializedUnitSchema>): Promise<ResolvedBasicUnitsData> {
  if (_permanentError !== undefined)
    throw _permanentError;

  if (_resolvedData !== undefined)
    return _resolvedData;

  if (_resolvePromise === undefined) {
    _resolvePromise = loadSchema()
      .then((schema) => {
        _resolvedData ??= buildResolvedBasicUnitsData(schema);
        return _resolvedData;
      })
      .catch(rememberFailure);
  }

  return _resolvePromise;
}

/** @internal — test use only. Resets the shared module-level lazy cache.
 * This stays in source rather than under a test folder because the public test seam
 * `BasicUnitsProvider._testResetUnitsCache()` lives in source and delegates here.
 */
export function _testResetResolvedBasicUnitsDataCache(): void {
  _resolvedData = undefined;
  _resolvePromise = undefined;
  _permanentError = undefined;
}
