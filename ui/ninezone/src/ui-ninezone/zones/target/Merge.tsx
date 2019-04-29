/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Arrow } from "./Arrow";
import { ZoneTarget } from "./Target";

/** Properties of [[MergeTarget]] component.
 * @beta
 */
export interface MergeTargetProps extends CommonProps {
  /** Function called when component is targeted or untargeted. */
  onTargetChanged?: (isTargeted: boolean) => void;
}

/** Zone target used to merge widgets.
 * @beta
 */
export class MergeTarget extends React.PureComponent<MergeTargetProps> {
  public render() {
    const { className, ...props } = this.props;
    const targetClassName = classnames(
      "nz-zones-target-merge",
      className);

    return (
      <ZoneTarget
        className={targetClassName}
        {...props}
      >
        <Arrow zoneIndex={6} />
        <Arrow zoneIndex={4} />
      </ZoneTarget>
    );
  }
}
