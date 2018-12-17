/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CommonProps } from "../../../utilities/Props";
import { ToolbarItem, ToolbarItemProps } from "../../Toolbar";
import "./Expandable.scss";

/** Properties of [[ExpandableItem]] component. */
export interface ExpandableItemProps extends CommonProps {
  /** History of the toolbar. See [[]] */
  history?: React.ReactNode;
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if item is disabled. */
  isDisabled?: boolean;
  /** Function called when history tray should be extended or shrank. */
  onIsHistoryExtendedChange?: (isExtended: boolean) => void;
  // ref?: React.RefObject<ToolbarItem>;
  /** Panel of the toolbar. See [[]] */
  panel?: React.ReactNode;
}

/** Expandable toolbar item. */
class ExpandableItemComponent extends React.PureComponent<ExpandableItemProps> implements ToolbarItem {
  public readonly panel = document.createElement("div");
  public readonly history = document.createElement("div");

  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-expandable",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    const panel = ReactDOM.createPortal((
      <div className="nz-panel">
        {this.props.panel}
      </div>
    ), this.panel);
    const history = ReactDOM.createPortal((
      <div className="nz-history">
        {this.props.history}
      </div>
    ), this.history);
    return (
      <div
        onMouseEnter={this._handleMouseEnter}
        onMouseLeave={this._handleMouseLeave}
        className={className}
        style={this.props.style}
      >
        {this.props.children}
        <div className="nz-triangle" />
        {panel}
        {history}
      </div>
    );
  }

  private _handleMouseEnter = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(true);
  }

  private _handleMouseLeave = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(false);
  }
}

export class ExpandableItem extends React.PureComponent<ExpandableItemProps> {
  public render() {
    const toolbarItemProps = this.props as ToolbarItemProps<ExpandableItemComponent>;
    return (
      <ExpandableItemComponent
        {...this.props}
        ref={toolbarItemProps.toolbarItemRef}
      />
    );
  }
}
