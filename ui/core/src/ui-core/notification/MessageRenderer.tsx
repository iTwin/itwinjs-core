/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { isHTMLElement, isReactMessage, MessageType } from "./MessageType";
import { ClassNameProps } from "../utils/Props";

/** Properties for the [[MessageRenderer]] component
 * @beta
 */
export interface MessageRendererProps extends ClassNameProps {
  message: MessageType;
  useSpan?: boolean;
}

/** React component renders a string, HTMLElement or React node in a `div` or `span`
 * @beta
 */
export function MessageRenderer(props: MessageRendererProps) {
  let messageNode = null;

  if (props.useSpan) {
    if (typeof props.message === "string")
      messageNode = <span className={props.className}>{props.message}</span>;
    else if (isHTMLElement(props.message))
      messageNode = <span className={props.className} dangerouslySetInnerHTML={{ __html: props.message.outerHTML }} />;
    else {
      /* istanbul ignore else */
      if (isReactMessage(props.message))
        messageNode = <span className={props.className}>{props.message.reactNode}</span>;
    }
  } else {
    if (typeof props.message === "string")
      messageNode = <div className={props.className}>{props.message}</div>;
    else if (isHTMLElement(props.message))
      messageNode = <div className={props.className} dangerouslySetInnerHTML={{ __html: props.message.outerHTML }} />;
    else {
      /* istanbul ignore else */
      if (isReactMessage(props.message))
        messageNode = <div className={props.className}>{props.message.reactNode}</div>;
    }
  }

  return messageNode;
}
