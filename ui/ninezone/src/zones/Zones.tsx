/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./Zones.scss";

/** Properties of [[Zones]] component. */
export interface ZonesProps extends CommonProps {
  /** Actual zones here (i.e. [[FooterZone]], [[Zone]]) */
  children?: React.ReactNode;
}

/** Zones component of 9-zone UI app. */
export default class Zones extends React.Component<ZonesProps> {
  public render() {
    const className = classnames(
      "nz-zones-zones",
      this.props.className);

    return (
      <div className={className} style={this.props.style}>
        {this.props.children}
      </div>
    );
  }
}
