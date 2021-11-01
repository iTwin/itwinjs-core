/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** Callback ref type guard. */
function isRefCallback<T>(ref: React.Ref<T>): ref is (_: T | null) => void {
  return typeof ref === "function";
}

/** Hook used to combine multiple refs.
 * @internal
 */
export function useRefs<T>(...refs: ReadonlyArray<React.Ref<T>>) {
  return React.useCallback((instance: T | null) => {
    for (const ref of refs) {
      // istanbul ignore else
      if (ref) {
        if (isRefCallback(ref)) {
          ref(instance);
        } else {
          (ref as React.MutableRefObject<T | null>).current = instance;
        }
      }
    }
  }, [...refs]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Used to combine multiple refs for a class component.
 * @internal
 */
export function mergeRefs<T>(...refs: ReadonlyArray<React.Ref<T>>) {
  return ((instance: T | null) => {
    for (const ref of refs) {
      // istanbul ignore else
      if (ref) {
        if (isRefCallback(ref)) {
          ref(instance);
        } else {
          (ref as React.MutableRefObject<T | null>).current = instance;
        }
      }
    }
  });
}
