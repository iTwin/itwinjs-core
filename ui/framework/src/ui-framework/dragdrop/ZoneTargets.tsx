/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { TargetChangeHandler } from "../frontstage/FrontstageComposer";

import { MergeTarget, BackTarget, WidgetZoneId, ZoneTargetType } from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[ZoneTargets]] component.
 * @internal
 */
export interface ZoneTargetsProps extends CommonProps {
  zoneId: WidgetZoneId;
  dropTarget: ZoneTargetType | undefined;
  targetChangeHandler: TargetChangeHandler;
}

/** Zone Targets React component.
 * @internal
 */
export class ZoneTargets extends React.Component<ZoneTargetsProps> {
  public render(): React.ReactNode {
    switch (this.props.dropTarget) {
      case ZoneTargetType.Merge:
        return (
          <MergeTarget
            className={this.props.className}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, ZoneTargetType.Merge, isTargeted)}
            style={this.props.style}
          />
        );
      case ZoneTargetType.Back:
        return (
          <BackTarget
            className={this.props.className}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, ZoneTargetType.Back, isTargeted)}
            style={this.props.style}
            zoneIndex={this.props.zoneId}
          />
        );
      default:
        return null;
    }
  }
}
