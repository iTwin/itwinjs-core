/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as classnames from "classnames";
import * as React from "react";

import ExpansionToggle from "./ExpansionToggle";
import "./Node.scss";

/** Props for the TreeNode React component */
export interface NodeProps {
  label?: React.ReactNode;
  icon?: React.ReactChild;
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
}

/** Presentation React component for a Tree node  */
export default class TreeNode extends React.Component<NodeProps> {
  public render() {
    const className = classnames(
      "nz-tree-node",
      this.props.isFocused && "is-focused",
      this.props.isSelected && "is-selected",
      this.props.isHoverDisabled && "is-hover-disabled",
      this.props.className);

    const loader = this.props.isLoading ? (<div className="loader"><i></i><i></i><i></i><i></i><i></i><i></i></div>) : undefined;
    const icon = this.props.icon ? (<div className="icon">{this.props.icon}</div>) : undefined;
    const toggle = (this.props.isLoading || this.props.isLeaf) ? undefined : (
      <ExpansionToggle
        className="expansion-toggle"
        onClick={this._onClickExpansionToggle}
        isExpanded={this.props.isExpanded}
      />
    );

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {loader}
        {toggle}
        <div
          className="contents"
          onClick={this._onClick}
          onMouseDown={this._onMouseDown}
          onMouseUp={this._onMouseUp}
          onMouseMove={this._onMouseMove}>
          {icon}
          {this.props.label}
        </div>
        <div className="whole-row" ></div>
        {this.props.children}
      </div>
    );
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

  private _onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onMouseMove)
      this.props.onMouseMove(e);
  }

  private _onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onMouseDown)
      this.props.onMouseDown(e);
  }

  private _onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onMouseUp)
      this.props.onMouseUp(e);
  }
}
