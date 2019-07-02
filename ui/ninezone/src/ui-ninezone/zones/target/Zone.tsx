/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTargetProps } from "./Merge";
import { WidgetTarget } from "./Target";
import "./Zone.scss";

/** Zone target component used by [[BackTarget]] and [[MergeTarget]] components.
 * @internal
 */
export class ZoneTarget extends React.PureComponent<MergeTargetProps> {
  public render() {
    return (
      <div
        className={classnames("nz-zones-target-zone", this.props.className)}
        style={this.props.style}
      >
        <WidgetTarget
          onTargetChanged={this.props.onTargetChanged}
        >
          {this.props.children}
        </WidgetTarget>
      </div>
    );
  }
}
