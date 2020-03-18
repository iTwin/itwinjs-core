/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MessageCenter
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Tab.scss";

/** Properties of [[MessageCenterTab]] component.
 * @beta
 */
export interface MessageCenterTabProps extends CommonProps {
  /** Tab content. */
  children?: React.ReactNode;
  /** Describes if the tab is active. */
  isActive?: boolean;
  /** Function called when the tab is clicked. */
  onClick?: () => void;
}

/** Message center tab used in [[MessageCenterDialog]] component.
 * @beta
 */
export class MessageCenterTab extends React.PureComponent<MessageCenterTabProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-tab",
      this.props.isActive && "nz-active",
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
