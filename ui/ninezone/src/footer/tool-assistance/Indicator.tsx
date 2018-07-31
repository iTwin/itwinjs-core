/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

export interface ToolAssistanceIndicatorProps extends CommonProps, NoChildrenProps {
  dialog?: React.ReactNode;
  icons?: React.ReactNode;
  isStepStringVisible?: boolean;
  onIndicatorClick?: () => void;
  stepString?: string;
}

export default class ToolAssistanceIndicator extends React.Component<ToolAssistanceIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-indicator",
      this.props.className);

    const stepStringClassName = classnames(
      "nz-step-string",
      this.props.isStepStringVisible && "nz-is-visible",
    );

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-indicator"
          onClick={this.handleOnIndicatorClick}
        >
          <div className="nz-icons">
            {this.props.icons}
          </div>
          <span className={stepStringClassName}>{this.props.stepString}</span>
          <div className="nz-triangle" />
        </div>
        {this.props.dialog}
      </div>
    );
  }

  private handleOnIndicatorClick = () => {
    this.props.onIndicatorClick && this.props.onIndicatorClick();
  }
}
