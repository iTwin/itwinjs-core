/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import "./Tab.scss";

export interface MessageCenterTabProps extends CommonProps {
  isOpen?: boolean;
  onClick?: () => void;
}

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
      {props.isOpen && <div className="nz-bar" />}
    </div>
  );
};

export default MessageCenterTab;
