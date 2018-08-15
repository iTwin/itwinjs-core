/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import "./Item.scss";

/** Properties of [[AssistanceItem]] component. */
export interface AssistanceItemProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[AssistanceItem]], [[Separator]] */
  children?: React.ReactNode;
}

/** Tool assistance item. Used in [[Assistance]] component. */
export default class AssistanceItem extends React.Component<AssistanceItemProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-assistance-item",
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
