/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../utilities/Props";
import "./Footer.scss";

/** Properties of [[Footer]] component. */
export interface FooterProps extends CommonProps, NoChildrenProps {
  /**
   * Status indicators.
   * I.e: [[ToolAssistanceIndicator]], [[SnapModeIndicator]], [[MessageCenterIndicator]]
   */
  indicators?: React.ReactNode;
  /** Specifies if the footer is in widget mode.  */
  isInWidgetMode?: boolean;
  /** One of footer messages: [[Toast]], [[Temporary]], [[Sticky]], [[Modal]], [[Activity]] */
  message?: React.ReactNode;
}

/** Footer component. Should be used in [[FooterZone]] */
// tslint:disable-next-line:variable-name
export class Footer extends React.PureComponent<FooterProps> {
  public render() {
    const className = classnames(
      "nz-footer-footer",
      this.props.isInWidgetMode && "nz-widget-mode",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-message">
          {this.props.message}
        </div>
        <div className="nz-indicators">
          {this.props.indicators}
        </div>
      </div>
    );
  }
}
