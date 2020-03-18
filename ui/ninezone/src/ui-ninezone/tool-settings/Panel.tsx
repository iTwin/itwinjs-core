/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import classnames from "classnames";
import * as React from "react";
import { ToolSettingProps } from "./Setting";
import "./Panel.scss";

/** Properties of [[ToolSettingsOverflowPanel]] component.
 * @internal
 */
export interface ToolSettingsOverflowPanelProps extends ToolSettingProps {
  /** Panel content. */
  children?: React.ReactNode;
}

/** Displays overflown tool settings.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const ToolSettingsOverflowPanel = React.forwardRef<HTMLDivElement, ToolSettingsOverflowPanelProps>((props, ref) => {
  const className = classnames(
    "nz-toolSettings-panel",
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
