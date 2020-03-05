/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useToolbarWithOverflowDirectionContext } from "./Toolbar";
import { OrthogonalDirectionHelpers, DirectionHelpers } from "./utilities/Direction";
import "./OverflowPanel.scss";

/** Properties of [[ToolbarOverflowPanel]] component.
 * @internal
 */
export interface ToolbarOverflowPanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Displays overflown tool settings.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const ToolbarOverflowPanel = React.forwardRef<HTMLDivElement, ToolbarOverflowPanelProps>((props, ref) => {
  const { expandsTo, overflowExpandsTo, overflowDirection } = useToolbarWithOverflowDirectionContext();

  const className = classnames(
    "components-toolbar-overflow-panel",
    "components-toolbar-items-container",
    OrthogonalDirectionHelpers.getCssClassName(overflowDirection),
    `${OrthogonalDirectionHelpers.getCssClassName(overflowDirection)}-${DirectionHelpers.getCssClassName(expandsTo)}`,
    DirectionHelpers.getCssClassName(overflowExpandsTo),
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
});
