/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import Textarea, { TextareaProps } from "./Textarea";
import InputStatus from "./InputStatus";
import "./index.scss";

/** Properties for [[LabeledTextarea]] component */
export interface LabeledTextareaProps extends TextareaProps {
  label: string;
  status?: InputStatus;
  message?: string;
}

/** Textarea wrapper that allows for additional styling and labelling */
export class LabeledTextarea extends React.Component<LabeledTextareaProps> {
  public render(): JSX.Element {
    return (
      <label className={classnames(
        "uicore-inputs-labeled-textarea",
        { disabled: this.props.disabled },
        this.props.status,
        this.props.className,
      )}>
        <div className={"label"}>{this.props.label}</div>
        <Textarea disabled={this.props.disabled} {...this.props} />
        {this.props.message &&
          <div className={"message"}>{this.props.message}</div>}
      </label>
    );
  }
}
export default LabeledTextarea;
