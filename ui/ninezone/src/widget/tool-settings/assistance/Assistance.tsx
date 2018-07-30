/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import Props from "../../../utilities/Props";
import "./Assistance.scss";

export default class Assistance extends React.Component<Props> {
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
