/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { WidgetZoneIndex } from "../state/NineZone";
import "./Arrow.scss";

/** Properties of [[Arrow]] component.
 * @internal
 */
export interface ArrowProps extends CommonProps {
  /** Describes arrow rotation. */
  zoneIndex: WidgetZoneIndex;
}

/** Arrow icon used in [[MergeTarget]], [[BackTarget]] components.
 * @internal
 */
export class Arrow extends React.PureComponent<ArrowProps> {
  public render() {
    const className = classnames(
      "nz-zones-target-arrow",
      `nz-zone-${this.props.zoneIndex}`,
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      />
    );
  }
}
