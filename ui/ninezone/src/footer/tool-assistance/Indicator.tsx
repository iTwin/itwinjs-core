/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

/** Properties of [[ToolAssistanceIndicator]] component. */
export interface ToolAssistanceIndicatorProps extends CommonProps, NoChildrenProps {
  /** Dialog that is opened when indicator is clicked. See [[ToolAssistanceDialog]] */
  dialog?: React.ReactNode;
  /** Indicator icons. */
  icons?: React.ReactNode;
  /** Describes if the step string is visible. */
  isStepStringVisible?: boolean;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
  /** Step string. */
  stepString?: string;
}

/** One of [[Footer]] indicators. */
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
          onClick={this._handleOnIndicatorClick}
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

  private _handleOnIndicatorClick = () => {
    this.props.onClick && this.props.onClick();
  }
}
