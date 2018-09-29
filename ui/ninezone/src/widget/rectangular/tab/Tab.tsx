/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import { HorizontalAnchor, HorizontalAnchorHelpers } from "../../Stacked";
import "./Tab.scss";

/** Describes available tab modes. */
export enum TabMode {
  Closed,
  Open,
  Active,
}

/** Properties of [[Tab]] component. */
export interface TabProps extends CommonProps {
  /** Tab icon. */
  children?: React.ReactNode;
  /** Describes to which side the widget of this tab is anchored. */
  anchor: HorizontalAnchor;
  /** Describes current tab mode. */
  mode: TabMode;
  /** Function called when the tab is clicked. */
  onClick?: () => void;
}

/**
 * Rectangular widget tab. Used in [[Stacked]] component.
 * @note See [[Draggable]] tab.
 */
export default class Tab extends React.Component<TabProps> {
  public render() {
    const className = classnames(
      "nz-widget-rectangular-tab-tab",
      HorizontalAnchorHelpers.getCssClassName(this.props.anchor),
      this.props.mode === TabMode.Active && "nz-mode-active",
      this.props.mode === TabMode.Open && "nz-mode-open",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this._handleOnClick}
      >
        {this.props.children}
      </div>
    );
  }

  private _handleOnClick = () => {
    this.props.onClick && this.props.onClick();
  }
}
