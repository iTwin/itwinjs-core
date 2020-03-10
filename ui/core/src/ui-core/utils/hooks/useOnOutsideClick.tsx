/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";

/** Invokes onOutsideClick handler when user clicks outside of referenced element.
 * @internal
 */
export function useOnOutsideClick<T extends Element>(
  onOutsideClick?: () => void,
  /** Invoked for intermediate pointer events. Return `false` to prevent outside click. */
  outsideEventPredicate?: (e: PointerEvent) => boolean,
) {
  const ref = React.useRef<T | null>(null);
  const isDownOutside = React.useRef(false);
  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const isOutsideEvent = !outsideEventPredicate || outsideEventPredicate(e);
      isDownOutside.current = (!!ref.current && (e.target instanceof Node) && !ref.current.contains(e.target)) && isOutsideEvent;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [outsideEventPredicate]);
  React.useEffect(() => {
    const onPointerUp = (e: PointerEvent) => {
      onOutsideClick && isDownOutside.current && (!outsideEventPredicate || outsideEventPredicate(e)) &&
        ref.current && e.target instanceof Node && !ref.current.contains(e.target) && onOutsideClick();
      isDownOutside.current = false;
    };
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [onOutsideClick, outsideEventPredicate]);
  return ref;
}
