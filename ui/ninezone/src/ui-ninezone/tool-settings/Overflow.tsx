/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as classnames from "classnames";
import * as React from "react";
import { ToolSettingProps } from "./Setting";
import { Ellipsis } from "../base/Ellipsis";
import { useResizeObserver } from "../base/useResizeObserver";
import { useToolSettingsEntry } from "./Docked";
import "./Overflow.scss";

/** Properties of [[ToolSettingsOverflow]] component.
 * @internal
 */
export interface DockedToolSettingsOverflowProps extends ToolSettingProps {
  /** Function called when button is clicked. */
  onClick?: () => void;
}

/** Entry point to overflown tool settings of [[DockedToolSettings]] component.
 * @internal
 */
export function DockedToolSettingsOverflow(props: DockedToolSettingsOverflowProps) {
  const { onResize } = useToolSettingsEntry();
  const ref = useResizeObserver<HTMLDivElement>(onResize);
  const className = classnames(
    "nz-toolSettings-overflow",
    props.className,
  );
  return (
    <div
      className={className}
      onClick={props.onClick}
      ref={ref}
      style={props.style}
    >
      <Ellipsis />
    </div>
  );
}
