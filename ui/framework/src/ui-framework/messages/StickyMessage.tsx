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
import { MessageSeverity } from "@bentley/ui-core";
import { MessageLayout } from "@bentley/ui-ninezone";
import { Alert } from "@itwin/itwinui-react";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";
import { MessageLabel } from "./MessageLabel";
import { getAlertType } from "./getAlertType";

/** Properties for a [[StickyMessage]]
 * @beta
 */
export interface StickyMessageProps {
  id: string;
  messageDetails: NotifyMessageDetailsType;
  severity: MessageSeverity;
  closeMessage: (id: string) => void;
}

/** Sticky Message React component
 * @beta
 */
export function StickyMessage(props: StickyMessageProps) {
  const { id, messageDetails, severity, closeMessage } = props;
  const [closing, setClosing] = React.useState(false);
  const alertType = getAlertType(severity);

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
      <Alert type={alertType as any} onClose={handleClose}>
        <MessageLayout>
          <MessageLabel message={messageDetails.briefMessage} className="uifw-statusbar-message-brief" />
          {messageDetails.detailedMessage &&
            <MessageLabel message={messageDetails.detailedMessage} className="uifw-statusbar-message-detailed" />
          }
        </MessageLayout>
      </Alert>
    </div>
  );
}
