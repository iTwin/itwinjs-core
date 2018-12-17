/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Tab.scss";

/** Properties of [[MessageCenterTab]] component. */
export interface MessageCenterTabProps extends CommonProps {
  /** Tab content. */
  children?: React.ReactNode;
  /** Describes if the tab is open. */
  isOpen?: boolean;
  /** Function called when the tab is clicked. */
  onClick?: () => void;
}

/** Message center tab used in [[MessageCenter]] component. */
export class MessageCenterTab extends React.PureComponent<MessageCenterTabProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-tab",
      this.props.isOpen && "nz-is-open",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
      >
        {this.props.children}
      </div>
    );
  }
}
