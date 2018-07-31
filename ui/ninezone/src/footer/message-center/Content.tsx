/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Content.scss";

export interface MessageCenterContentProps extends CommonProps, NoChildrenProps {
  tabs?: React.ReactNode;
  messages?: React.ReactNode;
}

// tslint:disable-next-line:variable-name
export const MessageCenterContent: React.StatelessComponent<MessageCenterContentProps> = (props: MessageCenterContentProps) => {
  const className = classnames(
    "nz-footer-messageCenter-content",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-tabs">
        {props.tabs}
      </div>
      <div className="nz-messages">
        {props.messages}
      </div>
      <div className="nz-gradient" />
    </div>
  );
};

export default MessageCenterContent;
