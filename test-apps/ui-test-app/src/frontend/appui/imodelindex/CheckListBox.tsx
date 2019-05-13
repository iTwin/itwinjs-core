/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
import { CheckListBoxItemProps } from "./CheckListBox";
import "./CheckListBox.scss";

/**
 * Properties for the [[CheckBox]] component.
 * @internal
 */
export interface CheckBoxProps extends CommonProps {
  /** Determine if the item is checked or not */
  checked?: boolean;
  /** Determine if the item is disabled or not */
  disabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => any;
}

/**
 * Checkbox item
 * @internal
 */
export class CheckBox extends React.Component<CheckBoxProps> {

  constructor(props: CheckBoxProps, context?: any) {
    super(props, context);
  }

  private _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  public render() {
    const checkClassName = classnames("check-box", this.props.checked && "checked");
    return (
      <span className={checkClassName} onClick={this._onClick.bind(this)} />
    );
  }
}

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

  constructor(props: CheckListBoxItemProps, context?: any) {
    super(props, context);
  }

  private _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  public render() {
    const listClassName = classnames("check-box-item", this.props.checked && "selected", this.props.className);
    return (
      <li className={listClassName} onClick={this._onClick.bind(this)}>
        <CheckBox checked={this.props.checked} />
        <span className="label">{this.props.label}</span>
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
