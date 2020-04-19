/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { ClassNameProps } from "@bentley/ui-core";

/** @internal */
export interface MessageSpanProps extends ClassNameProps {
  message: HTMLElement | string;
}

/** @internal */
// tslint:disable-next-line: variable-name
export const MessageSpan = (props: MessageSpanProps): JSX.Element => {
  let messageNode: JSX.Element;

  if (typeof props.message === "string")
    messageNode = <span className={props.className}>{props.message}</span>;
  else
    messageNode = <span className={props.className} dangerouslySetInnerHTML={{ __html: props.message.outerHTML }} />;

  return messageNode;
};

/** @internal */
// tslint:disable-next-line: variable-name
export const MessageDiv = (props: MessageSpanProps): JSX.Element => {
  let messageNode: JSX.Element;

  if (typeof props.message === "string")
    messageNode = <div className={props.className}>{props.message}</div>;
  else
    messageNode = <div className={props.className} dangerouslySetInnerHTML={{ __html: props.message.outerHTML }} />;

  return messageNode;
};
