/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../utilities/Props";
import { Anchor } from "../../Stacked";

import "./Tab.scss";

export interface TabProps extends CommonProps {
  anchor?: Anchor;
  isActive?: boolean;
  onClick?: () => void;
}

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
