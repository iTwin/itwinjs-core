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

/** Available handle modes. */
export enum HandleMode {
  Hovered,
  Visible,
  Timedout,
}

/** Helpers for [[HandleMode]]. */
export class HandleModeHelpers {
  /** Class name of [[HandleMode.Hovered]] */
  public static readonly HOVERED_CLASS_NAME = "nz-handle-hovered";
  /** Class name of [[HandleMode.Visible]] */
  public static readonly VISIBLE_CLASS_NAME = "nz-handle-visible";
  /** Class name of [[HandleMode.Timedout]] */
  public static readonly TIMEDOUT_CLASS_NAME = "nz-handle-timedout";

  /** @returns Class name of specified [[HandleMode]] */
  public static getCssClassName(mode: HandleMode): string {
    switch (mode) {
      case HandleMode.Hovered:
        return HandleModeHelpers.HOVERED_CLASS_NAME;
      case HandleMode.Visible:
        return HandleModeHelpers.VISIBLE_CLASS_NAME;
      case HandleMode.Timedout:
        return HandleModeHelpers.TIMEDOUT_CLASS_NAME;
    }
  }
}

/** Properties of [[TabGroup]] component. */
export interface TabGroupProps extends CommonProps {
  /** Describes to which side the widget of this tab is anchored. */
  anchor: HorizontalAnchor;
  /** Actual tabs. See: [[Tab]], [[TabSeparator]] */
  children?: React.ReactNode;
  /** Describes handle mode of this tab group. */
  handle: HandleMode;
}

/** Tab group component for stacked widget. */
export class TabGroup extends React.PureComponent<TabGroupProps> {
  public render() {
    const className = classnames(
      "nz-widget-rectangular-tab-group",
      HandleModeHelpers.getCssClassName(this.props.handle),
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
