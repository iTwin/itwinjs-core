/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./CheckListBox.scss";
import classnames from "classnames";
import * as React from "react";
import { Checkbox, CommonProps } from "@bentley/ui-core";

/**
 * Properties for the [[CheckListBoxItem]] component.
 * @internal
 */
export interface CheckListBoxItemProps extends CommonProps {
  /** Label */
  label?: string;
  /** Determine if the item is checked or not */
  checked?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => any;
}

/**
 * Item with a checkbox added to a [[CheckListBox]]
 * @internal
 */
export class CheckListBoxItem extends React.Component<CheckListBoxItemProps> {
  private _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick();
    }
  };

  private _onCheckBoxChange = (_event: React.ChangeEvent<HTMLInputElement>) => {
    this._onClick();
  };

  public render() {
    const listClassName = classnames("check-box-item", this.props.checked && "selected", this.props.className);
    return (
      <li className={listClassName} onClick={this._onClick.bind(this)}>
        <Checkbox className="check-box-item-checkbox" checked={this.props.checked} label={this.props.label} onChange={this._onCheckBoxChange.bind(this)} />
      </li>
    );
  }
}

/**
 * Properties for the [[CheckListBox]] component.
 * @internal
 */
export interface CheckListBoxProps {
  /** CSS class name */
  className?: string;
}

/** React component showing a list of Checkbox items.
 * @internal
 */
export class CheckListBox extends React.Component<CheckListBoxProps> {
  public render() {
    const className = classnames("check-listbox", this.props.className);
    return (
      <ul className={className}>
        {this.props.children}
      </ul>
    );
  }
}
