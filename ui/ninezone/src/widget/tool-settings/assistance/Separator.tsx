/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../utilities/Props";
import "./Separator.scss";

/** Properties of [[Separator]] component. */
export interface SeparatorProps extends CommonProps {
  /** Label of separator. */
  label?: string;
}

/** Assistance item separator. Used in [[Assistance]] component. */
export default class Separator extends React.Component<SeparatorProps> {
  public render() {
    const className = classnames(
      "nz-widget-toolSettings-assistance-separator",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-label">
          {this.props.label}
        </div>
        <div className="nz-separator" />
      </div>
    );
  }
}
