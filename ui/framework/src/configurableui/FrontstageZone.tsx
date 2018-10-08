/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "./FrontstageComposer";
import { FrameworkZone } from "./FrameworkZone";
import { ToolSettingsZone } from "./ToolSettingsZone";
import { StatusBarZone } from "./StatusBarZone";

import { ZoneProps as NZ_ZoneState, isStatusZone, DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { HorizontalAnchor, VerticalAnchor } from "@bentley/ui-ninezone/lib/widget/Stacked";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import { PointProps } from "@bentley/ui-ninezone/lib/utilities/Point";

// -----------------------------------------------------------------------------
// Zone React Components
// -----------------------------------------------------------------------------

/** Props for the Frontstage Zone Component.
 */
export interface FrontstageZoneProps {
  zoneState: NZ_ZoneState;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  ghostOutline: RectangleProps | undefined;
  dropTarget: DropTarget;
  horizontalAnchor: HorizontalAnchor;
  verticalAnchor: VerticalAnchor;
  isDragged: boolean | undefined;
  lastPosition: PointProps | undefined;
  isUnmergeDrag: boolean;
}

/** Frontstage Zone React Component.
 */
export class FrontstageZone extends React.Component<FrontstageZoneProps> {
  public render(): React.ReactNode {
    if (this.props.zoneState.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneState.widgets[0].id);
      if (!zoneDef)
        return null;

      if (zoneDef.isToolSettings) {
        return (
          <ToolSettingsZone
            zoneDef={zoneDef}
            bounds={this.props.zoneState.bounds} />
        );
      } else if (zoneDef.isStatusBar) {
        if (!isStatusZone(this.props.zoneState))
          throw new TypeError();
        return (
          <StatusBarZone
            zoneDef={zoneDef}
            zoneState={this.props.zoneState}
            widgetChangeHandler={this.props.widgetChangeHandler}
            targetChangeHandler={this.props.targetChangeHandler}
            targetedBounds={this.props.ghostOutline}
            dropTarget={this.props.dropTarget}
          />
        );
      }
    }

    return (
      <FrameworkZone
        zoneState={this.props.zoneState}
        widgetChangeHandler={this.props.widgetChangeHandler}
        targetedBounds={this.props.ghostOutline}
        targetChangeHandler={this.props.targetChangeHandler}
        zoneDefProvider={this.props.zoneDefProvider}
        dropTarget={this.props.dropTarget}
        horizontalAnchor={this.props.horizontalAnchor}
        verticalAnchor={this.props.verticalAnchor}
        isDragged={this.props.isDragged}
        lastPosition={this.props.lastPosition}
        isUnmergeDrag={this.props.isUnmergeDrag}
      />
    );
  }
}
