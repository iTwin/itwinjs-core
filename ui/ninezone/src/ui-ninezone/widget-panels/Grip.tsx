/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Grip.scss";
import classnames from "classnames";
import * as React from "react";
import { Point, Rectangle, Timer } from "@bentley/ui-core";
import { assert } from "../base/assert";
import { useDragPanelGrip, UseDragPanelGripArgs } from "../base/DragManager";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
import { isHorizontalPanelSide, PanelSide, PanelStateContext } from "./Panel";
import { PointerCaptorArgs, usePointerCaptor } from "../base/PointerCaptor";

/** Resize grip of [[WidgetPanel]] component.
 * @internal
 */
export const WidgetPanelGrip = React.memo(function WidgetPanelGrip() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panel = React.useContext(PanelStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  assert(panel);
  const { side } = panel;
  const handleResize = React.useCallback((resizeBy: number) => {
    dispatch({
      type: "PANEL_RESIZE",
      side,
      resizeBy,
    });
  }, [dispatch, side]);
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: "PANEL_TOGGLE_COLLAPSED",
      side,
    });
  }, [dispatch, side]);
  const [ref, resizing, active] = useResizeGrip<HTMLDivElement>(side, handleResize, handleDoubleClick);
  const className = classnames(
    "nz-widgetPanels-grip",
    `nz-${side}`,
    active && "nz-active",
    panel.collapsed && "nz-collapsed",
    resizing && "nz-resizing",
  );
  const resizeGripTitle = useLabel("resizeGripTitle");

  return (
    <div
      className={className}
      ref={ref}
      title={resizeGripTitle}
    >
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
    </div>
  );
});

/** @internal */
export const useResizeGrip = <T extends HTMLElement>(
  side: PanelSide,
  onResize?: (resizeBy: number) => void,
  onDoubleClick?: () => void,
): [(instance: T | null) => void, boolean, boolean,] => {
  const initialPointerPosition = React.useRef<Point>();
  const dragStartTimer = React.useRef(new Timer(300));
  const handleClick = useDoubleClick(onDoubleClick);
  const ref = React.useRef<T | null>(null);
  const relativePosition = React.useRef(new Point());
  const [resizing, setResizing] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const onDrag = React.useCallback<NonNullable<UseDragPanelGripArgs["onDrag"]>>((pointerPosition, lastPointerPosition) => {
    if (!ref.current)
      return;
    const newRelativePosition = Rectangle.create(ref.current.getBoundingClientRect()).topLeft().getOffsetTo(pointerPosition);
    const resizeOffset = relativePosition.current.getOffsetTo(newRelativePosition);
    const dragOffset = lastPointerPosition.getOffsetTo(pointerPosition);
    const dragBy = isHorizontalPanelSide(side) ? dragOffset.y : dragOffset.x;
    const resizeBy = isHorizontalPanelSide(side) ? resizeOffset.y : resizeOffset.x;
    const direction = side === "left" || side === "top" ? 1 : -1;
    dragBy * resizeBy > 0 && onResize && onResize(direction * resizeBy);
  }, [side, onResize]);
  const onDragEnd = React.useCallback(() => {
    setResizing(false);
  }, []);
  const handlePanelGripDragStart = useDragPanelGrip({
    side,
    onDrag,
    onDragEnd,
  });
  React.useEffect(() => {
    const timer = dragStartTimer.current;
    timer.setOnExecute(() => {
      if (initialPointerPosition.current && ref.current) {
        relativePosition.current = Rectangle.create(ref.current.getBoundingClientRect()).topLeft().getOffsetTo(initialPointerPosition.current);
        setResizing(true);
        handlePanelGripDragStart({
          initialPointerPosition: initialPointerPosition.current,
        });
      }
      initialPointerPosition.current = undefined;
    });
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [handlePanelGripDragStart]);
  const handleDragEnd = React.useCallback(() => {
    initialPointerPosition.current = undefined;
    dragStartTimer.current.stop();
    handleClick();
    setActive(false);
  }, [handleClick]);
  const handlePointerDown = React.useCallback((args: PointerCaptorArgs) => {
    initialPointerPosition.current = new Point(args.clientX, args.clientY);
    dragStartTimer.current.start();
    setActive(true);
  }, []);
  const handlePointerMove = React.useCallback((args: PointerCaptorArgs) => {
    if (!initialPointerPosition.current)
      return;
    const position = new Point(args.clientX, args.clientY);
    setResizing(true);
    handlePanelGripDragStart({
      initialPointerPosition: position,
    });
    onDrag(position, initialPointerPosition.current);
    initialPointerPosition.current = undefined;
    dragStartTimer.current.stop();
  }, [handlePanelGripDragStart, onDrag]);
  const handlePointerCaptorRef = usePointerCaptor(handlePointerDown, handlePointerMove, handleDragEnd);
  const handleRef = React.useCallback((instance: T | null) => {
    ref.current = instance;
    handlePointerCaptorRef(instance);
  }, [handlePointerCaptorRef]);
  return [handleRef, resizing, active];
};

/** @internal */
export function useDoubleClick(onDoubleClick?: () => void): () => void {
  const timer = React.useRef(new Timer(300));
  const clickCount = React.useRef(0);
  timer.current.setOnExecute(() => {
    clickCount.current = 0;
  });
  const handleClick = React.useCallback(() => {
    timer.current.start();
    clickCount.current++;
    if (clickCount.current === 2) {
      onDoubleClick && onDoubleClick();
      clickCount.current = 0;
      timer.current.stop();
    }
  }, [onDoubleClick]);
  return handleClick;
}
