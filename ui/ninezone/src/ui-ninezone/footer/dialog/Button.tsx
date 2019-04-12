/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Button.scss";

/** Properties of [[TitleBarButton]] component.
 * @beta
 */
export interface TitleBarButtonProps extends CommonProps {
  /** Button content. */
  children?: React.ReactNode;
  /** Function called when button is clicked. */
  onClick?: () => void;
  /** Button title. */
  title?: string;
}

/** Button used in [[TitleBar]] component.
 * @beta
 */
export class TitleBarButton extends React.PureComponent<TitleBarButtonProps> {
  public render() {
    const className = classnames(
      "nz-footer-dialog-button",
      this.props.className);

    return (
      <div
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
        title={this.props.title}
      >
        {this.props.children}
      </div>
    );
  }
}
