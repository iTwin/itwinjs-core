/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";

import { OrthogonalDirectionHelpers, OrthogonalDirection } from "./utilities/Direction";
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

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
}
