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
      instance && ( /* istanbul ignore next */resizeObserver.current?.unobserve(instance));
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
export function useLayoutResizeObserver(inElement: HTMLElement | null, onResize?: (width?: number, height?: number) => void) {
  const inBoundingRect = inElement?.getBoundingClientRect();
  const [bounds, setBounds] = React.useState<{ width?: number, height?: number }>({ width: inBoundingRect?.width, height: inBoundingRect?.height });
  const [watchedElement, setWatchedElement] = React.useState(inElement);
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
    setWatchedElement(inElement);

    // istanbul ignore next
    if (inElement) {
      const newBounds = inElement.getBoundingClientRect();
      onResize && onResize(newBounds.width, newBounds.height);
      setBounds(newBounds);
    }

    return () => {
      isMountedRef.current = false;
      (rafRef.current && owningWindowRef.current) && owningWindowRef.current.cancelAnimationFrame(rafRef.current);
      owningWindowRef.current && owningWindowRef.current.removeEventListener("beforeunload", resizeObserverCleanup);
    };
  }, [onResize, inElement]);

  const processResize = React.useCallback((target: HTMLElement) => {
    const newBounds = target.getBoundingClientRect();
    // istanbul ignore next
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
    if (!watchedElement) {
      return;
    }
    resizeObserver.current = new ResizeObserver(handleResize);
    resizeObserver.current.observe(watchedElement);
    return () => {
      // istanbul ignore next
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
    };
  }, [handleResize, watchedElement]);

  return [bounds.width, bounds.height];
}

/** Prop the ElementResizeObserver sends to the render function.
 *  @public
 */
export interface RenderPropsArgs {
  width?: number;
  height?: number;
}

/** ElementResizeObserver provides functionality similar to ReactResizeDetector when a render function is specified. This implementation properly handles
 * observing element in pop-out/child windows.
 *  @public
 */
export function ElementResizeObserver({ watchedElement, render }: { watchedElement: HTMLElement | null, render: (props: RenderPropsArgs) => JSX.Element }) {
  const [width, height] = useLayoutResizeObserver(watchedElement);
  return render({ width, height });
}

/** ResizableContainerObserver is a component that provides the functionality similar to the ReactResizeDetector option that call a function when
 * the observed element is resized. This implementation properly handles observing element in pop-out/child windows. If children nodes are defined then
 * the div added by the component is considered the container whose size will be observed. If no children are provided then the component will report
 * size changes from its parent container.
 * @public
 */
export function ResizableContainerObserver({ onResize, children }: { onResize: (width: number, height: number) => void, children?: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null);  // set to non-zero when requestAnimationFrame processing is active
  const [containerElement, setContainerElement] = React.useState<HTMLElement | null>(null);
  const isMountedRef = React.useRef(false);
  const hasChildren = React.Children.count(children) !== 0;

  // if no children are specified then monitor size of parent element.
  React.useEffect(() => {
    // istanbul ignore next
    if (!isMountedRef.current && containerRef.current) {
      isMountedRef.current = true;
      const hasParent = !!containerRef.current.parentElement;
      setContainerElement(hasChildren && hasParent ? containerRef.current : containerRef.current.parentElement);
    }
  }, [hasChildren]);

  const processResize = React.useCallback((width?: number, height?: number) => {
    // istanbul ignore next
    onResize(width ?? 0, height ?? 0);
  }, [onResize]);

  useLayoutResizeObserver(containerElement, processResize);
  const style: React.CSSProperties = hasChildren ? { width: "100%", height: "100%" } : { display: "none" };

  return (
    <div ref={containerRef} className="uicore-resizable-container" style={style}>
      {hasChildren && children}
    </div>
  );
}
