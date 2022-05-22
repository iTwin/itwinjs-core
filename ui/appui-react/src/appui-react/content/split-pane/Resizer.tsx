/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */
import * as React from "react";
import classnames from "classnames";

/** Based on react-split-pane package. See https://github.com/tomkp/react-split-pane/blob/master/LICENSE */

/**
 * @internal
 */
export interface ResizerProps {
  split?: "vertical" | "horizontal";
  style?: React.CSSProperties;
  className: string;
  onMouseDown: (event: MouseEvent) => void;
  onTouchEnd: () => void;
  onTouchStart: (event: TouchEvent) => void;
  onClick?: (event: MouseEvent) => void;
  onDoubleClick?: (event: MouseEvent) => void;
}

/**
 * @internal
 */
export function Resizer(props: ResizerProps) {
  const {
    className,
    onClick,
    onDoubleClick,
    onMouseDown,
    onTouchEnd,
    onTouchStart,
    split,
    style,
  } = props;

  const resizerClasses = React.useMemo(() => classnames(split, className), [split, className]);

  return (
    <span
      role="presentation"
      className={resizerClasses}
      style={style}
      onMouseDown={(event) => onMouseDown(event.nativeEvent)}
      onTouchStart={(event) => {
        onTouchStart(event.nativeEvent);
      }}
      onTouchEnd={(event) => {
        event.preventDefault();
        onTouchEnd();
      }}
      onClick={(event) => {
        // istanbul ignore else
        if (onClick) {
          event.preventDefault();
          onClick(event.nativeEvent);
        }
      }}
      onDoubleClick={(event) => {
        // istanbul ignore else
        if (onDoubleClick) {
          event.preventDefault();
          onDoubleClick(event.nativeEvent);
        }
      }}
    />
  );
}
