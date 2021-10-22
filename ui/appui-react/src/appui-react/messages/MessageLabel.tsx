/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import classnames from "classnames";
import { MessageDiv } from "./MessageSpan";
import { NotifyMessageType } from "./ReactNotifyMessageDetails";

/** Message String/Label
 * @internal
 */
export function MessageLabel(props: { message: NotifyMessageType, className: string }) {
  const classNames = classnames("uifw-statusbar-message-label", props.className);
  return <MessageDiv className={classNames} message={props.message} />;
}
