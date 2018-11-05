/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { CSSProperties } from "react";

import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "./FrontstageComposer";
import { FrontstageDef } from "./FrontstageDef";
import { FrontstageZone } from "./FrontstageZone";
import { ContentLayout } from "./ContentLayout";

import NZ_Zones from "@bentley/ui-ninezone/lib/zones/Zones";
import NineZone, { NineZoneProps, WidgetZoneIndex } from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import { WidgetZone } from "@bentley/ui-ninezone/lib/zones/state/Zone";

// -----------------------------------------------------------------------------
// Frontstage React component
// -----------------------------------------------------------------------------

/** Properties for the [[FrameworkFrontstage]] component.
 */
export interface FrameworkFrontstageProps {
  frontstageDef: FrontstageDef;
  nineZoneProps: NineZoneProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
}

/** Frontstage React component with a FrontstageDef.
 */
export class FrameworkFrontstage extends React.Component<FrameworkFrontstageProps> {

  // This uses ConfigurableUi to render the content
  private doContentLayoutRender(): any {
    return (
      <ContentLayout
        contentLayout={this.props.frontstageDef.defaultLayout!}
        contentGroup={this.props.frontstageDef.contentGroup!}
        isInFooterMode={this.props.frontstageDef.isInFooterMode}
      />
    );
  }

  public render(): React.ReactNode {
    if (!this.props.frontstageDef)
      return null;

    const divStyle: CSSProperties = {
      position: "relative",
      height: "100%",
    };

    const zonesStyle: CSSProperties = {
      position: "relative",
      pointerEvents: "none",
    };

    const zones = Object.keys(this.props.nineZoneProps.zones)
      .map((key) => Number(key) as WidgetZoneIndex)
      .sort((id1, id2) => {
        const z1 = this.props.nineZoneProps.zones[id1];
        const z2 = this.props.nineZoneProps.zones[id2];
        if (!z1.floating && !z2.floating)
          return z1.id - z2.id;

        if (!z1.floating)
          return -1;

        if (!z2.floating)
          return 1;

        return z1.floating.stackId - z2.floating.stackId;
      });
    const nineZone = new NineZone(this.props.nineZoneProps);
    return (
      <div style={divStyle}>
        {this.doContentLayoutRender()}

        <NZ_Zones style={zonesStyle}>
          {
            zones.map((zoneId) => {
              const zone: WidgetZone = nineZone.getWidgetZone(zoneId);
              const isDragged = this.props.nineZoneProps.draggingWidget && this.props.nineZoneProps.draggingWidget.id === zoneId;
              const lastPosition = isDragged ? this.props.nineZoneProps.draggingWidget!.lastPosition : undefined;
              const isUnmergeDrag = isDragged ? this.props.nineZoneProps.draggingWidget!.isUnmerge : false;
              const ghostOutline = zone.getGhostOutlineBounds();
              const dropTarget = zone.getDropTarget();
              return (
                <FrontstageZone
                  key={zoneId}
                  zoneProps={this.props.nineZoneProps.zones[zoneId]}
                  widgetChangeHandler={this.props.widgetChangeHandler}
                  targetChangeHandler={this.props.targetChangeHandler}
                  zoneDefProvider={this.props.zoneDefProvider}
                  ghostOutline={ghostOutline}
                  dropTarget={dropTarget}
                  horizontalAnchor={zone.horizontalAnchor}
                  verticalAnchor={zone.verticalAnchor}
                  isDragged={isDragged}
                  lastPosition={lastPosition}
                  isUnmergeDrag={isUnmergeDrag}
                />
              );
            })
          }
        </NZ_Zones>
      </div>
    );
  }
}
