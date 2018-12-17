/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { withContainInViewport } from "../../base/WithContainInViewport";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import { Direction } from "../../utilities/Direction";
import { TrianglePopover } from "../../popup/popover/Triangle";
import { Dialog } from "../message/content/dialog/Dialog";
import { TitleBar } from "../message/content/dialog/TitleBar";
import { DialogTitle } from "../message/content/dialog/Title";
export { DialogButton as MessageCenterButton } from "../message/content/dialog/Button";
import { MessageCenterContent } from "./Content";
import "./MessageCenter.scss";

// tslint:disable-next-line:variable-name
const DialogWithContainIn = withContainInViewport(Dialog);

/** Properties of [[MessageCenter]] component. */
export interface MessageCenterProps extends CommonProps, NoChildrenProps {
  /** Title of title bar. */
  title?: string;
  /** Title bar buttons. I.e.: [[DialogButton]] */
  buttons?: React.ReactNode;
  /** Tabs of message center. See [[MessageCenterTab]] */
  tabs?: React.ReactNode;
  /** Messages of message center. I.e. [[Message]] */
  messages?: React.ReactNode;
  /* Optional prompt when no messages are present */
  prompt?: string;
}

/** Message center dialog used in [[MessageCenterIndicator]] component. */
export class MessageCenter extends React.PureComponent<MessageCenterProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-messageCenter-messageCenter",
      this.props.className);

    return (
      <TrianglePopover
        className={dialogClassName}
        style={this.props.style}
        direction={Direction.Top}
        content={
          <DialogWithContainIn
            noVerticalContainment
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
        }
      />
    );
  }
}
