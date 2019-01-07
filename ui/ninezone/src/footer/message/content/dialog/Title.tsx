/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../../utilities/Props";
import "./Title.scss";

/** Properties of [[DialogTitle]] component. */
export interface DialogTitleProps extends CommonProps, NoChildrenProps {
  /** Actual title. */
  text?: string;
}

/** Title used in [[TitleBar]] component. */
export class DialogTitle extends React.PureComponent<DialogTitleProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-title",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.text}
      </div>
    );
  }
}
