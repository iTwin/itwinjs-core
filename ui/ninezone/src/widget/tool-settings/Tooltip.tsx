/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { withTimeout } from "@bentley/ui-core";
import Tooltip, { TooltipProps } from "../../popup/tooltip/Tooltip";
import "./Tooltip.scss";

// tslint:disable-next-line:variable-name
const TooltipWithTimeout = withTimeout(Tooltip);

/**
 * Properties of [[ToolSettingsTooltip]] component.
 * @note Component defaults [[ToolSettingsTooltipProps]]
 */
export interface ToolSettingsTooltipProps extends TooltipProps {
  /** Tool settings icon. */
  children?: React.ReactNode;
  /** Tooltip content. */
  stepString?: string;
  /** Timeout (in ms) after which the tooltip is hidden. */
  timeout?: number;
  /** Function called when the timeout expires. */
  onTimeout?: () => void;
}

/** Defaults of [[ToolSettingsTooltipProps]]. */
export interface ToolSettingsTooltipDefaultProps extends ToolSettingsTooltipProps {
  /** Defaults to 5000. */
  timeout: number;
}

/** Tool settings tooltip. Displays the step string and is hidden after certain timeout. */
export default class ToolSettingsTooltip extends React.Component<ToolSettingsTooltipProps> {
  public static readonly defaultProps: ToolSettingsTooltipDefaultProps = {
    timeout: 5000,
  };

  public isWithDefaultProps(): this is { props: ToolSettingsTooltipDefaultProps } {
    if (this.props.timeout === undefined)
      return false;
    return true;
  }

  public render() {
    if (!this.isWithDefaultProps())
      return;

    const { className, children, stepString, timeout, onTimeout, ...props } = this.props;
    const tooltipClassName = classnames(
      "nz-widget-toolSettings-tooltip",
      className);

    return (
      <TooltipWithTimeout
        className={tooltipClassName}
        timeout={this.props.timeout}
        onTimeout={this._handleTimeout}
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
      </TooltipWithTimeout>
    );
  }

  private _handleTimeout = () => {
    this.props.onTimeout && this.props.onTimeout();
  }
}
