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

/** @internal */
export function ConditionalAutoSizer(props: ConditionalAutoSizerProps): React.ReactElement {
  const { width, height, onResize, children } = props;

  React.useLayoutEffect(
    () => {
      if (width !== undefined && height !== undefined) {
        onResize?.({ width, height });
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
