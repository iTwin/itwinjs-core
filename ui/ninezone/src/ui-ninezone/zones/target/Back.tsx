/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTarget, MergeTargetProps } from "./Target";
import { Arrow } from "./Arrow";
import { WidgetZoneIndex } from "../state/NineZone";
import "./Back.scss";

/** Properties of [[Back]] component.
 * @alpha
 */
export interface BackProps extends MergeTargetProps {
  /** Rotation of back arrow depends on specified zone index. */
  zoneIndex: WidgetZoneIndex;
}

/** Back home target.
 * @alpha
 */
export class Back extends React.PureComponent<BackProps> {
  public render() {
    const mergeClassName = classnames(
      "nz-zones-target-back",
      `nz-zone-${this.props.zoneIndex}`,
      this.props.className);

    return (
      <MergeTarget
        className={mergeClassName}
        {...this.props}
      >
        <Arrow className="nz-arrow" />
      </MergeTarget>
    );
  }
}
