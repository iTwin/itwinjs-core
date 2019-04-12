/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Hyperlink.scss";

/** Properties of [[MessageHyperlink]] component.
 * @beta
 */
export interface MessageHyperlinkProps extends CommonProps {
  /** Hyperlink text. */
  children?: string;
  /** Function called when hyperlink is clicked. */
  onClick?: () => void;
}

/** Hyperlink component used in [[Message]] component.
 * @beta
 */
export class MessageHyperlink extends React.PureComponent<MessageHyperlinkProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-hyperlink",
      this.props.className);

    return (
      <div
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
