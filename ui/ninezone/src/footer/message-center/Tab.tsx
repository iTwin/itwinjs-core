/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
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
// tslint:disable-next-line:variable-name
export const MessageCenterTab: React.StatelessComponent<MessageCenterTabProps> = (props) => {
  const className = classnames(
    "nz-footer-messageCenter-tab",
    props.isOpen && "nz-is-open",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
};

export default MessageCenterTab;
