/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList, VariableSizeListProps } from "react-window";
import { Observable } from "rxjs/internal/Observable";
import { ReplaySubject } from "rxjs/internal/ReplaySubject";
import { assert } from "@bentley/bentleyjs-core";

/** @internal */
export type VirtualizedListAttributes = Pick<VariableSizeList, "resetAfterIndex" | "scrollToItem">;

/** @internal */
export interface VirtualizedListProps extends Omit<VariableSizeListProps, "width" | "height"> {
  onTreeSizeChanged: (width: number) => void;
}

/** @internal */
// eslint-disable-next-line react/display-name
export const VirtualizedList = React.forwardRef<VirtualizedListAttributes, VirtualizedListProps>((props, ref) => {
  const innerListRef = React.useRef<VariableSizeList>(null);
  const subjectScrollToItemRef = React.useRef(new ReplaySubject<Parameters<VariableSizeList["scrollToItem"]>>(1));
  React.useImperativeHandle(
    ref,
    () => ({
      resetAfterIndex: (index: number, shouldForeUpdate?: boolean) => {
        innerListRef.current?.resetAfterIndex(index, shouldForeUpdate);
      },
      scrollToItem: (index, alignment) => {
        subjectScrollToItemRef.current.next([index, alignment]);
      },
    }),
    [],
  );

  return (
    <AutoSizer>
      {({ width, height }) => {
        props.onTreeSizeChanged(width);
        return (
          <VirtualizedListInner
            ref={innerListRef}
            observableScrollToItem={subjectScrollToItemRef.current}
            width={width}
            height={height}
            {...props}
          />
        );
      }}
    </AutoSizer>
  );
});

type VirtualizedListInnerAttributes = Pick<VariableSizeList, "resetAfterIndex">;

interface VirtualizedListInnerProps extends VariableSizeListProps {
  observableScrollToItem: Observable<Parameters<VariableSizeList["scrollToItem"]>>;
}

// eslint-disable-next-line react/display-name
const VirtualizedListInner = React.forwardRef<VirtualizedListInnerAttributes, VirtualizedListInnerProps>(
  (props, ref) => {
    const variableSizeListRef = React.useRef<VariableSizeList>(null);
    React.useEffect(
      () => {
        const subscription = props.observableScrollToItem.subscribe((args) => {
          assert(variableSizeListRef.current !== null);
          variableSizeListRef.current.scrollToItem(...args);
        });
        return () => subscription.unsubscribe();
      },
      [props.observableScrollToItem],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        resetAfterIndex: (index: number, shouldForeUpdate?: boolean) => {
          assert(variableSizeListRef.current !== null);
          variableSizeListRef.current.resetAfterIndex(index, shouldForeUpdate);
        },
      }),
      [],
    );

    return <VariableSizeList ref={variableSizeListRef} {...props} />;
  },
);
