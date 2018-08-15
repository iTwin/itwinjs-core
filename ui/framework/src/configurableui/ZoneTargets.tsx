/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { ZoneTargetProvider } from "./FrontstageZone";
import { TargetChangeHandler } from "./FrontstageComposer";

import ZoneTargetsContainer from "@bentley/ui-ninezone/lib/zones/target/Container";
import { DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Management";
import MergeTarget from "@bentley/ui-ninezone/lib/zones/target/Merge";
import UnmergeTarget from "@bentley/ui-ninezone/lib/zones/target/Unmerge";

/** Props for the ZoneTargets.
 */
export interface ZoneTargetsProps {
  zoneId: number;
  targetProvider: ZoneTargetProvider;
  targetChangeHandler: TargetChangeHandler;
}

/** Zone Targets React component.
 */
export default class ZoneTargets extends React.Component<ZoneTargetsProps> {
  public render(): React.ReactNode {
    return (
      <ZoneTargetsContainer>
        {this._getTargets()}
      </ZoneTargetsContainer>
    );
  }

  private _getTargets = () => {
    return this.props.targetProvider.getDropTargets(this.props.zoneId).map((dropTarget) => this.getTarget(dropTarget.widgetId, dropTarget.target));
  }

  private getTarget(widgetId: number, dropTarget: DropTarget) {
    switch (dropTarget) {
      case DropTarget.Merge:
        return (
          <MergeTarget
            key={widgetId}
            rows={3}
            columns={3}
            cells={this.props.targetProvider.getMergeTargetCells(widgetId)}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(widgetId, dropTarget, isTargeted)}
          />
        );
      case DropTarget.Unmerge:
        return (
          <UnmergeTarget
            key={widgetId}
            rows={3}
            columns={3}
            cells={this.props.targetProvider.getUnmergeTargetCells(widgetId)}
            onTargetChanged={(isTargeted) => this.props.targetChangeHandler.handleTargetChanged(widgetId, dropTarget, isTargeted)}
          />
        );
      case DropTarget.None:
      default:
        return undefined;
    }
  }
}
