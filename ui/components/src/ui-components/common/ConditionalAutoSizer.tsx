/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import AutoSizer, { Size } from "react-virtualized-auto-sizer";

/** @internal */
export interface ConditionalAutoSizerProps {
  width?: number;
  height?: number;
  onResize?: (newSize: Size) => void;
  children: (size: Size) => React.ReactNode;
}

/**
 * Supplies child element with parent element's content width and height. If width and height are specified in the
 * props, these dimensions are forwarded to child without too much overhead. Otherwise, `AutoSizer` from
 * `react-virtualized-auto-sizer` is employed to measure available space and mount the children when the dimensions
 * become known.
 *
 * This component is intended to aid towards `react-virtualized-auto-sizer` package removal, do not use this in new
 * components.
 * @internal
 */
export function ConditionalAutoSizer(props: ConditionalAutoSizerProps): React.ReactElement {
  const { width, height, onResize, children } = props;

  React.useLayoutEffect(
    () => {
      if (width !== undefined && height !== undefined && onResize !== undefined) {
        onResize({ width, height });
      }
    },
    [width, height, onResize],
  );

  if (width !== undefined && height !== undefined) {
    return <>{children({ width, height })}</>;
  }

  return (
    <AutoSizer
      disableWidth={width !== undefined}
      disableHeight={height !== undefined}
      defaultWidth={width}
      defaultHeight={height}
      onResize={onResize}
    >
      {children}
    </AutoSizer>
  );
}
