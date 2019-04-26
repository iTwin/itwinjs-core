/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Footer.scss";

/** Properties of [[Footer]] component.
 * @beta
 */
export interface FooterProps extends CommonProps {
  /**
   * Footer indicators and separators. I.e: [[FooterSeparator]], [[FooterIndicator]],
   * [[MessageCenter]], [[ToolAssistance]], [[SnapMode]]
   */
  children?: React.ReactNode;
  /** Describes whether the footer is in footer or widget mode.  */
  isInFooterMode?: boolean;
  /** Footer messages. I.e. [[Message]], [[Toast]] */
  messages?: React.ReactNode;
}

/** Footer component. Used in [[StatusZone]] component.
 * @beta
 */
export class Footer extends React.PureComponent<FooterProps> {
  public render() {
    const className = classnames(
      "nz-footer-footer",
      this.props.isInFooterMode && "nz-footer-mode",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div>
          <div className="nz-messages">
            {this.props.messages}
          </div>
          <div className="nz-indicators">
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
}
