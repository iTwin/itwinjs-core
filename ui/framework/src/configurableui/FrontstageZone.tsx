/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider, GhostOutlineProvider } from "./FrontstageComposer";
import { ZoneWithDef } from "./ZoneWithDef";
import { ToolSettingsZone } from "./ToolSettingsZone";
import { StatusBarZone } from "./StatusBarZone";
import { FrontstageManager } from "./FrontstageManager";

import NZ_ZoneState from "@bentley/ui-ninezone/lib/zones/state/Zone";
import NineZone from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import { DropTarget as ZoneDropTarget } from "@bentley/ui-ninezone/lib/zones/state/Management";
import { MergeCell as MergeTargetCell } from "@bentley/ui-ninezone/lib/zones/target/Merge";
import { UnmergeCell as UnmergeTargetCell } from "@bentley/ui-ninezone/lib/zones/target/Unmerge";

// -----------------------------------------------------------------------------
// Zone React Components
// -----------------------------------------------------------------------------

/** Interface for a Zone Target provider */
export interface ZoneTargetProvider {
  getDropTargets(zoneId: number): Array<{ widgetId: number, target: ZoneDropTarget }>;
  getMergeTargetCells(widgetId: number): MergeTargetCell[];
  getUnmergeTargetCells(widgetId: number): UnmergeTargetCell[];
}

/** Props for the Frontstage Zone Component.
 */
export interface Props {
  zoneState: NZ_ZoneState;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  nineZone: NineZone;
  ghostOutlineProvider: GhostOutlineProvider;
}

/** Frontstage Zone React Component.
 */
export class FrontstageZone extends React.Component<Props> implements ZoneTargetProvider {
  public render(): React.ReactNode {
    if (this.props.zoneState.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneState.widgets[0].id);
      if (!zoneDef)
        return null;

      if (zoneDef.isToolSettings) {
        return (
          <ToolSettingsZone
            zoneDef={zoneDef}
            reactZoneState={this.props.zoneState} />
        );
      } else if (zoneDef.isStatusBar) {
        return (
          <StatusBarZone
            zoneDef={zoneDef}
            zoneState={this.props.zoneState}
            isInFooterMode={this.props.nineZone.isInFooterMode}
            widgetChangeHandler={this.props.widgetChangeHandler}
            targetChangeHandler={this.props.targetChangeHandler}
            targetedBounds={this.props.ghostOutlineProvider.getGhostOutlineBounds(this.props.zoneState.id)}
            targetProvider={this}
          />
        );
      }
    }

    return (
      <ZoneWithDef
        zoneState={this.props.zoneState}
        widgetChangeHandler={this.props.widgetChangeHandler}
        targetedBounds={this.props.ghostOutlineProvider.getGhostOutlineBounds(this.props.zoneState.id)}
        targetChangeHandler={this.props.targetChangeHandler}
        targetProvider={this}
        zoneDefProvider={this.props.zoneDefProvider}
      />
    );
  }

  public getDropTargets(zoneId: number): Array<{ widgetId: number, target: ZoneDropTarget }> {
    const zone = FrontstageManager.NineZoneStateManagement.getZone(zoneId, this.props.nineZone);
    const dropTargets = zone.widgets.map((widget) => ({
      widgetId: widget.id,
      target: FrontstageManager.NineZoneStateManagement.getDropTarget(widget.id, this.props.nineZone),
    }));
    return dropTargets;
  }

  public getMergeTargetCells(widgetId: number): MergeTargetCell[] {
    return FrontstageManager.NineZoneStateManagement.getMergeTargetCells(widgetId, this.props.nineZone);
  }

  public getUnmergeTargetCells(widgetId: number): UnmergeTargetCell[] {
    return FrontstageManager.NineZoneStateManagement.getUnmergeTargetCells(widgetId, this.props.nineZone);
  }
}
