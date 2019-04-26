/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { TargetChangeHandler } from "../frontstage/FrontstageComposer";

import { MergeTarget, BackTarget, WidgetZoneIndex, DropTarget, TargetType } from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[ZoneTargets]] component.
 * @internal
 */
export interface ZoneTargetsProps extends CommonProps {
  zoneId: WidgetZoneIndex;
  dropTarget: DropTarget;
  targetChangeHandler: TargetChangeHandler;
}

/** Zone Targets React component.
 * @internal
 */
export class ZoneTargets extends React.Component<ZoneTargetsProps> {
  public render(): React.ReactNode {
    switch (this.props.dropTarget) {
      case DropTarget.Merge:
        return (
          <MergeTarget
            className={this.props.className}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, TargetType.Merge, isTargeted)}
            style={this.props.style}
          />
        );
      case DropTarget.Back:
        return (
          <BackTarget
            className={this.props.className}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, TargetType.Back, isTargeted)}
            style={this.props.style}
            zoneIndex={this.props.zoneId}
          />
        );
      case DropTarget.None:
      default:
        return null;
    }
  }
}
