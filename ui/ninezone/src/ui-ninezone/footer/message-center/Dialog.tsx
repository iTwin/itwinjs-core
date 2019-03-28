/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import { Direction } from "../../utilities/Direction";
import { TrianglePopover } from "../../popup/popover/Triangle";
import { TitleBar } from "../message/content/dialog/TitleBar";
import { Dialog } from "../message/content/dialog/Dialog";
import { DialogTitle } from "../message/content/dialog/Title";
export { DialogButton as MessageCenterButton } from "../message/content/dialog/Button";
import { MessageCenterContent } from "./Content";
import "./Dialog.scss";

/** Properties of [[MessageCenterDialogContent]] component. */
export interface MessageCenterDialogContentProps extends CommonProps, NoChildrenProps {
  /** Title bar buttons. I.e.: [[DialogButton]] */
  buttons?: React.ReactNode;
  /** Messages of message center. I.e. [[MessageCenterMessage]] */
  messages?: React.ReactNode;
  /* Optional prompt when no messages are present */
  prompt?: string;
  /** Tabs of message center. See [[MessageCenterTab]] */
  tabs?: React.ReactNode;
  /** Title of title bar. */
  title?: string;
}

/** Message center dialog used in [[MessageCenterIndicator]] component. */
export class MessageCenterDialogContent extends React.PureComponent<MessageCenterDialogContentProps> {
  public render() {
    return (
      <Dialog
        titleBar={
          <TitleBar
            title={
              <DialogTitle text={this.props.title} />
            }
            buttons={this.props.buttons}
          />
        }
        content={
          <MessageCenterContent
            tabs={this.props.tabs}
            messages={this.props.messages}
            prompt={this.props.prompt}
          />
        }
      />
    );
  }
}

/** Properties of [[MessageCenterDialog]] component. */
export interface MessageCenterDialogProps extends CommonProps, NoChildrenProps {
  /** Dialog content. See [[MessageCenterDialogContent]] */
  content?: React.ReactNode;
}

/** Message center dialog used in [[MessageCenterIndicator]] component. */
export class MessageCenterDialog extends React.PureComponent<MessageCenterDialogProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-messageCenter-dialog",
      this.props.className);

    return (
      <TrianglePopover
        className={dialogClassName}
        content={this.props.content}
        direction={Direction.Top}
        style={this.props.style}
      />
    );
  }
}
