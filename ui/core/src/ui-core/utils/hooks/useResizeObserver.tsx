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
  const [bounds, setBounds] = React.useState({ width: 0, height: 0 });
  const resizeObserver = React.useRef<ResizeObserver | null>(null);
  const rafRef = React.useRef(0);  // set to non-zero when requestAnimationFrame processing is active
  const isMountedRef = React.useRef(false);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (rafRef.current)
        window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const processResize = React.useCallback((target: HTMLElement) => {
    const newBounds = target.getBoundingClientRect();
    if (isMountedRef.current && bounds.width !== newBounds.width || bounds.height !== newBounds.height) {
      setBounds(newBounds);
      onResize && onResize(newBounds.width, newBounds.height);
    }
  }, [onResize, bounds.height, bounds.width]);

  const handleResize = React.useCallback((entries: any[]) => {
    // istanbul ignore else
    if (!isMountedRef.current || !Array.isArray(entries) || 0 === entries.length) {
      return;
    }
    const target = entries[0].target as HTMLElement;
    // using requestAnimationFrame to stop the "ResizeObserver loop completed with undelivered notifications." and
    // "ResizeObserver loop limit exceeded" messages reported to window.onError
    rafRef.current = window.requestAnimationFrame(() => processResize(target));
  }, [processResize]);

  const observerRef = useRefEffect((instance: T | null) => {
    resizeObserver.current = new ResizeObserver(handleResize);
    instance && resizeObserver.current.observe(instance);
    return () => {
      instance && resizeObserver.current!.unobserve(instance);
      resizeObserver.current = null;
    };
  }, [handleResize]);

  const handleRef = React.useCallback((instance: Element | null) => {
    const newBounds = instance && instance.getBoundingClientRect();
    if (newBounds && (bounds.width !== newBounds.width || bounds.height !== newBounds.height)) {
      setBounds(newBounds);
      onResize && onResize(newBounds.width, newBounds.height);
    }
  }, [bounds.height, bounds.width, onResize]);

  const ref = useRefs(handleRef, observerRef);
  return ref;
}
