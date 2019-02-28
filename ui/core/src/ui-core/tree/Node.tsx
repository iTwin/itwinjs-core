/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";
import { Checkbox, CheckboxProps } from "../inputs/checkbox/Checkbox";
import { CheckBoxState } from "../enums/CheckBoxState";
import ExpansionToggle from "./ExpansionToggle";
import { Spinner, SpinnerSize } from "../loading/Spinner";

import "./Node.scss";

/** Type for node checkbox renderer */
export type NodeCheckboxRenderer = (props: CheckboxProps) => React.ReactNode;

/** Number of pixels the node gets offset per each hierarchy level */
export const LEVEL_OFFSET = 20;

const EXPANSION_TOGGLE_WIDTH = 24;

/** Properties for [[TreeNode]] checkbox */
export interface NodeCheckboxProps {
  /** State of the checkbox */
  state?: CheckBoxState;
  /** Click event callback */
  onClick?: (newState: CheckBoxState) => void;
  /** Indicates whether checkbox is disabled */
  isDisabled?: boolean;
}

/** Properties for the [[TreeNode]] React component */
export interface NodeProps {
  label: React.ReactNode;
  level: number;
  icon?: React.ReactChild;
  /** Properties for the checkbox */
  checkboxProps?: NodeCheckboxProps;
  isLeaf?: boolean;
  isLoading?: boolean;
  isExpanded?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  isHoverDisabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  onClickExpansionToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Contains render overrides for different pieces of the node component */
  renderOverrides?: {
    /** Callback to render a checkbox. Only called when checkbox is displayed */
    renderCheckbox?: NodeCheckboxRenderer;
  };
  ["data-testid"]?: string;
}

/** Presentation React component for a Tree node  */
export default class TreeNode extends React.Component<NodeProps> {
  public render() {
    const className = classnames(
      "core-tree-node",
      this.props.isFocused && "is-focused",
      this.props.isSelected && "is-selected",
      this.props.isHoverDisabled && "is-hover-disabled",
      this.props.className);
    let offset = this.props.level * LEVEL_OFFSET;
    if (!this.props.isLoading && this.props.isLeaf)
      offset += EXPANSION_TOGGLE_WIDTH; // Add expansion toggle/loader width if they're not rendered

    const loader = this.props.isLoading ? (<div className="loader"><Spinner size={SpinnerSize.Small} /></div>) : undefined;

    let checkbox: React.ReactNode;
    if (this.props.checkboxProps) {
      const props: CheckboxProps = {
        label: "",
        checked: this.props.checkboxProps.state === CheckBoxState.On,
        disabled: this.props.checkboxProps.isDisabled,
        onClick: this._onCheckboxClick,
        onChange: this._onCheckboxChange,
      };
      if (this.props.renderOverrides && this.props.renderOverrides.renderCheckbox) {
        checkbox = this.props.renderOverrides.renderCheckbox(props);
      } else {
        checkbox = (<Checkbox {...props} data-testid={this.createSubComponentTestId("checkbox")} />);
      }
    }

    const icon = this.props.icon ? (<div className="core-tree-node-icon">{this.props.icon}</div>) : undefined;

    const toggle = (this.props.isLoading || this.props.isLeaf) ? undefined : (
      <ExpansionToggle
        className="expansion-toggle"
        data-testid={this.createSubComponentTestId("expansion-toggle")}
        onClick={this._onClickExpansionToggle}
        isExpanded={this.props.isExpanded}
      />
    );

    const style = { ...this.props.style, paddingLeft: offset };

    return (
      <div
        className={className}
        style={style}
        data-testid={this.props["data-testid"]}
        onClick={this._onClick}
        onMouseDown={this.props.onMouseDown}
        onMouseUp={this.props.onMouseUp}
        onMouseMove={this.props.onMouseMove}
      >
        {loader}
        {toggle}
        <div
          className="contents"
          data-testid={this.createSubComponentTestId("contents")}
        >
          {checkbox}
          {icon}
          {this.props.label}
        </div>
        {this.props.children}
      </div>
    );
  }

  private createSubComponentTestId(subId: string): string | undefined {
    if (!this.props["data-testid"])
      return undefined;
    return `${this.props["data-testid"]}-${subId}`;
  }

  private _onCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.props.checkboxProps && this.props.checkboxProps.onClick && !this.props.checkboxProps.isDisabled)
      this.props.checkboxProps.onClick(e.target.indeterminate ? CheckBoxState.Partial : e.target.checked ? CheckBoxState.On : CheckBoxState.Off);
  }

  private _onCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }

  private _onClickExpansionToggle = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (this.props.onClickExpansionToggle)
      this.props.onClickExpansionToggle();
  }

  private _onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (this.props.onClick)
      this.props.onClick(e);
  }
}
