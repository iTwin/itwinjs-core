/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
export function useResizeObserver<T extends Element>(onResize?: (width: number) => void, useHeight?: boolean) {
  const observerRef = useRefEffect((instance: T | null) => {
    const resizeObserver = new ResizeObserver((entries) => {
      entries.length === 1 && onResize && onResize(useHeight ? entries[0].target.getBoundingClientRect().height : entries[0].target.getBoundingClientRect().width);
    });
    instance && resizeObserver.observe(instance);
    return () => {
      instance && resizeObserver.unobserve(instance);
    };
  }, [onResize]);
  const handleRef = React.useCallback((instance: T | null) => {
    instance && onResize && onResize(useHeight ? instance.getBoundingClientRect().height : instance.getBoundingClientRect().width);
  }, [onResize, useHeight]);
  const ref = useRefs(handleRef, observerRef);
  return ref;
}
