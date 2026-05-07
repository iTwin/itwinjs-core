/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SerializedUnitSchema } from "../SerializedUnitSchema";
import { type BasicUnitsResolvedState, buildBasicUnitsResolvedState } from "./BasicUnitConversionData";

// Shared module-level cache for the built-in basic-units indexes.
// Both the synchronous UnitConversions helpers and the async BasicUnitsProvider resolve the same
// immutable state, so the expensive schema walk happens at most once per process.
let _resolvedState: BasicUnitsResolvedState | undefined;
let _resolvePromise: Promise<BasicUnitsResolvedState> | undefined;
let _permanentError: Error | undefined;

function rememberFailure(err: unknown): never {
  _permanentError = err instanceof Error ? err : new Error(String(err));
  _resolvePromise = undefined;
  throw _permanentError;
}

/** Returns the shared resolved state for the built-in basic units, building it synchronously if needed.
 * @internal
 */
export function getBasicUnitsResolvedState(schema: SerializedUnitSchema): BasicUnitsResolvedState {
  if (_permanentError !== undefined)
    throw _permanentError;

  _resolvedState ??= buildBasicUnitsResolvedState(schema);
  return _resolvedState;
}

/** Returns the shared resolved state for the built-in basic units, loading/building it asynchronously if needed.
 * @internal
 */
export async function resolveBasicUnitsResolvedState(loadSchema: () => Promise<SerializedUnitSchema>): Promise<BasicUnitsResolvedState> {
  if (_permanentError !== undefined)
    throw _permanentError;

  if (_resolvedState !== undefined)
    return _resolvedState;

  if (_resolvePromise === undefined) {
    _resolvePromise = loadSchema()
      .then((schema) => {
        _resolvedState ??= buildBasicUnitsResolvedState(schema);
        return _resolvedState;
      })
      .catch(rememberFailure);
  }

  return _resolvePromise;
}

/** @internal — test use only. Resets the shared module-level lazy cache.
 * This stays in source rather than under a test folder because the public test seam
 * `BasicUnitsProvider._testResetUnitsCache()` lives in source and delegates here.
 */
export function _testResetBasicUnitsResolvedStateCache(): void {
  _resolvedState = undefined;
  _resolvePromise = undefined;
  _permanentError = undefined;
}
