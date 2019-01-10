/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../utilities/Props";
import { HorizontalAnchor, HorizontalAnchorHelpers } from "../../Stacked";
import "./Group.scss";

/** Describes how handle visibility is controlled. */
export enum VisibilityMode {
  OnHover,
  Visible,
  Timeout,
}

/** Properties of [[TabGroup]] component. */
export interface TabGroupProps extends CommonProps {
  /** Describes to which side the widget of this tab is anchored. */
  anchor: HorizontalAnchor;
  /** Actual tabs. See: [[Draggable]], [[TabSeparator]], [[Tab]] */
  children?: React.ReactNode;
  /** Describes if the group handle is visible. */
  handleMode: VisibilityMode;
}

/** Tab group component for stacked widget. */
export class TabGroup extends React.PureComponent<TabGroupProps> {
  public render() {
    const className = classnames(
      "nz-widget-rectangular-tab-group",
      this.props.handleMode === VisibilityMode.OnHover && "nz-handle-hover",
      this.props.handleMode === VisibilityMode.Visible && "nz-handle-visible",
      this.props.handleMode === VisibilityMode.Timeout && "nz-handle-timeout",
      HorizontalAnchorHelpers.getCssClassName(this.props.anchor),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
