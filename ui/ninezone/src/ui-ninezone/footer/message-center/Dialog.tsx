/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { TitleBar } from "../dialog/TitleBar";
import { Dialog } from "../dialog/Dialog";
import "./Dialog.scss";

/** Properties of [[MessageCenterDialog]] component.
 * @beta
 */
export interface MessageCenterDialogProps extends CommonProps {
  /** Title bar buttons. I.e. [[TitleBarButton]] */
  buttons?: React.ReactNode;
  /** Messages of message center. I.e. [[MessageCenterMessage]] */
  children?: React.ReactNode;
  /* Prompt showed when no messages are present. */
  prompt?: string;
  /** Tabs of message center. See [[MessageCenterTab]] */
  tabs?: React.ReactNode;
  /** Title of title bar. */
  title?: string;
}

/** Message center dialog used with [[MessageCenter]] component.
 * @note This is a presentational component and should be aligned with [[MessageCenter]] component.
 * I.e. use [[FooterPopup]] to handle alignment.
 * @beta
 */
export class MessageCenterDialog extends React.PureComponent<MessageCenterDialogProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-dialog",
      this.props.className);
    return (
      <Dialog
        className={className}
        style={this.props.style}
        titleBar={
          <TitleBar
            title={this.props.title}
          >
            {this.props.buttons}
          </TitleBar>
        }
      >
        <div className="nz-tabs">
          {this.props.tabs}
        </div>
        <div className="nz-messages">
          {this.props.children}
        </div>
        <span className="nz-message-prompt">{this.props.prompt}</span>
        <div className="nz-gradient" />
      </Dialog>
    );
  }
}
