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

import { ZoneProps as NZ_ZoneProps, isStatusZone, DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { HorizontalAnchor, VerticalAnchor } from "@bentley/ui-ninezone/lib/widget/Stacked";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import { PointProps } from "@bentley/ui-ninezone/lib/utilities/Point";
import { StatusBarWidgetControl } from "./StatusBarWidgetControl";
import { ConfigurableUiControlType } from "./ConfigurableUiControl";

// -----------------------------------------------------------------------------
// Zone React Components
// -----------------------------------------------------------------------------

/** Properties for the [[FrontstageZone]] component.
 */
export interface FrontstageZoneProps {
  zoneProps: NZ_ZoneProps;
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
    if (this.props.zoneProps.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneProps.widgets[0].id);
      if (!zoneDef)
        return null;

      if (zoneDef.isToolSettings) {
        return (
          <ToolSettingsZone
            bounds={this.props.zoneProps.bounds} />
        );
      } else if (zoneDef.isStatusBar) {
        if (!isStatusZone(this.props.zoneProps))
          throw new TypeError();

        const widgetDef = zoneDef.getOnlyWidgetDef();
        let widgetControl: StatusBarWidgetControl | undefined;
        if (widgetDef)
          widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

        return (
          <StatusBarZone
            widgetControl={widgetControl}
            zoneProps={this.props.zoneProps}
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
        zoneProps={this.props.zoneProps}
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
