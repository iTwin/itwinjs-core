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

export interface ToolSettingsTooltipProps extends CommonProps {
  isVisible?: boolean;
  onIsVisibleChange?: (isVisible: boolean) => void;
  stepString?: string;
  timeout?: number;
}

export default class ToolSettingsTooltip extends React.Component<ToolSettingsTooltipProps> {
  private static readonly DEFAULT_TIMEOUT = 5000;

  public render() {
    const className = classnames(
      "nz-widget-toolSettings-tooltip",
      this.props.isVisible && "nz-is-visible",
      this.props.className);

    return (
      <PopupTooltip
        className={className}
        style={this.props.style}
      >
        <DivWithTimeout
          className="nz-tool-icon"
          startTimeout={this.props.isVisible}
          timeout={this.props.timeout || ToolSettingsTooltip.DEFAULT_TIMEOUT}
          onTimeout={this.handleTimeout}
        >
          {this.props.children}
        </DivWithTimeout>
        <div className="nz-step-string">
          {this.props.stepString}
        </div>
      </PopupTooltip>
    );
  }

  private handleTimeout = () => {
    this.setIsVisible(false);
  }

  private setIsVisible(isVisible: boolean) {
    if (this.props.isVisible === isVisible)
      return;

    this.props.onIsVisibleChange && this.props.onIsVisibleChange(isVisible);
  }
}
