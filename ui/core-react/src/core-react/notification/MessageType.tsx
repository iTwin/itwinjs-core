/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";

/** Describes a React based message
 * @public
 */
export interface ReactMessage {
  reactNode: React.ReactNode;
}

/** Types for message
 * @public
 */
export type MessageType = string | HTMLElement | ReactMessage;

/** HTMLElement type guard.
 * @internal
 */
export const isHTMLElement = (message: MessageType): message is HTMLElement => {
  return (message as HTMLElement).outerHTML !== undefined;
};

/** ReactMessage type guard.
 * @internal
 */
export const isReactMessage = (message: MessageType): message is ReactMessage => {
  return (message as ReactMessage).reactNode !== undefined;
};
