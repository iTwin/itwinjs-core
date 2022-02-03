/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementSeparator
 */

import "./ElementSeparator.scss";
import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"; // eslint-disable-line no-duplicate-imports
import classnames from "classnames";
import { Orientation } from "../enums/Orientation";
import type { CommonProps } from "../utils/Props";
import { useThrottledFn } from "../utils/hooks/useThrottledFn";
import { UiCore } from "../UiCore";

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

const useConditionalCleanup = (condition: boolean, cleanup: () => void) => {
  const conditionRef = useRef(condition);
  const cleanupRef = useRef(cleanup);

  conditionRef.current = condition;
  cleanupRef.current = cleanup;

  useEffect(() => {
    return () => {
      if (conditionRef.current)
        cleanupRef.current();
    };
  }, []);
};

const useElementSeparatorPointerHandler = ({
  onResizeHandleDragChanged,
  onResizeHandleHoverChanged,
  isResizeHandleBeingDragged,
  isResizeHandleHovered,
  movableArea,
  ratio,
  orientation,
  onRatioChanged,
}: ElementSeparatorProps) => {
  const globalPosition = useRef(0);
  const pointerOutOfBounds = useRef(false);

  const [isElementDragged, setIsDragged] = useState(false);
  const [isElementHovered, setIsHovered] = useState(false);
  const isGroupDragged = isResizeHandleBeingDragged ?? isElementDragged;
  const isGroupHovered = isResizeHandleHovered ?? isElementHovered;

  useConditionalCleanup(isElementDragged && !!onResizeHandleDragChanged, () => onResizeHandleDragChanged!(false));
  useConditionalCleanup(isElementHovered && !!onResizeHandleHoverChanged, () => onResizeHandleHoverChanged!(false));

  if (isGroupHovered && pointerOutOfBounds.current)
    pointerOutOfBounds.current = false;

  const stopDrag = useCallback(() => {
    // istanbul ignore else
    if (isGroupDragged) {
      setIsDragged(false);
      if (onResizeHandleDragChanged)
        onResizeHandleDragChanged(false);
    }
  }, [isGroupDragged, onResizeHandleDragChanged]);

  const startDrag = useCallback((e: PointerEvent | React.PointerEvent) => {
    globalPosition.current = getCurrentGlobalPosition(orientation, e);

    // istanbul ignore else
    if (!isGroupDragged) {
      setIsDragged(true);
      if (onResizeHandleDragChanged)
        onResizeHandleDragChanged(true);
    }
  }, [isGroupDragged, orientation, onResizeHandleDragChanged]);

  const onPointerUp = useCallback(() => {
    stopDrag();
  }, [stopDrag]);

  const onThrottledPointerMove = useThrottledFn((e: PointerEvent | React.PointerEvent) => {
    if (!movableArea) {
      stopDrag();
      return;
    }

    const currentPosition = getCurrentGlobalPosition(orientation, e);
    const positionChange = currentPosition - globalPosition.current;

    // Should not need to recalculate if position on our movement axis does not change
    if (Math.abs(positionChange) < 1)
      return;

    const currentLocalPosition = movableArea * ratio + positionChange;
    const newRatio = currentLocalPosition / movableArea;

    globalPosition.current = currentPosition;
    if (pointerOutOfBounds.current || !onRatioChanged)
      return;

    const result = onRatioChanged(newRatio);
    if (result && result.ratio === ratio && !isGroupHovered && !pointerOutOfBounds.current)
      pointerOutOfBounds.current = true;
  }, 16, [stopDrag, isGroupHovered, ratio, movableArea, onRatioChanged, orientation]);

  useEffect(() => {
    return () => onThrottledPointerMove.cancel();
  }, [onThrottledPointerMove]);

  useLayoutEffect(() => {
    if (isElementDragged) {
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointermove", onThrottledPointerMove);
    }

    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointermove", onThrottledPointerMove);
    };
  }, [isElementDragged, onPointerUp, onThrottledPointerMove]);

  const onPointerDown = useCallback((e: PointerEvent | React.PointerEvent) => {
    if (!isGroupDragged) {
      startDrag(e);
    } else {
      stopDrag();
    }
  }, [isGroupDragged, startDrag, stopDrag]);

  const onPointerOver = useCallback(() => {
    // istanbul ignore next
    if (isGroupHovered)
      return;

    setIsHovered(true);
    if (onResizeHandleHoverChanged)
      onResizeHandleHoverChanged(true);

  }, [isGroupHovered, onResizeHandleHoverChanged]);

  const onPointerOut = useCallback(() => {
    // istanbul ignore next
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
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ElementSeparator = (props: ElementSeparatorProps) => {
  const label = useRef(UiCore.translate("elementSeparator.label"));
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
      aria-label={label.current}
    />
  );
};
