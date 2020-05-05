/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementSeparator
 */

import "./ElementSeparator.scss";
import * as React from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"; // tslint:disable-line: no-duplicate-imports
import classnames from "classnames";
import { Orientation } from "../enums/Orientation";
import { CommonProps } from "../utils/Props";

/**
 * Results returned by onRatioChanged callback for determining new ratio and whether the ratio was updated.
 * @public
 */
export interface RatioChangeResult {
  ratio: number;
}

/** Properties of [[ElementSeparator]] React component
 * @public
 */
export interface ElementSeparatorProps extends CommonProps {
  /** Separator orientation */
  orientation: Orientation;
  /** Ratio between left cell and right cell */
  ratio: number;
  /** Area width or height (depending on orientation) in pixels */
  movableArea?: number;
  /** Separator width or height in pixels. 30 by default */
  separatorSize?: number;
  /** Callback to ratio changed event */
  onRatioChanged?: (ratio: number) => void | RatioChangeResult;
  /** Is resize handle hovered */
  isResizeHandleHovered?: boolean;
  /** Callback to hover event change */
  onResizeHandleHoverChanged?: (isHovered: boolean) => void;
  /** Is resize handle being dragged */
  isResizeHandleBeingDragged?: boolean;
  /** Callback to drag event change */
  onResizeHandleDragChanged?: (isDragStarted: boolean) => void;
}

function getCurrentGlobalPosition(orientation: Orientation, e: PointerEvent | React.PointerEvent) {
  return orientation === Orientation.Horizontal ? e.clientX : e.clientY;
}

const useElementSeparatorPointerHandler = ({
  onResizeHandleDragChanged,
  onResizeHandleHoverChanged,
  isResizeHandleBeingDragged,
  isResizeHandleHovered,
  movableArea,
  ratio,
  orientation,
  // tslint:disable-next-line: deprecation
  onRatioChanged,
}: ElementSeparatorProps) => {
  const updateThreshold = 3;
  const globalPosition = useRef(0);
  const pointerOutOfBounds = useRef(false);

  const [isElementDragged, setIsDragged] = useState(false);
  const [isElementHovered, setIsHovered] = useState(false);
  const isGroupDragged = isResizeHandleBeingDragged ?? isElementDragged;
  const isGroupHovered = isResizeHandleHovered ?? isElementHovered;

  if (isGroupHovered && pointerOutOfBounds.current)
    pointerOutOfBounds.current = false;

  const stopDrag = useCallback(() => {
    if (isGroupDragged) {
      setIsDragged(false);
      if (onResizeHandleDragChanged)
        onResizeHandleDragChanged(false);
    }
  }, [isGroupDragged, onResizeHandleDragChanged]);

  const startDrag = useCallback((e: PointerEvent | React.PointerEvent) => {
    globalPosition.current = getCurrentGlobalPosition(orientation, e);

    if (!isGroupDragged) {
      setIsDragged(true);
      if (onResizeHandleDragChanged)
        onResizeHandleDragChanged(true);
    }
  }, [isGroupDragged, orientation, onResizeHandleDragChanged]);

  const onPointerUp = useCallback(() => {
    stopDrag();
  }, [stopDrag]);

  const onPointerMove = useCallback((e: PointerEvent | React.PointerEvent) => {
    if (!movableArea) {
      stopDrag();
      return;
    }

    const currentPosition = getCurrentGlobalPosition(orientation, e);
    const positionChange = currentPosition - globalPosition.current;

    // Limit update count
    if (Math.abs(positionChange) < updateThreshold)
      return;

    const currentLocalPosition = movableArea * ratio + positionChange;
    const newRatio = currentLocalPosition / movableArea;

    globalPosition.current = currentPosition;
    if (pointerOutOfBounds.current || !onRatioChanged)
      return;

    const result = onRatioChanged(newRatio);
    if (result === undefined && !isElementHovered && !pointerOutOfBounds.current)
      pointerOutOfBounds.current = true;

  }, [stopDrag, isElementHovered, ratio, movableArea, onRatioChanged, orientation]);

  useLayoutEffect(() => {
    if (isElementDragged) {
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointermove", onPointerMove);
    }

    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, [isElementDragged, onPointerUp, onPointerMove]);

  const onPointerDown = useCallback((e: PointerEvent | React.PointerEvent) => {
    if (!isGroupDragged) {
      startDrag(e);
    } else {
      stopDrag();
    }
  }, [isGroupDragged, startDrag, stopDrag]);

  const onPointerOver = useCallback(() => {
    if (isGroupHovered)
      return;

    setIsHovered(true);
    if (onResizeHandleHoverChanged)
      onResizeHandleHoverChanged(true);

  }, [isGroupHovered, onResizeHandleHoverChanged]);

  const onPointerOut = useCallback(() => {
    if (!isGroupHovered)
      return;

    setIsHovered(false);
    if (onResizeHandleHoverChanged)
      onResizeHandleHoverChanged(false);

  }, [isGroupHovered, onResizeHandleHoverChanged]);

  return {
    isHovered: isGroupHovered,
    isDragged: isGroupDragged,
    onPointerDown,
    onPointerOver,
    onPointerOut,
  };
};

function getStyle(orientation: Orientation, separatorSize?: number): React.CSSProperties {
  separatorSize = separatorSize || 30;

  if (orientation === Orientation.Horizontal)
    return {
      width: separatorSize,
      margin: `0px ${-Math.floor(separatorSize / 2)}px`,
    };
  return {
    height: separatorSize,
    margin: `${-Math.floor(separatorSize / 2)}px 1px`,
  };
}

/** A movable button, which allows to change the ratio between left element and right element
 * @public
 */
// tslint:disable-next-line: variable-name
export const ElementSeparator = (props: ElementSeparatorProps) => {
  const [hasHoverHappened, setHasHoverHappened] = useState(false);
  const { isDragged, isHovered, onPointerDown, onPointerOver, onPointerOut } = useElementSeparatorPointerHandler(props);

  const isHoverNeeded = isHovered || isDragged;
  if (!hasHoverHappened && isHoverNeeded)
    setHasHoverHappened(isHoverNeeded);

  // This is done to avoid fade-out animation when first rendering.
  const unhoverClass = hasHoverHappened ? "core-element-separator-group-unhovered" : "";

  const classNames = classnames(
    "core-element-separator",
    (props.orientation === Orientation.Horizontal) ? "core-element-separator--horizontal" : "core-element-separator--vertical",
    props.className,
    isHoverNeeded ? "core-element-separator-group-hovered" : unhoverClass,
  );

  const orientation = props.orientation;
  const separatorSize = props.separatorSize;
  const style = useMemo(() => getStyle(orientation, separatorSize), [orientation, separatorSize]);
  const styles: React.CSSProperties = {
    ...style,
    ...props.style,
  };

  return (
    <button
      style={styles}
      className={classNames}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    />
  );
};
