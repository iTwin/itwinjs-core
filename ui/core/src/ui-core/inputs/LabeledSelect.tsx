/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Select, SelectProps } from "./Select";
import { InputStatus } from "./InputStatus";

/** Properties for [[LabeledSelect]] components
 * @beta
 */
export interface LabeledSelectProps extends SelectProps {
  label: string;
  status?: InputStatus;
  message?: string;
}

/** Dropdown wrapper that allows for additional styling and labelling
 * @beta
 */
export class LabeledSelect extends React.Component<LabeledSelectProps> {
  public render(): JSX.Element {
    return (
      <label className={classnames(
        "uicore-inputs-labeled-select",
        { disabled: this.props.disabled },
        this.props.status,
        this.props.className,
      )}>
        <div className={"label"}>{this.props.label}</div>
        <Select disabled={this.props.disabled} {...this.props} />
        {this.props.message &&
          <div className={"message"}>{this.props.message}</div>}
      </label>
    );
  }
}
