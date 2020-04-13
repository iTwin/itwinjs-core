/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, useProximityToMouse } from "@bentley/ui-core";

import { OrthogonalDirectionHelpers, OrthogonalDirection } from "./utilities/Direction";
import { useToolbarWithOverflowDirectionContext } from "./Toolbar";
import "./Items.scss";

/** Properties of [[ToolbarItems]] component.
 * @internal
 */
export interface ToolbarItemsProps extends CommonProps {
  /** Toolbar items. */
  children?: React.ReactNode;
  /** Toolbar items direction. */
  direction: OrthogonalDirection;
}

/** Toolbar items container. Used in [[ToolbarWithOverflow]] component.
 * @internal
 */
export function ToolbarItems(props: ToolbarItemsProps) {
  const className = classnames(
    "components-toolbar-items-container",
    OrthogonalDirectionHelpers.getCssClassName(props.direction),
    props.className);

  const ref = React.useRef<HTMLDivElement>(null);
  const proximity = useProximityToMouse(ref);
  const { useProximityOpacity, openPopupCount, overflowDisplayActive } = useToolbarWithOverflowDirectionContext();
  let toolbarOpacity = 1.0;

  if (useProximityOpacity && openPopupCount < 1 && !overflowDisplayActive) {
    const threshold = 100;
    const scale = ((proximity < threshold) ? threshold - proximity : 0) / threshold;
    toolbarOpacity = (0.80 * scale) + 0.20;
  }
  const divStyle: React.CSSProperties = {
    backgroundColor: `rgba(var(--buic-background-3-rgb), ${toolbarOpacity})`,
    borderColor: `rgba(var(--buic-background-5-rgb), ${toolbarOpacity})`,
    ...props.style,
  };

  return (
    <div
      className={className}
      style={divStyle}
      ref={ref}
    >
      {props.children}
    </div>
  );
}
