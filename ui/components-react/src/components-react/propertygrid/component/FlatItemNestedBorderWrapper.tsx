/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import classnames from "classnames";
import * as React from "react";

/** @internal */
export interface NestedBorderWrapperProps {
  className?: string;
  /** Number of bottom borders to draw (no more than side borders) */
  bottomBorderCount: number;
  /** Number of side borders to draw */
  borderCount: number;
  /** Node to wrap around */
  children: React.ReactNode;
}

/**
 * FlatItemNestedBorderWrapper React component.
 * Wraps provided ReactNode in nested borders recursively according to provided borderCount.
 * @internal
 */
export function FlatItemNestedBorderWrapper(props: NestedBorderWrapperProps) {
  if (props.borderCount <= 0) {
    return (
      <div className={props.className}>
        {props.children}
      </div>
    );
  }

  const isBottomBorderNeeded = props.bottomBorderCount >= 0 && props.bottomBorderCount >= props.borderCount;
  const classNames: string = classnames(
    "nested-border-middle",
    isBottomBorderNeeded ? "nested-border-bottom" : undefined,
  );

  let currentBottomBorderCount = props.bottomBorderCount;
  if (isBottomBorderNeeded)
    currentBottomBorderCount--;

  return (
    <div className={classNames}>
      <FlatItemNestedBorderWrapper className={props.className} borderCount={props.borderCount - 1} bottomBorderCount={currentBottomBorderCount}>
        {props.children}
      </FlatItemNestedBorderWrapper>
    </div>
  );
}
