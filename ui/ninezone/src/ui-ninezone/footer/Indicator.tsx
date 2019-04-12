/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Indicator.scss";

/** Properties of [[FooterIndicator]] component.
 * @beta
 */
export interface FooterIndicatorProps extends CommonProps {
  /** Indicator content. */
  children?: React.ReactNode;
  /** Describes whether the footer is in footer or widget mode. */
  isInFooterMode?: boolean;
}

/** Indicator used in [[Footer]] component.
 * @beta
 */
export class FooterIndicator extends React.PureComponent<FooterIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-indicator",
      this.props.isInFooterMode && "nz-footer-mode",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
