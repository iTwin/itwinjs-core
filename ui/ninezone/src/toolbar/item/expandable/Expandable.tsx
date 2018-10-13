/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import CommonProps from "../../../utilities/Props";
import "./Expandable.scss";

/** Properties of [[ExpandableItem]] component. */
export interface ExpandableItemProps extends CommonProps {
  /** Actual history tray. I.e. [[Tray]] */
  history?: React.ReactNode;
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if item is disabled. */
  isDisabled?: boolean;
  /** Function called when history tray should be extended or shrank. */
  onIsHistoryExtendedChange?: (isExtended: boolean) => void;
  /** Actual panel. I.e. [[Group]], [[NestedGroup]], [[Panel]] */
  panel?: React.ReactNode;
  /** Function called to determine where the history tray should be rendered. Injected by [[Toolbar]] */
  renderHistoryTo?: () => HTMLElement;
  /** Function called to determine where the panel should be rendered. Injected by [[Toolbar]] */
  renderPanelTo?: () => HTMLElement;
}

/** Expandable toolbar item. */
export default class ExpandableItem extends React.Component<ExpandableItemProps> {
  private _panel = document.createElement("div");
  private _history = document.createElement("div");

  public componentDidMount() {
    if (this.props.renderPanelTo) {
      const renderPanelTo = this.props.renderPanelTo();
      renderPanelTo.appendChild(this._panel);
    }

    if (this.props.renderHistoryTo) {
      const renderHistoryTo = this.props.renderHistoryTo();
      renderHistoryTo.appendChild(this._history);
    }
  }

  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-expandable",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    const panelPortal = ReactDOM.createPortal(this.props.panel, this._panel);
    const historyPortal = ReactDOM.createPortal(this.props.history, this._history);
    return (
      <div
        onMouseEnter={this._handleOnMouseEnter}
        onMouseLeave={this._handleOnMouseLeave}
        className={className}
        style={this.props.style}
      >
        {this.props.children}
        <div className="nz-triangle" />
        {panelPortal}
        {historyPortal}
      </div>
    );
  }

  private _handleOnMouseEnter = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(true);
  }

  private _handleOnMouseLeave = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(false);
  }
}
