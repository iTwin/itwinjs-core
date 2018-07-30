/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./GhostOutline.scss";

/**
 * Component used to visualize merge/unmerge action by displaying zone outline.
 * @note Should be placed in [[Zone]] component.
 */
export default class GhostOutline extends React.Component<CommonProps> {
  public render() {
    const className = classnames(
      "nz-zones-ghostOutline",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      />
    );
  }
}
