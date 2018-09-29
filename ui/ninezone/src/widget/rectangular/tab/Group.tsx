/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import { HorizontalAnchor, HorizontalAnchorHelpers } from "../../Stacked";
import "./Group.scss";

/** Describes how handle visibility is controlled. */
export enum VisibilityMode {
  OnHover,
  Visible,
  Timeout,
}

/** Properties of [[Group]] component. */
export interface GroupProps extends CommonProps {
  /** Describes to which side the widget of this tab is anchored. */
  anchor: HorizontalAnchor;
  /** Actual tabs. See: [[Draggable]], [[TabSeparator]], [[Tab]] */
  children?: React.ReactNode;
  /** Describes if the group handle is visible. */
  handleMode: VisibilityMode;
}

/** Tab group component for stacked widget. */
// tslint:disable-next-line:variable-name
export const Group: React.StatelessComponent<GroupProps> = (props: GroupProps) => {
  const className = classnames(
    "nz-widget-rectangular-tab-group",
    props.handleMode === VisibilityMode.OnHover && "nz-handle-hover",
    props.handleMode === VisibilityMode.Visible && "nz-handle-visible",
    props.handleMode === VisibilityMode.Timeout && "nz-handle-timeout",
    HorizontalAnchorHelpers.getCssClassName(props.anchor),
    props.className);

  return (
    <div
      className={className}
      style={props.style}
    >
      {props.children}
    </div>
  );
};

export default Group;
