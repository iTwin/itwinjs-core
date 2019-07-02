/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { Arrow } from "./Arrow";
import { MergeTargetProps } from "./Merge";
import { ZoneTarget } from "./Zone";
import "./SplitterPane.scss";

/** Visual target component used to merge widgets in a splitter pane.
 * @beta
 */
export class SplitterPaneTarget extends React.PureComponent<MergeTargetProps> {
  public render() {
    const { className, ...props } = this.props;
    const targetClassName = classnames("nz-zones-target-splitterPane",
      className);
    return (
      <ZoneTarget
        className={targetClassName}
        {...props}
      >
        <Arrow zoneIndex={6} />
        <Arrow zoneIndex={4} />
        <div className="nz-overlay" />
      </ZoneTarget>
    );
  }
}
