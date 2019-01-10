/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../../../utilities/Props";
import "./Content.scss";

/** Properties of [[DialogContent]] component. */
export interface DialogContentProps extends CommonProps, NoChildrenProps {
  /** Actual content. */
  content?: React.ReactNode;
}

/** Content of [[Dialog]] component. */
export class DialogContent extends React.PureComponent<DialogContentProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-content-content",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-content">
          {this.props.content}
        </div>
      </div>
    );
  }
}
