/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { useEffect, useRef } from "react";

/**
 * Custom hook which works like useEffect hook, but does not invoke callback when effect is triggered for the first time.
 * @public
 */
export function useEffectSkipFirst(callback: () => (void | (() => void | undefined)) | void, deps?: any[]) {
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    return callback();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
