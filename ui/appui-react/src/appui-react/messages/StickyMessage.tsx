/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import "./StickyMessage.scss";
import * as React from "react";
import classnames from "classnames";
import { MessageSeverity } from "@itwin/appui-abstract";
import {
  Message,
  MessageButton,
  MessageLayout,
  StatusHelpers,
} from "@itwin/appui-layout-react";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";
import { MessageLabel } from "./MessageLabel";
import { HollowIcon } from "./HollowIcon";
import { Icon, MessageContainer } from "@itwin/core-react";

/** Properties for a [[StickyMessage]]
 * @deprecated Props of a deprecated component.
 * @public
 */
export interface StickyMessageProps {
  id: string;
  messageDetails: NotifyMessageDetailsType;
  severity: MessageSeverity;
  closeMessage: (id: string) => void;
}

/** Sticky Message React component
 * @public
 * @deprecated
 */
export function StickyMessage(props: StickyMessageProps) { // eslint-disable-line deprecation/deprecation
  const { id, messageDetails, severity, closeMessage } = props;
  const [closing, setClosing] = React.useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => closeMessage(id), 500);
  };

  const classNames = classnames(
    "uifw-statusbar-sticky-message",
    closing && "uifw-closing",
  );

  return (
    <div className={classNames}>
      <Message // eslint-disable-line deprecation/deprecation
        status={StatusHelpers.severityToStatus(severity)}
        icon={
          <HollowIcon
            iconSpec={MessageContainer.getIconClassName(severity, true)}
          />
        }
      >
        <MessageLayout
          buttons={
            <MessageButton
              onClick={handleClose}
              className="uifw-statusbar-sticky-close"
            >
              <Icon iconSpec="icon-close" />
            </MessageButton>
          }
        >
          <MessageLabel
            message={messageDetails.briefMessage}
            className="uifw-statusbar-message-brief"
          />
          {messageDetails.detailedMessage && (
            <MessageLabel
              message={messageDetails.detailedMessage}
              className="uifw-statusbar-message-detailed"
            />
          )}
        </MessageLayout>
      </Message>
    </div>
  );
}
