/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Message.scss";

export interface MessageProps extends CommonProps, NoChildrenProps {
  icon?: React.ReactNode;
  content?: React.ReactNode;
}

// tslint:disable-next-line:variable-name
export const Message: React.StatelessComponent<MessageProps> = (props) => {
  const className = classnames(
    "nz-footer-messageCenter-message",
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.icon &&
        <div>
          {props.icon}
        </div>
      }
      {props.content &&
        <div>
          {props.content}
        </div>
      }
    </div>
  );
};

export default Message;
