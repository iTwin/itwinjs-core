/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Grip.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Point, Rectangle, Timer } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { useDragPanelGrip, UseDragPanelGripArgs } from "../base/DragManager";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
import { isHorizontalPanelSide, PanelStateContext, WidgetPanelContext } from "./Panel";
import { PointerCaptorArgs, usePointerCaptor } from "../base/PointerCaptor";

/** Resize grip of [[WidgetPanel]] component.
 * @internal
 */
export const WidgetPanelGrip = React.memo(function WidgetPanelGrip(props: CommonProps) {
  const panelState = React.useContext(PanelStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  assert(!!panelState);
  const { side } = panelState;
  const [ref, resizing, active] = useResizeGrip<HTMLDivElement>();
  const className = classnames(
    "nz-widgetPanels-grip",
    `nz-${side}`,
    active && "nz-active",
    resizing && "nz-resizing",
    props.className,
  );
  const resizeGripTitle = useLabel("resizeGripTitle");
  return (
    <div
      className={className}
      title={resizeGripTitle}
      style={props.style}
    >
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div
        className="nz-handle"
        ref={ref}
        onMouseOverCapture={() => {
          panelState.collapsed && !panelState.pinned && !resizing && dispatch({
            side,
            collapsed: false,
            type: "PANEL_SET_COLLAPSED",
          });
        }}
      />
    </div>
  );
});

/** @internal */
export const useResizeGrip = <T extends HTMLElement>(): [(instance: T | null) => void, boolean, boolean] => {
  const widgetPanel = React.useContext(WidgetPanelContext);
  const panelState = React.useContext(PanelStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  assert(!!widgetPanel);
  assert(!!panelState);
  const [resizing, setResizing] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const initialPointerPosition = React.useRef<Point>();
  const dragStartTimer = React.useRef(new Timer(300));
  const ref = React.useRef<T | null>(null);
  const relativePosition = React.useRef(new Point());
  const panelStateRef = React.useRef(panelState);
  panelStateRef.current = panelState;
  const { side } = panelState;
  const handleDoubleClick = React.useCallback(() => {
    dispatch({
      type: "PANEL_TOGGLE_COLLAPSED",
      side,
    });
  }, [dispatch, side]);
  const handleClick = useDoubleClick(handleDoubleClick);
  const onDrag = React.useCallback<NonNullable<UseDragPanelGripArgs["onDrag"]>>((pointerPosition, lastPointerPosition) => {
    if (!ref.current)
      return;
    const direction = side === "left" || side === "top" ? 1 : -1;
    const dragOffset = lastPointerPosition.getOffsetTo(pointerPosition);
    const dragBy = isHorizontalPanelSide(side) ? dragOffset.y : dragOffset.x;
    const resizeBy = direction * dragBy;

    const bounds = widgetPanel.getBounds();
    const outerEdge = bounds[side];
    const innerEdge = isHorizontalPanelSide(side) ? pointerPosition.y : pointerPosition.x;
    const size = (innerEdge - outerEdge) * direction;

    const panel = panelStateRef.current;
    if (resizeBy === 0)
      return;
    if (panel.collapsed) {
      if (size >= panel.collapseOffset) {
        dispatch({
          type: "PANEL_SET_COLLAPSED",
          side,
          collapsed: false,
        });
        return;
      }
      return;
    }

    if (panel.size === undefined)
      return;

    // New size should match drag direction (i.e. dragging `left` panel grip to the left should not increase left panel size).
    const sizeDiff = size - panel.size;
    if (sizeDiff * resizeBy < 0)
      return;
    const collapseThreshold = Math.max(panel.minSize - panel.collapseOffset, 0);
    if (size <= collapseThreshold) {
      dispatch({
        type: "PANEL_SET_COLLAPSED",
        side,
        collapsed: true,
      });
      dispatch({
        type: "PANEL_SET_SIZE",
        side,
        size: panel.minSize,
      });
      return;
    }

    const newSize = Math.min(Math.max(size, panel.minSize), panel.maxSize);
    dispatch({
      type: "PANEL_SET_SIZE",
      side,
      size: newSize,
    });
  }, [dispatch, side, widgetPanel]);
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
  }, [handlePointerCaptorRef]); // eslint-disable-line react-hooks/exhaustive-deps
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
