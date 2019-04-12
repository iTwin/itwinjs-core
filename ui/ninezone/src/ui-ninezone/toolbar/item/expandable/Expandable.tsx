/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CommonProps } from "@bentley/ui-core";
import { ToolbarItem, ToolbarItemProps } from "../../Toolbar";
import "./Expandable.scss";

/** Properties of [[ExpandableItem]] component.
 * @alpha
 */
export interface ExpandableItemProps extends CommonProps {
  /** History of the toolbar. See [[]] */
  history?: React.ReactNode;
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if item is disabled. */
  isDisabled?: boolean;
  /** Function called when history tray should be extended or shrank. */
  onIsHistoryExtendedChange?: (isExtended: boolean) => void;
  /** Panel of the toolbar. See [[]] */
  panel?: React.ReactNode;
}

class ActualItem extends React.PureComponent<ExpandableItemProps> implements ToolbarItem {
  public readonly panel = document.createElement("div");
  public readonly history = document.createElement("div");

  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-expandable",
      this.props.isActive && "nz-active",
      this.props.isDisabled && "nz-disabled",
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

/** Expandable toolbar item.
 * @alpha
 */
export class ExpandableItem extends React.PureComponent<ExpandableItemProps> {
  public render() {
    const toolbarItemProps = this.props as ToolbarItemProps<ActualItem>;
    return (
      <ActualItem
        {...this.props}
        ref={toolbarItemProps.toolbarItemRef}
      />
    );
  }
}
