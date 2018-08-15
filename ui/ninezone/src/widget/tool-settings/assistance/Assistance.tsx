/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import "./Assistance.scss";

/** Properties of [[TabSeparator]] component. */
export interface AssistanceProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[AssistanceItem]], [[Separator]] */
  children?: React.ReactNode;
}

/** Tool assistance. Used as content of [[ToolSettings]] component. */
export default class Assistance extends React.Component<AssistanceProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-assistance-assistance",
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
