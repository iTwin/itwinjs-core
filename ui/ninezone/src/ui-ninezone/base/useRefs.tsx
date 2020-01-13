/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";

/** Callback ref typeguard. */
function isRefCallback<T>(ref: React.Ref<T>): ref is (_: T | null) => void {
  return typeof ref === "function";
}

/** Used to combine multiple refs.
 * @internal
 */
export function useRefs<T>(...refs: ReadonlyArray<React.Ref<T>>) {
  return React.useCallback((instance: T | null) => {
    for (const ref of refs) {
      if (isRefCallback(ref)) {
        ref(instance);
      } else {
        (ref as React.MutableRefObject<T | null>).current = instance;
      }
    }
  }, [...refs]); // eslint-disable-line react-hooks/exhaustive-deps
}
