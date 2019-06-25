/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { WidgetZoneIndex } from "../manager/Zones";
import { Arrow } from "./Arrow";
import { MergeTargetProps } from "./Merge";
import { ZoneTarget } from "./Zone";

/** Properties of [[BackTarget]] component.
 * @alpha
 */
export interface BackTargetProps extends MergeTargetProps {
  /** Describes back target arrow rotation. */
  zoneIndex: WidgetZoneIndex;
}

/** Zone target used to merge widget back to initial zone.
 * @alpha
 */
export class BackTarget extends React.PureComponent<BackTargetProps> {
  public render() {
    const { className, ...props } = this.props;
    const targetClassName = classnames(
      "nz-zones-target-back",
      this.props.className);

    return (
      <ZoneTarget
        className={targetClassName}
        {...props}
      >
        <Arrow zoneIndex={this.props.zoneIndex} />
      </ZoneTarget>
    );
  }
}
