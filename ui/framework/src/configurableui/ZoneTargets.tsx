/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { TargetChangeHandler } from "./FrontstageComposer";

import ZoneTargetsContainer from "@bentley/ui-ninezone/lib/zones/target/Container";
import MergeTarget from "@bentley/ui-ninezone/lib/zones/target/Merge";
import BackTarget from "@bentley/ui-ninezone/lib/zones/target/Back";
import { WidgetZoneIndex } from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import { DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";

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
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, DropTarget.Merge, isTargeted)}
          />
        );
      case DropTarget.Back:
        return (
          <BackTarget
            zoneIndex={this.props.zoneId}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(this.props.zoneId, DropTarget.Back, isTargeted)}
          />
        );
      case DropTarget.None:
      default:
        return undefined;
    }
  }
}
