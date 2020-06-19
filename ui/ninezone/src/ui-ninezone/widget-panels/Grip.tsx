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
import { NineZoneDispatchContext } from "../base/NineZone";
import { isHorizontalPanelSide, PanelSide, PanelStateContext } from "./Panel";

/** Resize grip of [[WidgetPanel]] component.
 * @internal
 */
export const WidgetPanelGrip = React.memo(function WidgetPanelGrip() { // tslint:disable-line: variable-name no-shadowed-variable
  const [active, setActive] = React.useState(false);
  const panel = React.useContext(PanelStateContext);
  assert(panel);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const { side } = panel;
  const initialPointerPosition = React.useRef<Point>();
  const handleResize = React.useCallback((resizeBy: number) => {
    dispatch({
      type: "PANEL_RESIZE",
      side,
      resizeBy,
    });
  }, [dispatch, side]);
  const dragStartTimer = React.useRef(new Timer(300));
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: "PANEL_TOGGLE_COLLAPSED",
      side,
    });
  }, [dispatch, side]);
  const [handleClick] = useDoubleClick(handleDoubleClick);
  const [handleResizeStart, ref, resizing] = useResizeGrip<HTMLDivElement>(side, handleResize);
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    initialPointerPosition.current = new Point(e.clientX, e.clientY);
    dragStartTimer.current.start();
    setActive(true);
  }, []);
  const handlePointerUp = React.useCallback(() => {
    initialPointerPosition.current = undefined;
    dragStartTimer.current.stop();
    handleClick();
    setActive(false);
  }, [handleClick]);
  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!initialPointerPosition.current)
      return;
    handleResizeStart(new Point(e.clientX, e.clientY));
    initialPointerPosition.current = undefined;
    dragStartTimer.current.stop();
  }, [handleResizeStart]);
  React.useEffect(() => {
    const timer = dragStartTimer.current;
    timer.setOnExecute(() => {
      initialPointerPosition.current && handleResizeStart(initialPointerPosition.current);
      initialPointerPosition.current = undefined;
    });
    return () => {
      timer.setOnExecute(undefined);
    };
  }, [handleResizeStart]);
  const className = classnames(
    "nz-widgetPanels-grip",
    `nz-${side}`,
    active && "nz-active",
    panel.collapsed && "nz-collapsed",
    resizing && "nz-resizing",
  );
  return (
    <div
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={ref}
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
): [
    (initialPointerPosition: Point) => void,
    React.RefObject<T>,
    boolean,
  ] => {
  const ref = React.useRef<T>(null);
  const relativePosition = React.useRef(new Point());
  const [resizing, setResizing] = React.useState(false);

  const onDrag = React.useCallback<NonNullable<UseDragPanelGripArgs["onDrag"]>>((pointerPosition, lastPointerPosition) => {
    const newRelativePosition = Rectangle.create(ref.current!.getBoundingClientRect()).topLeft().getOffsetTo(pointerPosition);

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

  const handleDragStart = useDragPanelGrip({
    side,
    onDrag,
    onDragEnd,
  });

  const handlePointerDown = React.useCallback((initialPointerPosition: Point) => {
    relativePosition.current = Rectangle.create(ref.current!.getBoundingClientRect()).topLeft().getOffsetTo(initialPointerPosition);
    setResizing(true);
    handleDragStart({
      initialPointerPosition,
    });
  }, [handleDragStart]);

  return [handlePointerDown, ref, resizing];
};

/** @internal */
export function useDoubleClick(onDoubleClick?: () => void): [
  () => void
] {
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
  return [
    handleClick,
  ];
}
