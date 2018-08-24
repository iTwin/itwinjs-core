/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Content.scss";

/** Properties of [[TabSeparator]] component. */
export interface ToolAssistanceContentProps extends CommonProps {
  /** Assistance items and separators. I.e.: [[AssistanceItem]], [[Separator]] */
  children?: React.ReactNode;
}

/** Tool assistance. Used as content of [[ToolSettings]] component. */
export default class ToolAssistanceContent extends React.Component<ToolAssistanceContentProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-content",
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
