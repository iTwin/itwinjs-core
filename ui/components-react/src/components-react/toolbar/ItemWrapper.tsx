/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./ItemWrapper.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, useResizeObserver } from "@itwin/core-react";
import { useToolbarWithOverflowDirectionContext, useToolItemEntryContext } from "./ToolbarWithOverflow";
import { DirectionHelpers, OrthogonalDirectionHelpers } from "./utilities/Direction";

/** Properties of [[ItemWrapper]] component.
 * @internal future
 */
export interface ItemWrapperProps extends CommonProps {
  /** Tool setting content. */
  children?: React.ReactNode;
}

/** Used in a [[ItemWrapper]] component to display a setting.
 * @internal future
 */
export function ItemWrapper(props: ItemWrapperProps) {
  const { expandsTo, direction, overflowExpandsTo, overflowDirection } = useToolbarWithOverflowDirectionContext();
  const { hasOverflow, onResize, useHeight } = useToolItemEntryContext();
  const ref = useResizeObserverSingleDimension<HTMLDivElement>(onResize, useHeight);
  const className = classnames(
    "components-toolbar-item-container",
    hasOverflow && "components-overflown",
    OrthogonalDirectionHelpers.getCssClassName(hasOverflow ? overflowDirection : direction),
    DirectionHelpers.getCssClassName(hasOverflow ? overflowExpandsTo : expandsTo),
    props.className,
  );
  return (
    <div
      className={className}
      ref={ref}
      style={props.style}
    >
      {props.children}
    </div>
  );
}

/** @internal */
export function useResizeObserverSingleDimension<T extends Element>(onResize: (size: number) => void, useHeight: boolean) {
  const handleResize = React.useCallback((w: number, h: number) => {
    if (useHeight)
      return onResize(h);
    return onResize(w);
  }, [useHeight, onResize]);
  return useResizeObserver<T>(handleResize);
}
