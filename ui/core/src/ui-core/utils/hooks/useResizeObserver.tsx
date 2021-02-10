/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */
import * as React from "react";
import { ResizeObserver } from "./ResizeObserverPolyfill";
import { useRefEffect } from "./useRefEffect";
import { useRefs } from "./useRefs";

/** Uses ResizeObserver API to notify about element bound changes.
 * @internal
 */
export function useResizeObserver<T extends Element>(onResize?: (width: number, height: number) => void) {
  const observerRef = useRefEffect((instance: T | null) => {
    const resizeObserver = new ResizeObserver((entries) => {
      const bounds = entries.length === 1 && entries[0].target.getBoundingClientRect();
      bounds && onResize && onResize(bounds.width, bounds.height);
    });
    instance && resizeObserver.observe(instance);
    return () => {
      instance && resizeObserver.unobserve(instance);
    };
  }, [onResize]);
  const handleRef = React.useCallback((instance: T | null) => {
    const bounds = instance && instance.getBoundingClientRect();
    bounds && onResize && onResize(bounds.width, bounds.height);
  }, [onResize]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRefs(handleRef, observerRef);
  return ref;
}
