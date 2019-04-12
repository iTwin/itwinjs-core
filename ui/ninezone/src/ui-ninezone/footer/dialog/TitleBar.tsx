/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./TitleBar.scss";

/** Properties of [[TitleBar]] component.
 * @beta
 */
export interface TitleBarProps extends CommonProps {
  /** Title bar buttons. I.e. [[TitleBarButton]] */
  children?: React.ReactNode;
  /** Title bar title. */
  title?: string;
}

/** Title bar of [[Dialog]] component.
 * @beta
 */
export class TitleBar extends React.PureComponent<TitleBarProps> {
  public render() {
    const className = classnames(
      "nz-footer-dialog-titleBar",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <span className="nz-title">
          {this.props.title}
        </span>
        {this.props.children}
      </div>
    );
  }
}
