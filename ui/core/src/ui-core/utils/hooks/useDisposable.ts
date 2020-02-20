/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useRef, useMemo } from "react";
import { IDisposable } from "@bentley/bentleyjs-core";

/**
 * Custom hook which creates a disposable object and manages it's disposal on unmount.
 * @public
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
