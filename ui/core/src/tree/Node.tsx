/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

  onClick?: () => void;
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
        onClick={this._onClick}
        className={className}
        style={this.props.style}
      >
        {loader}
        {toggle}
        <div className="contents">
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
      this.props.onClick();
  }
}
