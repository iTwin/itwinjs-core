/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, Point, Rectangle } from "@bentley/ui-core";
import { usePointerCaptor } from "../base/PointerCaptor";
import { WidgetPanelSide, isHorizontalWidgetPanelSide } from "./Panel";
import { useRefs } from "../base/useRefs";
import "./Grip.scss";

/** Properties of [[WidgetPanelGrip]] component.
 * @internal
 */
export interface WidgetPanelGripProps extends CommonProps {
  collapsed?: boolean;
  onDoubleClick?: (side: WidgetPanelSide) => void;
  onResize?: (side: WidgetPanelSide, resizeBy: number) => void;
  onResizeEnd?: () => void;
  side: WidgetPanelSide;
}

/** Resize grip of used in side panel component.
 * @internal
 */
export function WidgetPanelGrip(props: WidgetPanelGripProps) {
  const { onDoubleClick, onResize, side } = props;
  const handleResize = React.useCallback((resizeBy: number) => {
    onResize && onResize(side, resizeBy);
  }, [onResize, side]);
  const handleDoubleClick = React.useCallback(() => {
    onDoubleClick && onDoubleClick(side);
  }, [onDoubleClick, side]);
  const [ref, resizing] = useResizeGrip<HTMLDivElement>(props.side, handleResize, props.onResizeEnd);
  const className = classnames(
    "nz-widgetPanels-grip",
    `nz-${props.side}`,
    props.collapsed && "nz-collapsed",
    resizing && "nz-resizing",
    props.className,
  );
  return (
    <div
      className={className}
      onDoubleClick={handleDoubleClick}
      ref={ref}
      style={props.style}
    >
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
      <div className="nz-dot" />
    </div>
  );
}

/** @internal */
export const useResizeGrip = <T extends HTMLElement>(
  side: WidgetPanelSide,
  onResize?: (resizeBy: number) => void,
  onResizeEnd?: () => void,
): [
    (instance: T | null) => void,
    boolean,
  ] => {
  const ref = React.useRef<T>(null);
  const lastPosition = React.useRef(new Point());
  const relativePosition = React.useRef(new Point());
  const [resizing, setResizing] = React.useState(false);
  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    lastPosition.current = new Point(e.clientX, e.clientY);
    relativePosition.current = Rectangle.create(ref.current!.getBoundingClientRect()).topLeft().getOffsetTo(lastPosition.current);
    setResizing(true);
  };

  const onPointerMove = (e: PointerEvent) => {
    const newPosition = new Point(e.clientX, e.clientY);
    const newRelativePosition = Rectangle.create(ref.current!.getBoundingClientRect()).topLeft().getOffsetTo(newPosition);

    const resizeOffset = relativePosition.current.getOffsetTo(newRelativePosition);
    const dragOffset = lastPosition.current.getOffsetTo(newPosition);

    const dragBy = isHorizontalWidgetPanelSide(side) ? dragOffset.y : dragOffset.x;
    const resizeBy = isHorizontalWidgetPanelSide(side) ? resizeOffset.y : resizeOffset.x;

    lastPosition.current = newPosition;
    const direction = side === "left" || side === "top" ? 1 : -1;
    dragBy * resizeBy > 0 && onResize && onResize(direction * resizeBy);
  };

  const onPointerUp = () => {
    onResizeEnd && onResizeEnd();
    setResizing(false);
  };

  const captorRef = usePointerCaptor<T>(onPointerDown, onPointerMove, onPointerUp);
  const refs = useRefs<T>(ref, captorRef);
  return [refs, resizing];
};
