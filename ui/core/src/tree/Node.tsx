/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";

import ExpansionToggle from "./ExpansionToggle";
import "./Node.scss";
import { CheckListBox, CheckListBoxItem } from "../checklistbox";

/** Number of pixels the node gets offset per each hierarchy level */
export const LEVEL_OFFSET = 20;

/** Properties for the [[TreeNode]] React component */
export interface NodeProps {
  label: React.ReactNode;
  level: number;
  icon?: React.ReactChild;
  checkboxEnabled?: boolean;
  onCheckboxClick?: (label: string) => void;
  isChecked?: (label: string) => boolean;
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

  ["data-testid"]?: string;
}

/** Presentation React component for a Tree node  */
export default class TreeNode extends React.PureComponent<NodeProps> {
  public render() {
    const className = classnames(
      "nz-tree-node",
      this.props.isFocused && "is-focused",
      this.props.isSelected && "is-selected",
      this.props.isHoverDisabled && "is-hover-disabled",
      this.props.className);
    const offset = this.props.level * LEVEL_OFFSET;
    const loader = this.props.isLoading ? (<div className="loader"><i></i><i></i><i></i><i></i><i></i><i></i></div>) : undefined;
    const checkbox = this.props.checkboxEnabled ?
      <CheckListBox>
        {
          this.props.onCheckboxClick && this.props.isChecked ?
            <CheckListBoxItem
              label=""
              checked={this.props.isChecked(this.props.label as string)}
              onClick={() => { if (this.props.onCheckboxClick) this.props.onCheckboxClick(this.props.label as string); }} /> :
            <CheckListBoxItem label="" />
        }
      </CheckListBox> :
      undefined;
    const icon = this.props.icon ? (<div className="icon">{this.props.icon}</div>) : undefined;
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
      >
        {loader}
        {toggle}
        <div
          className="contents"
          data-testid={this.createSubComponentTestId("contents")}
          onClick={this._onClick}
          onMouseDown={this.props.onMouseDown}
          onMouseUp={this.props.onMouseUp}
          onMouseMove={this.props.onMouseMove}>
          {checkbox}
          {icon}
          {this.props.label}
        </div>
        <div className="whole-row" ></div>
        {this.props.children}
      </div>
    );
  }

  private createSubComponentTestId(subId: string): string | undefined {
    if (!this.props["data-testid"])
      return undefined;
    return `${this.props["data-testid"]}-${subId}`;
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
