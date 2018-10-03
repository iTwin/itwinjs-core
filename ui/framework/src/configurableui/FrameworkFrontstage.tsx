/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { CSSProperties } from "react";

import { FrontstageManager, ToolActivatedEventArgs } from "./FrontstageManager";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "./FrontstageComposer";
import { FrontstageDef } from "./FrontstageDef";
import { FrontstageZone } from "./FrontstageZone";
import { ContentLayout } from "./ContentLayout";

import NZ_Zones from "@bentley/ui-ninezone/lib/zones/Zones";
import NineZone, { NineZoneProps, WidgetZoneIndex } from "@bentley/ui-ninezone/lib/zones/state/NineZone";

// -----------------------------------------------------------------------------
// Frontstage React component
// -----------------------------------------------------------------------------

/** Props for the FrameworkFrontstage component.
 */
export interface FrameworkFrontstageProps {
  frontstageDef: FrontstageDef;
  nineZone: NineZoneProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
}

/** State for the FrameworkFrontstage component.
 */
export interface FrameworkFrontstageState {
  toolId: string;
}

/** Frontstage React component with a FrontstageDef.
 */
export class FrameworkFrontstage extends React.Component<FrameworkFrontstageProps, FrameworkFrontstageState> {

  /** hidden */
  public readonly state: Readonly<FrameworkFrontstageState> = {
    toolId: "",
  };

  public componentDidMount(): void {
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.onToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
  }

  private _handleToolActivatedEvent = (args: ToolActivatedEventArgs) => {
    this.setState((_prevState, _props) => ({ toolId: args.toolId }));
  }

  // This uses ConfigurableUi to render the content
  private doContentLayoutRender(): any {
    // if (ProtogistApp.store.getState().contentState!.layoutDef)
    //   return undefined;

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

    const zones: WidgetZoneIndex[] = [1, 2, 3, 4, 6, 7, 8, 9];
    const nineZone = new NineZone(this.props.nineZone);
    return (
      <div style={divStyle}>
        {this.doContentLayoutRender()}

        <NZ_Zones style={zonesStyle}>
          {
            zones.map((zoneId) => {
              const zone = nineZone.getWidgetZone(zoneId);
              const isDragged = this.props.nineZone.draggingWidget && this.props.nineZone.draggingWidget.id === zoneId;
              const lastPosition = isDragged ? this.props.nineZone.draggingWidget!.lastPosition : undefined;
              const isUnmergeDrag = isDragged ? this.props.nineZone.draggingWidget!.isUnmerge : false;
              const ghostOutline = zone.getGhostOutlineBounds();
              const dropTarget = zone.getDropTarget();
              return (
                <FrontstageZone
                  key={zoneId}
                  zoneState={this.props.nineZone.zones[zoneId]}
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
