/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

/**
 * Hook that adds and removes Event listeners.
 * @example
 *  useEventListener(
 *     'pointerup',
 *     handlePointerUp,
 *     containerRef.current?.ownerDocument,
 *  );
 * @internal
 */
export function useEventListener(
  eventName: string,
  handler: (event: Event) => void,
  element: HTMLElement | Document | undefined
) {
  // Based on published hook https://usehooks.com/useEventListener/.
  const savedHandler = React.useRef<(event: Event) => void>();

  // Update reference if handler changes. This allows our effect below to
  // always use latest handler without us needing to pass it in effect deps array
  // and potentially cause effect to re-run every render.
  React.useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  React.useEffect(() => {
    if (!element) {
      return;
    }

    const eventListener = (event: Event) => {
      // istanbul ignore else
      if (savedHandler.current)
        savedHandler.current(event);
    };
    element.addEventListener(eventName, eventListener);
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}
