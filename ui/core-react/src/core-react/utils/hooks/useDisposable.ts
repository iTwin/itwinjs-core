/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { useEffect, useMemo, useRef } from "react";
import type { IDisposable } from "@itwin/core-bentley";

/**
 * A custom hook which creates a disposable object and manages its disposal on unmount
 * or factory method change.
 * @public
 */
export function useDisposable<TDisposable extends IDisposable>(createDisposable: () => TDisposable): TDisposable {
  return useOptionalDisposable(createDisposable)!;
}

/**
 * A custom hook which calls the factory method to create a disposable object
 * which might as well be undefined. If the result was a disposable object, the
 * hook takes care of disposing it when necessary.
 * @public
 */
export function useOptionalDisposable<TDisposable extends IDisposable>(createDisposable: () => TDisposable | undefined): TDisposable | undefined {
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
