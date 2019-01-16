/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Footer */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../utilities/Props";
import "./StatusBarText.scss";

/** Properties of StatusBarText component.  */
export interface StatusBarTextProps extends CommonProps, NoChildrenProps {
  /** Optional icon */
  icon?: React.ReactNode;
  /** Describes if the snap row is active. */
  isInFooterMode?: boolean;
  /** Label of snap row. */
  label?: string;
}

/** Generic Text that can be used in StatusBar component. */
export class StatusBarText extends React.PureComponent<StatusBarTextProps> {
  public render() {
    const combinedClassName = classnames(
      "nz-footer-text",
      this.props.isInFooterMode && "nz-is-in-footer-mode",
      this.props.className);

    return (
      <div
        className={combinedClassName}
        style={this.props.style}
      >
        {this.props.icon}
        {this.props.label}
      </div>
    );
  }
}
