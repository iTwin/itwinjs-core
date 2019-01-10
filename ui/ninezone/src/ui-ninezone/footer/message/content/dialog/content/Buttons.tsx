/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../../../utilities/Props";
import "./Buttons.scss";

/** Properties of [[Buttons]] component. */
export interface ButtonsProps extends CommonProps, NoChildrenProps {
  /** Actual buttons. */
  buttons?: React.ReactNode;
  /** Actual content. I.e.: [[DialogContent]], [[ScrollableContent]] */
  content?: React.ReactNode;
}

/** Content with buttons. Used in [[Dialog]] component. */
export class Buttons extends React.PureComponent<ButtonsProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-content-buttons",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-content">
          {this.props.content}
        </div>
        <div className="nz-buttons">
          {this.props.buttons}
        </div>
      </div>
    );
  }
}
