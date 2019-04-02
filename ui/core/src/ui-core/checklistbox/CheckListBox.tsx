/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module CheckBoxList */

import * as React from "react";
import * as classnames from "classnames";
import { Checkbox } from "../inputs/checkbox/Checkbox";
import { CommonProps } from "../utils/Props";
import "./CheckListBox.scss";

/** Properties for the [[CheckListBoxItem]] component
 * @public
 */
export interface CheckListBoxItemProps extends CommonProps {
  /** Label */
  label: string;
  /** Determine if the item is checked or not */
  checked?: boolean;
  /** Determine if the item is disabled or not */
  disabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => any;
}

/** Item with a checkbox added to a [[CheckListBox]].
 * @public
 */
export class CheckListBoxItem extends React.Component<CheckListBoxItemProps> {

  constructor(props: CheckListBoxItemProps, context?: any) {
    super(props, context);
  }

  private _onClick = () => {
    // istanbul ignore else
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  public render() {
    const className = classnames("core-chk-listboxitem-checkbox");
    return (
      <li>
        <Checkbox checked={this.props.checked} disabled={this.props.disabled} className={className} label={this.props.label} onClick={this._onClick} />
      </li>
    );
  }
}

/** Separator added to a [[CheckListBox]].
 * @public
 */
// tslint:disable-next-line:variable-name
export const CheckListBoxSeparator: React.StatelessComponent = () => {
  return (
    <div className="core-chk-listboxseparator" />
  );
};

/** Properties for the [[CheckListBox]] component
 * @public
 */
export interface CheckListBoxProps {
  /** CSS class name */
  className?: string;
}

/** React component showing a list of Checkbox items.
 * @public
 */
export class CheckListBox extends React.Component<CheckListBoxProps> {
  public render() {
    const className = classnames("core-chk-listbox", this.props.className);
    return (
      <ul className={className}>
        {this.props.children}
      </ul>
    );
  }
}
