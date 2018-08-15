/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { Div, withTimeout } from "@bentley/ui-core";
import PopupTooltip from "../../popup/tooltip/Tooltip";
import CommonProps from "../../utilities/Props";
import "./Tooltip.scss";

// tslint:disable-next-line:variable-name
const DivWithTimeout = withTimeout(Div);

/**
 * Properties of [[ToolSettingsTooltip]] component.
 * @note Component defaults [[ToolSettingsTooltipProps]]
 */
export interface ToolSettingsTooltipProps extends CommonProps {
  /** Describes if the tooltip is visible. */
  isVisible?: boolean;
  /** Function called when visibility of tooltip changes. */
  onIsVisibleChange?: (isVisible: boolean) => void;
  /** Tooltip content. */
  stepString?: string;
  /** Timeout (in ms) after which the tooltip is hidden. */
  timeout?: number;
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
    const className = classnames(
      "nz-widget-toolSettings-tooltip",
      this.props.isVisible && "nz-is-visible",
      this.props.className);

    if (!this.isWithDefaultProps())
      return;

    return (
      <PopupTooltip
        className={className}
        style={this.props.style}
      >
        <DivWithTimeout
          className="nz-tool-icon"
          startTimeout={this.props.isVisible}
          timeout={this.props.timeout}
          onTimeout={this._handleTimeout}
        >
          {this.props.children}
        </DivWithTimeout>
        <div className="nz-step-string">
          {this.props.stepString}
        </div>
      </PopupTooltip>
    );
  }

  private _handleTimeout = () => {
    this.setIsVisible(false);
  }

  private setIsVisible(isVisible: boolean) {
    if (this.props.isVisible === isVisible)
      return;

    this.props.onIsVisibleChange && this.props.onIsVisibleChange(isVisible);
  }
}
