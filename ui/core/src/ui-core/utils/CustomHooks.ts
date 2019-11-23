/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useRef } from "react";

/** Custom hook which works like useEffect hook, but does not invoke callback when effect
 * is triggered first time.
 *
 * @alpha
 */
export function useEffectSkipFirst(callback: () => void, deps?: any[]) {
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    callback();
  }, deps);
}
