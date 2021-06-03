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
  React.useLayoutEffect(
    () => {
      if (props.width !== undefined && props.height !== undefined) {
        props.onResize?.({ width: props.width, height: props.height });
      }
    },
    [props.width, props.height, props.onResize],
  );

  if (props.width !== undefined && props.height !== undefined) {
    return <>{props.children({ width: props.width, height: props.height })}</>;
  }

  return (
    <AutoSizer
      disableWidth={props.width !== undefined}
      disableHeight={props.height !== undefined}
      defaultWidth={props.width}
      defaultHeight={props.height}
      onResize={props.onResize}
    >
      {props.children}
    </AutoSizer>
  );
}
