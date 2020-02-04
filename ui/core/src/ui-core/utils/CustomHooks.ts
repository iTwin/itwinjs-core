/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useRef, useMemo } from "react";
import { IDisposable } from "@bentley/bentleyjs-core";

/** Custom hook which works like useEffect hook, but does not invoke callback when effect
 * is triggered first time.
 *
 * @alpha
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

/** Custom hooks which creates disposable and manages it's disposal.
 * @beta
 */
export function useDisposable<TDisposable extends IDisposable>(createDisposable: () => TDisposable) {
  const previous = useRef<TDisposable>();
  const value = useMemo(() => {
    if (previous.current)
      previous.current.dispose();

    previous.current = createDisposable();
    return previous.current;
  }, [createDisposable]);

  useEffect(() => () => previous.current && previous.current.dispose(), []);
  return value;
}
