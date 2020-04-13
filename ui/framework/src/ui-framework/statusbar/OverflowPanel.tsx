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
import "./OverflowPanel.scss";

/** Properties of [[StatusBarOverflowPanel]] component.
 * @internal
 */
export interface StatusBarOverflowPanelProps extends CommonProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Displays overflown tool settings.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const StatusBarOverflowPanel = React.forwardRef<HTMLDivElement, StatusBarOverflowPanelProps>((props, ref) => {
  const className = classnames(
    "uifw-statusbar-panel",
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
