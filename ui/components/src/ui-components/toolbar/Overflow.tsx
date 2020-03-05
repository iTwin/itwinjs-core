/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps, useResizeObserver } from "@bentley/ui-core";
import { useToolItemEntryContext } from "./Toolbar";

import "./Overflow.scss";

/** Properties of [[ToolbarOverflowButton]] component.
 * @internal
 */

export interface ToolbarOverflowButtonProps extends CommonProps, NoChildrenProps {
  /** Function called when button is clicked. */
  onClick?: () => void;
  /** Panel element containing the overflown buttons */
  panelNode?: React.ReactNode;
  /** Title for the item. */
  title?: string;
}

/** Button to toggle display of overflown tools.
 * @internal
 */
export function ToolbarOverflowButton(props: ToolbarOverflowButtonProps) {
  const { onResize, useHeight } = useToolItemEntryContext();
  const ref = useResizeObserver<HTMLButtonElement>(onResize, useHeight);
  const className = classnames(
    "components-toolbar-item-container",
    "components-toolbar-overflow-button",
    props.className,
  );
  const buttonClassName = classnames(
    "components-toolbar-button-item",
    "components-ellipsis-icon",
  );
  return (
    <div className={className}>
      <button
        ref={ref}
        onClick={props.onClick}
        className={buttonClassName}
        style={props.style}
        title={props.title}
      >
        <div className="components-icon">
          <div className="components-ellipsis" />
        </div>
      </button>
      {props.panelNode}
    </div>
  );
}
