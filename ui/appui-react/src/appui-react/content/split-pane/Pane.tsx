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
export interface PaneProps {
  className?: string;
  size?: string | number;
  split?: "vertical" | "horizontal";
  style?: React.CSSProperties;
  eleRef: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
}

/**
 * @internal
 */
export function Pane(props: PaneProps) {
  const {
    children,
    className,
    split,
    style,
    size,
    eleRef,
  } = props;

  const paneClasses = React.useMemo(() => classnames("Pane", split, className), [split, className]);

  const paneStyle = React.useMemo(() => {
    const baseStyle: Partial<React.CSSProperties> = {
      flex: 1,
      position: "relative",
      outline: "none",
    };

    if (size !== undefined) {
      if (split === "vertical") {
        baseStyle.width = size;
      } else {
        baseStyle.height = size;
        baseStyle.display = "flex";
      }
      baseStyle.flex = "none";
    }

    return {
      ...style,
      ...baseStyle,
    } as React.CSSProperties;
  }, [size, split, style]);

  return (
    <div ref={eleRef} className={paneClasses} style={paneStyle}>
      {children}
    </div>
  );
}

