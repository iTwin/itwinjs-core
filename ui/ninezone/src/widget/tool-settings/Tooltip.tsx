/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import Tooltip, { TooltipProps } from "../../popup/tooltip/Tooltip";
import "./Tooltip.scss";

/**
 * Properties of [[ToolSettingsTooltip]] component.
 * @note Component defaults [[ToolSettingsTooltipProps]]
 */
export interface ToolSettingsTooltipProps extends TooltipProps {
  /** Tool settings icon. */
  children?: React.ReactNode;
  /** Tooltip content. */
  stepString?: string;
}

/** Tool settings tooltip. Displays the step string and is hidden after certain timeout. */
export default class ToolSettingsTooltip extends React.Component<ToolSettingsTooltipProps> {
  public render() {
    const { className, children, stepString, ...props } = this.props;
    const tooltipClassName = classnames(
      "nz-widget-toolSettings-tooltip",
      className);

    return (
      <Tooltip
        className={tooltipClassName}
        {...props}
      >
        <div
          className="nz-tool-icon"
        >
          {this.props.children}
        </div>
        <div className="nz-step-string">
          {this.props.stepString}
        </div>
      </Tooltip>
    );
  }
}
