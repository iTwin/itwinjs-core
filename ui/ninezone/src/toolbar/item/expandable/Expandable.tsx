/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../utilities/Props";
import "./Expandable.scss";
import * as ReactDOM from "react-dom";

export interface ExpandableItemProps extends CommonProps {
  panel?: React.ReactNode;
  history?: React.ReactNode;
  isActive?: boolean;
  onIsHistoryExpandedChange?: (isExpanded: boolean) => void;
  renderPanel?: (element: HTMLElement) => void;
  renderHistory?: (element: HTMLElement) => void;
}

export default class ExpandableItem extends React.Component<ExpandableItemProps> {
  private _panel: HTMLDivElement;
  private _history: HTMLDivElement;

  public constructor(props: ExpandableItemProps) {
    super(props);

    this._panel = document.createElement("div");
    this._history = document.createElement("div");
  }

  public componentDidMount(): void {
    this.props.renderPanel && this.props.renderPanel(this._panel);
    this.props.renderHistory && this.props.renderHistory(this._history);
  }

  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-expandable",
      this.props.isActive && "nz-is-active",
      this.props.className);

    const panelPortal = ReactDOM.createPortal(this.props.panel, this._panel);
    const historyPortal = ReactDOM.createPortal(this.props.history, this._history);
    return (
      <div
        onMouseEnter={this.handleOnMouseEnter}
        onMouseLeave={this.handleOnMouseLeave}
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

  private handleOnMouseEnter = () => {
    this.props.onIsHistoryExpandedChange && this.props.onIsHistoryExpandedChange(true);
  }

  private handleOnMouseLeave = () => {
    this.props.onIsHistoryExpandedChange && this.props.onIsHistoryExpandedChange(false);
  }
}
