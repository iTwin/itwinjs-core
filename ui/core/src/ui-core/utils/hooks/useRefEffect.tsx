/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** Returns callback ref that is easy to setup and cleanup (API wise similar to React.useEffect).
 * @internal
 */
export function useRefEffect<T>(callback: (instance: T | null) => (void | (() => void)), deps: ReadonlyArray<any>) {
  const cleanup = React.useRef<(() => void) | null>(null);
  return React.useCallback((instance: T | null) => {
    cleanup.current && cleanup.current();
    const newCleanup = callback(instance);
    cleanup.current = !newCleanup ? null : newCleanup;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
