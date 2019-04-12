/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTarget, MergeTargetProps } from "./Target";
import { Arrow } from "./Arrow";
import "./Merge.scss";

/** Merge target.
 * @alpha
 */
export class Merge extends React.PureComponent<MergeTargetProps> {
  public render() {
    const mergeClassName = classnames(
      "nz-zones-target-merge",
      this.props.className);

    return (
      <MergeTarget
        className={mergeClassName}
        {...this.props}
      >
        <Arrow className="nz-arrow" />
        <Arrow className="nz-mirrored" />
      </MergeTarget>
    );
  }
}
