/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import { Anchor } from "../../Stacked";
import "./Tab.scss";

/** Properties of [[Tab]] component. */
export interface TabProps extends CommonProps {
  /** Describes to which side the widget of this tab is anchored. */
  anchor?: Anchor;
  /** Describes if the tab is active. */
  isActive?: boolean;
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
      this.props.anchor === Anchor.Left && "nz-left-anchor",
      this.props.isActive && "nz-is-active",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.handleOnClick}
      >
        {this.props.children}
      </div>
    );
  }

  private handleOnClick = () => {
    this.props.onClick && this.props.onClick();
  }
}
