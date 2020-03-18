/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import classnames from "classnames";
import * as React from "react";
import { Point, Rectangle, Timer } from "@bentley/ui-core";
import { PanelSide, isHorizontalPanelSide, PanelStateContext } from "./Panel";
import { NineZoneDispatchContext } from "../base/NineZone";
import { PANEL_TOGGLE_COLLAPSED, PANEL_RESIZE } from "../base/NineZoneState";
import { assert } from "../base/assert";
import { useDragPanelGrip, UseDragPanelGripArgs } from "../base/DragManager";
import "./Grip.scss";

/** Resize grip of [[WidgetPanel]] component.
 * @internal
 */
export const WidgetPanelGrip = React.memo(function WidgetPanelGrip() { // tslint:disable-line: variable-name no-shadowed-variable
  const panel = React.useContext(PanelStateContext);
  assert(panel);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const { side } = panel;
  const initialPointerPosition = React.useRef<Point>();
  const handleResize = React.useCallback((resizeBy: number) => {
    dispatch({
      type: PANEL_RESIZE,
      side,
      resizeBy,
    });
  }, [dispatch, side]);
  const dragStartTimer = React.useRef(new Timer(300));
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: PANEL_TOGGLE_COLLAPSED,
      side,
    });
  }, [dispatch, side]);
  const [handleResizeStart, ref, resizing] = useResizeGrip<HTMLDivElement>(side, handleResize);
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    initialPointerPosition.current = new Point(e.clientX, e.clientY);
    dragStartTimer.current.start();
  }, []);
  const handlePointerUp = React.useCallback(() => {
    initialPointerPosition.current = undefined;
    dragStartTimer.current.stop();
  }, []);
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
    panel.collapsed && "nz-collapsed",
    resizing && "nz-resizing",
  );
  return (
    <div
      className={className}
      onDoubleClick={handleDoubleClick}
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
