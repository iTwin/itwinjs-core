/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import type * as React from "react";
import type { InputStatus } from "./InputStatus";

/** Properties for labeled components
 * @public
 */
export interface LabeledComponentProps {
  /** Text that will be shown next to or above the input. */
  label?: string;
  /** Input status like: "Success", "Warning" or "Error" */
  status?: InputStatus;
  /** Custom CSS class name for the checkbox input element */
  inputClassName?: string;
  /** Custom CSS Style for the checkbox input element */
  inputStyle?: React.CSSProperties;
  /** Custom CSS class name for the label */
  labelClassName?: string;
  /** Custom CSS Style for the label */
  labelStyle?: React.CSSProperties;
}

/** Properties for components with messages
 * @public
 */
export interface MessagedComponentProps {
  /** Optional text shown below the input. */
  message?: string;
  /** Custom CSS class name for the message */
  messageClassName?: string;
  /** Custom CSS Style for the message */
  messageStyle?: React.CSSProperties;
}
