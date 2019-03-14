/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utilities/Props";
import "./Zones.scss";

/** Properties of [[Zones]] component. */
export interface ZonesProps extends CommonProps {
  /** Actual zones here (i.e. [[FooterZone]], [[Zone]]) */
  children?: React.ReactNode;
  isHidden?: boolean;
}

/** Zones component of 9-zone UI app. */
export class Zones extends React.PureComponent<ZonesProps> {
  public render() {
    const { isHidden } = this.props;
    const className = classnames( "nz-zones-zones", isHidden && "hide", this.props.className );
    return (
      <div className={className} style={this.props.style}>
        {this.props.children}
      </div>
    );
  }
}
