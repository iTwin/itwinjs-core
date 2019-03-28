/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../../utilities/Props";
import "./Hyperlink.scss";

/** Properties of [[Hyperlink]] component. */
export interface HyperlinkProps extends CommonProps, NoChildrenProps {
  /** Hyperlink text. */
  text?: string;
  /** Function called when hyperlink is clicked. */
  onClick?: () => void;
}

/** Hyperlink component used in status message. I.e. [[MessageLayout]] */
export class Hyperlink extends React.PureComponent<HyperlinkProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-hyperlink",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
      >
        {this.props.text}
      </div>
    );
  }
}
