/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import Direction from "../../utilities/Direction";
import Popover from "../../popup/popover/Triangle";
import Dialog from "../message/content/dialog/Dialog";
import TitleBar from "../message/content/dialog/TitleBar";
import Title from "../message/content/dialog/Title";
import Content from "./Content";

import "./MessageCenter.scss";

export { DialogButton as MessageCenterButton } from "../message/content/dialog/Button";

export interface MessageCenterProps extends CommonProps, NoChildrenProps {
  title?: string;
  buttons?: React.ReactNode;
  tabs?: React.ReactNode;
  messages?: React.ReactNode;
  isOpen?: boolean;
}

// tslint:disable-next-line:variable-name
export const MessageCenter: React.StatelessComponent<MessageCenterProps> = (props) => {
  const dialogClassName = classnames(
    "nz-footer-messageCenter-messageCenter",
    props.className);

  return (
    <Popover
      className={dialogClassName}
      style={props.style}
      isOpen={props.isOpen}
      direction={Direction.Top}
      content={
        <Dialog
          titleBar={
            <TitleBar
              title={
                <Title>
                  {props.title}
                </Title>
              }
              buttons={props.buttons}
            />
          }
          content={
            <Content
              tabs={props.tabs}
              messages={props.messages}
            />
          }
        />
      }
    />
  );
};

export default MessageCenter;
