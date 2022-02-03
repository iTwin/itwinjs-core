/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Select
 */

import classnames from "classnames";
import * as React from "react";
import type { LabeledComponentProps, MessagedComponentProps } from "../inputs/LabeledComponentProps";
import type { ThemedSelectProps } from "./ThemedSelect";
import { ThemedSelect } from "./ThemedSelect";

/** Properties for [[LabeledThemedSelect]] components
 * @beta @deprecated
 */
export interface LabeledThemedSelectProps extends ThemedSelectProps, LabeledComponentProps, MessagedComponentProps { }

/** Dropdown wrapper that allows for additional styling and labelling
 * @beta @deprecated
 */
export function LabeledThemedSelect(props: LabeledThemedSelectProps) {
  const { label, status, className, style,
    inputClassName, inputStyle,
    labelClassName, labelStyle,
    message, messageClassName, messageStyle,
    ...otherProps } = props as any;

  return (
    <label style={style} className={classnames(
      "uicore-inputs-labeled-themed-select",
      props.isDisabled && "uicore-disabled",
      status,
      className,
    )}>
      {label &&
        <div className={classnames("uicore-label", labelClassName)} style={labelStyle}> {label} </div>
      }
      <ThemedSelect isDisabled={props.isDisabled} className={inputClassName} styles={inputStyle} {...otherProps} />
      {message &&
        <div className={classnames("uicore-message", messageClassName)} style={messageStyle}>{message}</div>
      }
    </label>
  );
}
