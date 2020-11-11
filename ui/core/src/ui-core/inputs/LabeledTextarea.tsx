/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import classnames from "classnames";
import * as React from "react";
import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";
import { Textarea, TextareaProps } from "./Textarea";

/** Properties for [[LabeledTextarea]] component
 * @public
 */
export interface LabeledTextareaProps extends TextareaProps, LabeledComponentProps, MessagedComponentProps { }

/** Textarea wrapper that allows for additional styling and labelling
 * @public
 */
export const LabeledTextarea = React.forwardRef<HTMLTextAreaElement, LabeledTextareaProps>(
  function LabeledTextarea(props, ref) {
    const { label, status, className, disabled, style, // eslint-disable-line @typescript-eslint/no-unused-vars
      inputClassName, inputStyle,
      labelClassName, labelStyle,
      message, messageClassName, messageStyle,
      ...otherProps } = props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-labeled-textarea",
        disabled && "uicore-disabled",
        status,
        className,
      )}>
        {label &&
          <div className={classnames("uicore-label", labelClassName)} style={labelStyle}> {label} </div>
        }
        <Textarea ref={ref} disabled={disabled} className={inputClassName} style={inputStyle} {...otherProps} />
        {message &&
          <div className={classnames("uicore-message", messageClassName)} style={messageStyle}>{message}</div>
        }
      </label>
    );
  }
);
