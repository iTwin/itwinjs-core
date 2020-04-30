/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { ClassNameProps } from "@bentley/ui-core";
import { NotifyMessageType, isHTMLElement, isReactMessage } from "./ReactNotifyMessageDetails";

/** @internal */
export interface MessageSpanProps extends ClassNameProps {
  message: NotifyMessageType;
}

/** @internal */
export function MessageSpan(props: MessageSpanProps) {
  let messageNode = null;

  if (typeof props.message === "string")
    messageNode = <span className={props.className}>{props.message}</span>;
  else if (isHTMLElement(props.message))
    messageNode = <span className={props.className} dangerouslySetInnerHTML={{ __html: props.message.outerHTML }} />;
  else if (isReactMessage(props.message))
    messageNode = <span className={props.className}>{props.message.reactNode}</span>;

  return messageNode;
}

/** @internal */
export function MessageDiv(props: MessageSpanProps) {
  let messageNode = null;

  if (typeof props.message === "string")
    messageNode = <div className={props.className}>{props.message}</div>;
  else if (isHTMLElement(props.message))
    messageNode = <div className={props.className} dangerouslySetInnerHTML={{ __html: props.message.outerHTML }} />;
  else if (isReactMessage(props.message))
    messageNode = <div className={props.className}>{props.message.reactNode}</div>;

  return messageNode;
}
