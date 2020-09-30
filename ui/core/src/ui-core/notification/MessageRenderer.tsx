/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import * as DOMPurify from "dompurify";
import { isHTMLElement, isReactMessage, MessageType } from "./MessageType";
import { ClassNameProps } from "../utils/Props";

// cSpell:ignore dompurify

/** Properties for the [[MessageRenderer]] component
 * @beta
 */
export interface MessageRendererProps extends ClassNameProps {
  /** Message to render */
  message: MessageType;
  /** Indicates whether to use a `span` or `div` element for rendering */
  useSpan?: boolean;
}

/** React component renders a string, HTMLElement or React node in a `div` or `span`
 * @beta
 */
export function MessageRenderer(props: MessageRendererProps) {
  let messageNode = null;
  const OutElement = props.useSpan ? "span" : "div";

  if (typeof props.message === "string") {
    messageNode = <OutElement className={props.className}>{props.message}</OutElement>;
  } else if (isHTMLElement(props.message)) {
    const sanitizer = DOMPurify.sanitize; // `sanitizer` is default function name for "jam3/no-sanitizer-with-danger" ESLint rule
    // eslint-disable-next-line @typescript-eslint/naming-convention
    messageNode = <OutElement className={props.className} dangerouslySetInnerHTML={{ __html: sanitizer(props.message.outerHTML) }} />;
  } else {
    /* istanbul ignore else */
    if (isReactMessage(props.message))
      messageNode = <OutElement className={props.className}>{props.message.reactNode}</OutElement>;
  }

  return messageNode;
}
