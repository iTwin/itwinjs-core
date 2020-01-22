/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useToolSettingsEntry } from "./Docked";
import { useResizeObserver } from "../base/useResizeObserver";
import "./Setting.scss";

/** Properties of [[ToolSetting]] component.
 * @internal future
 */
export interface ToolSettingProps extends CommonProps {
  /** Tool setting content. */
  children?: React.ReactNode;
}

/** Used in a [[DockedToolSettings]] component to display a setting.
 * @internal future
 */
export function DockedToolSetting(props: ToolSettingProps) {
  const { isOverflown, onResize } = useToolSettingsEntry();
  const ref = useResizeObserver<HTMLDivElement>(onResize);
  const className = classnames(
    "nz-toolSettings-setting",
    isOverflown && "nz-overflown",
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
