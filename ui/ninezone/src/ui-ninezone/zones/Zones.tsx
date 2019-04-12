/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Zones.scss";

/** Properties of [[Zones]] component.
 * @alpha
 */
export interface ZonesProps extends CommonProps {
  /** Actual zones here (i.e. [[StatusZone]], [[Zone]]) */
  children?: React.ReactNode;
  /** Describes if the zones component is hidden. */
  isHidden?: boolean;
}

/** Zones component of 9-zone UI app.
 * @alpha
 */
export class Zones extends React.PureComponent<ZonesProps> {
  public render() {
    const { isHidden } = this.props;
    const className = classnames(
      "nz-zones-zones",
      isHidden && "nz-hidden",
      this.props.className);
    return (
      <div className={className} style={this.props.style}>
        {this.props.children}
      </div>
    );
  }
}
