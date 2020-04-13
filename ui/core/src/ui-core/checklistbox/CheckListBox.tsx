/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CheckListBox
 */

import * as React from "react";
import classnames from "classnames";
import { Checkbox } from "../checkbox/Checkbox";
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
export class CheckListBoxItem extends React.PureComponent<CheckListBoxItemProps> {
  public render() {
    const className = classnames("core-chk-listboxitem-checkbox", this.props.className);
    return (
      <li>
        <Checkbox checked={this.props.checked} disabled={this.props.disabled}
          inputClassName={className} style={this.props.style}
          label={this.props.label} onClick={this.props.onClick} />
      </li>
    );
  }
}

/** Separator added to a [[CheckListBox]].
 * @beta
 */
export function CheckListBoxSeparator() {
  return (
    <div className="core-chk-listbox-separator" />
  );
}

/** React component showing a list of Checkbox items.
 * @beta
 */
export class CheckListBox extends React.PureComponent<CommonProps> {
  public render() {
    const className = classnames("core-chk-listbox", this.props.className);
    return (
      <ul className={className} style={this.props.style}>
        {this.props.children}
      </ul>
    );
  }
}
