/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, useResizeObserver } from "@bentley/ui-core";
import { useToolItemEntryContext, useToolbarWithOverflowDirectionContext } from "./Toolbar";
import { OrthogonalDirectionHelpers, DirectionHelpers } from "./utilities/Direction";
import "./ItemWrapper.scss";

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

  const ref = useResizeObserver<HTMLDivElement>(onResize, useHeight);
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
