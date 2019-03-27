/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

/** Properties of [[ToolAssistanceIndicator]] component. */
export interface ToolAssistanceIndicatorProps extends CommonProps, NoChildrenProps {
  /** Dialog that is opened when indicator is clicked. See [[ToolAssistanceDialog]] */
  dialog?: React.ReactNode;
  /** Indicator icons. */
  icons?: React.ReactNode;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
  /** Step string. */
  stepString?: string;
}

/** One of [[Footer]] indicators. */
export class ToolAssistanceIndicator extends React.PureComponent<ToolAssistanceIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-indicator",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-indicator"
          onClick={this.props.onClick}
        >
          <div className="nz-icons">
            {this.props.icons}
          </div>
          {this.props.stepString !== undefined &&
            <span className="nz-step-string">{this.props.stepString}</span>
          }
          <div className="nz-triangle" />
        </div>
        {this.props.dialog}
      </div>
    );
  }
}
