/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module CheckListBox */

import * as React from "react";
import * as classnames from "classnames";
import { Checkbox } from "../inputs/checkbox/Checkbox";
import { CommonProps } from "../utils/Props";
import "./CheckListBox.scss";

/** Properties for the [[CheckListBoxItem]] component
 * @beta
 */
export interface CheckListBoxItemProps extends CommonProps {
  /** Label */
  label: string;
  /** Indicates whether the item is checked or not */
  checked?: boolean;
  /** Indicates whether the item is disabled or not */
  disabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => any;
}

/** Item with a checkbox added to a [[CheckListBox]].
 * @beta
 */
export class CheckListBoxItem extends React.Component<CheckListBoxItemProps> {

  constructor(props: CheckListBoxItemProps) {
    super(props);
  }

  private _onClick = () => {
    // istanbul ignore else
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  public render() {
    const className = classnames("core-chk-listboxitem-checkbox", this.props.className);

    return (
      <li>
        <Checkbox checked={this.props.checked} disabled={this.props.disabled}
          inputClassName={className} style={this.props.style}
          label={this.props.label} onClick={this._onClick} />
      </li>
    );
  }
}

/** Separator added to a [[CheckListBox]].
 * @beta
 */
// tslint:disable-next-line:variable-name
export const CheckListBoxSeparator: React.StatelessComponent = () => {
  return (
    <div className="core-chk-listbox-separator" />
  );
};

/** React component showing a list of Checkbox items.
 * @beta
 */
export class CheckListBox extends React.Component<CommonProps> {
  public render() {
    const className = classnames("core-chk-listbox", this.props.className);
    return (
      <ul className={className} style={this.props.style}>
        {this.props.children}
      </ul>
    );
  }
}
