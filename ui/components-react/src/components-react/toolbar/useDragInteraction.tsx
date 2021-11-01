/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import { Point, Timer } from "@itwin/core-react";

/** @internal */
const getDragDistance = (from: Point, to: Point) => {
  return from.getDistanceTo(to);
};

interface UseDragArgs {
  readonly initialPosition: React.MutableRefObject<Point | undefined>;
  readonly onDrag: () => void;
}

function useDrag(args: UseDragArgs) {
  const { initialPosition, onDrag } = args;
  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    // istanbul ignore if
    if (!initialPosition.current)
      return;
    const newPosition = new Point(e.clientX, e.clientY);
    const dragDistance = getDragDistance(initialPosition.current, newPosition);
    if (dragDistance < 20)
      return;
    onDrag();
  }, [initialPosition, onDrag]);
  return { handlePointerMove };
}

interface UseLongPressArgs {
  readonly initialPosition: React.RefObject<Point | undefined>;
  readonly onLongPress: () => void;
}

function useLongPress(args: UseLongPressArgs) {
  const longPressTimer = React.useRef(new Timer(500));
  const handlePointerDown = React.useCallback(() => {
    longPressTimer.current.start();
  }, []);
  const handlePointerUp = React.useCallback(() => {
    longPressTimer.current.stop();
  }, []);

  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    if (!args.initialPosition.current)
      return;
    const newPosition = new Point(e.clientX, e.clientY);
    const distance = args.initialPosition.current.getDistanceTo(newPosition);
    distance >= 10 && longPressTimer.current.stop();
  }, [args.initialPosition]);
  React.useEffect(() => {
    longPressTimer.current.setOnExecute(args.onLongPress);
    return () => {
      longPressTimer.current.setOnExecute(undefined); // eslint-disable-line react-hooks/exhaustive-deps
    };
  }, [args.onLongPress]);
  return { handlePointerDown, handlePointerMove, handlePointerUp };
}

/**
 * Hook used on expandable item that require drag or long press to open
 * @param onClick Function called when item is clicked.
 * @param onOpenPanel Function called when item is dragged or long pressed to open panel.
 * @public
 */
export function useDragInteraction(onClick?: () => void, onOpenPanel?: () => void) {
  const initialPosition = React.useRef<Point | undefined>(undefined);
  const skipClick = React.useRef<boolean>(false);
  const handleOpenPanel = React.useCallback(() => {
    initialPosition.current = undefined;
    skipClick.current = true;
    onOpenPanel && onOpenPanel();
  }, [onOpenPanel]);
  const {
    handlePointerMove: dragPointerMove,
  } = useDrag({
    initialPosition,
    onDrag: handleOpenPanel,
  });
  const {
    handlePointerDown: longPressPointerDown,
    handlePointerMove: longPressPointerMove,
    handlePointerUp: longPressPointerUp,
  } = useLongPress({
    initialPosition,
    onLongPress: handleOpenPanel,
  });
  const handleButtonClick = React.useCallback(() => {
    // istanbul ignore if
    if (skipClick.current)
      return;
    onClick && onClick();
  }, [onClick]);
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    (e.target instanceof Element) && e.target.releasePointerCapture(e.pointerId);
    initialPosition.current = new Point(e.clientX, e.clientY);
    skipClick.current = false;
    longPressPointerDown();
  }, [longPressPointerDown]);
  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    dragPointerMove(e);
    longPressPointerMove(e);
  }, [dragPointerMove, longPressPointerMove]);
  const handlePointerUp = React.useCallback(() => {
    initialPosition.current = undefined;
    longPressPointerUp();
  }, [longPressPointerUp]);
  React.useEffect(() => {
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);
  return { handlePointerDown, handleButtonClick };
}
