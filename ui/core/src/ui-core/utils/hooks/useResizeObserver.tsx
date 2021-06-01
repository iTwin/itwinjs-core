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
  const owningWindowRef = React.useRef<any>(null);

  // istanbul ignore next
  const resizeObserverCleanup = () => {
    if (rafRef.current)
      owningWindowRef.current.cancelAnimationFrame(rafRef.current);

    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
  };

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (rafRef.current)
        owningWindowRef.current.cancelAnimationFrame(rafRef.current);
      owningWindowRef.current?.removeEventListener("beforeunload", resizeObserverCleanup);
    };
  }, []);

  const processResize = React.useCallback((target: HTMLElement) => {
    const newBounds = target.getBoundingClientRect();
    // istanbul ignore else
    if (isMountedRef.current && (bounds.width !== newBounds.width || bounds.height !== newBounds.height)) {
      setBounds(newBounds);
      onResize && onResize(newBounds.width, newBounds.height);
    }
  }, [onResize, bounds.height, bounds.width]);

  const handleResize = React.useCallback((entries: any[]) => {
    // istanbul ignore if
    if (!isMountedRef.current || !Array.isArray(entries) || 0 === entries.length) {
      return;
    }
    const target = entries[0].target as HTMLElement;
    // istanbul ignore next
    owningWindowRef.current && owningWindowRef.current.removeEventListener("beforeunload", resizeObserverCleanup);

    owningWindowRef.current = target.ownerDocument.defaultView;
    // istanbul ignore else
    if (owningWindowRef.current) {
      owningWindowRef.current.addEventListener("beforeunload", resizeObserverCleanup);

      // using requestAnimationFrame to stop the "ResizeObserver loop completed with undelivered notifications." and
      // "ResizeObserver loop limit exceeded" messages reported to window.onError
      rafRef.current = owningWindowRef.current.requestAnimationFrame(() => processResize(target));
    }
  }, [processResize]);

  const observerRef = useRefEffect((instance: T | null) => {
    resizeObserver.current = new ResizeObserver(handleResize);
    if (instance) {
      resizeObserver.current.observe(instance);
      const newBounds = instance.getBoundingClientRect();
      onResize && onResize(newBounds.width, newBounds.height);
      setBounds(newBounds);
    }

    return () => {
      instance && resizeObserver.current && resizeObserver.current.unobserve(instance);
      resizeObserver.current = null;
    };
  }, [handleResize, onResize]);

  const handleRef = React.useCallback((instance: Element | null) => {
    const newBounds = instance && instance.getBoundingClientRect();
    // istanbul ignore if
    if (newBounds && (bounds.width !== newBounds.width || bounds.height !== newBounds.height)) {
      setBounds(newBounds);
      onResize && onResize(newBounds.width, newBounds.height);
    }
  }, [bounds.height, bounds.width, onResize]);

  const ref = useRefs(handleRef, observerRef);
  return ref;
}

/** React hook that uses ResizeObserver API to notify about element bound changes. Note: to work similar to ReactResizeDetector
 * width and height are initialized as undefined and only set during after mount if bounds are non-zero. This implementation properly
 * handles observing element in pop-out/child windows.
  * @internal
  */
export function useLayoutResizeObserver(ref: React.RefObject<HTMLElement>, onResize?: (width?: number, height?: number) => void) {
  const [bounds, setBounds] = React.useState<{ width?: number, height?: number }>({});
  const resizeObserver = React.useRef<ResizeObserver | null>(null);
  const rafRef = React.useRef(0);  // set to non-zero when requestAnimationFrame processing is active
  const isMountedRef = React.useRef(false);
  const owningWindowRef = React.useRef<any>(null);

  // istanbul ignore next
  const resizeObserverCleanup = () => {
    if (rafRef.current)
      owningWindowRef.current.cancelAnimationFrame(rafRef.current);

    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
  };

  React.useEffect(() => {
    isMountedRef.current = true;
    // istanbul ignore else
    if (ref.current) {
      const newBounds = ref.current.getBoundingClientRect();
      if (newBounds.width || newBounds.height) {
        onResize && onResize(newBounds.width, newBounds.height);
        setBounds(newBounds);
      }
    }

    return () => {
      isMountedRef.current = false;
      (rafRef.current && owningWindowRef.current) && owningWindowRef.current.cancelAnimationFrame(rafRef.current);
      owningWindowRef.current && owningWindowRef.current.removeEventListener("beforeunload", resizeObserverCleanup);
    };
  }, [onResize, ref]);

  const processResize = React.useCallback((target: HTMLElement) => {
    const newBounds = target.getBoundingClientRect();
    // istanbul ignore else
    if (isMountedRef.current && (bounds.width !== newBounds.width || bounds.height !== newBounds.height)) {
      onResize && onResize(newBounds.width, newBounds.height);
      setBounds(newBounds);
    }
  }, [bounds.height, bounds.width, onResize]);

  const handleResize = React.useCallback((entries: any[]) => {
    // istanbul ignore next
    if (!isMountedRef.current || !Array.isArray(entries) || 0 === entries.length) {
      return;
    }
    const target = entries[0].target as HTMLElement;
    // istanbul ignore next
    if (owningWindowRef.current)
      owningWindowRef.current.removeEventListener("beforeunload", resizeObserverCleanup);

    owningWindowRef.current = target.ownerDocument.defaultView;
    // istanbul ignore else
    if (owningWindowRef.current) {
      owningWindowRef.current.addEventListener("beforeunload", resizeObserverCleanup);

      // using requestAnimationFrame to stop the "ResizeObserver loop completed with undelivered notifications." and
      // "ResizeObserver loop limit exceeded" messages reported to window.onError
      rafRef.current = owningWindowRef.current.requestAnimationFrame(() => processResize(target));
    }
  }, [processResize]);

  React.useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    resizeObserver.current = new ResizeObserver(handleResize);
    resizeObserver.current.observe(ref.current);
    return () => {
      // istanbul ignore next
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
    };
  }, [handleResize, ref]);

  return [bounds.width, bounds.height];
}

/** Prop the ElementResizeObserver sends to the render function.
 *  @beta */
export interface RenderPropsArgs {
  width?: number;
  height?: number;
}

/** ElementResizeObserver provides functionality similar to ReactResizeDetector when a render function is specified. This implementation properly handles
 * observing element in pop-out/child windows.
 *  @beta
 */
export function ElementResizeObserver({ watchedElement, render }: { watchedElement: React.RefObject<HTMLElement>, render: (props: RenderPropsArgs) => JSX.Element }) {
  const [width, height] = useLayoutResizeObserver(watchedElement);
  return render({ width, height });
}

/** ResizableContainerObserver is a component that provides the same functionality as the ReactResizeDetector option to call a function when
 * the observed element is resized. This implementation properly handles observing element in pop-out/child windows.
 * @beta */
export function ResizableContainerObserver({ onResize, children }: { onResize: (width: number, height: number) => void, children?: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null);  // set to non-zero when requestAnimationFrame processing is active

  const processResize = React.useCallback((width?: number, height?: number) => {
    // istanbul ignore next
    onResize(width ?? 0, height ?? 0);
  }, [onResize]);

  useLayoutResizeObserver(containerRef, processResize);
  return (
    <div ref={containerRef} className="uicore-resizable-container" style={{ width: "100%", height: "100%" }}>
      {!!children && children}
    </div>
  );
}
