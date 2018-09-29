/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { TargetChangeHandler } from "./FrontstageComposer";

import ZoneTargetsContainer from "@bentley/ui-ninezone/lib/zones/target/Container";
import MergeTarget from "@bentley/ui-ninezone/lib/zones/target/Merge";
import BackTarget from "@bentley/ui-ninezone/lib/zones/target/Back";
import { WidgetZoneIndex } from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import { DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { TargetType } from "@bentley/ui-ninezone/lib/zones/state/Target";

/** Props for the ZoneTargets.
 */
export interface ZoneTargetsProps {
  zoneId: WidgetZoneIndex;
  dropTarget: DropTarget;
  targetChangeHandler: TargetChangeHandler;
}

/** Zone Targets React component.
 */
export default class ZoneTargets extends React.Component<ZoneTargetsProps> {
  public render(): React.ReactNode {
    return (
      <ZoneTargetsContainer>
        {this.getTarget()}
      </ZoneTargetsContainer>
    );
  }

  private getTarget() {
    switch (this.props.dropTarget) {
      case DropTarget.Merge:
        return (
          <MergeTarget
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, TargetType.Merge, isTargeted)}
          />
        );
      case DropTarget.Back:
        return (
          <BackTarget
            zoneIndex={this.props.zoneId}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, TargetType.Back, isTargeted)}
          />
        );
      case DropTarget.None:
      default:
        return undefined;
    }
  }
}
