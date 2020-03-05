/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */
import { useRefEffect } from "@bentley/ui-core";

/** Delays raising click event to determine if action is double click.
 * Will not fire click event if action is double click.
 * @internal
 */
export function useSingleDoubleClick<T extends HTMLElement>(onClick?: () => void, onDoubleClick?: () => void) {
  const ref = useRefEffect((instance: T | null) => {
    let clicks = 0;
    const handleClick = () => {
      clicks++;
      if (clicks === 1)
        setTimeout(() => {
          if (clicks === 1)
            onClick && onClick();
          else
            onDoubleClick && onDoubleClick();
          clicks = 0;
        }, 300);
    };
    instance && instance.addEventListener("click", handleClick);
    return () => {
      instance && instance.removeEventListener("click", handleClick);
    };
  }, [onClick, onDoubleClick]);
  return ref;
}
