/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { CSSProperties } from "react";

import { FrontstageManager, ToolActivatedEventArgs } from "./FrontstageManager";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider, GhostOutlineProvider } from "./FrontstageComposer";
import { FrontstageDef } from "./FrontstageDef";
import { FrontstageZone } from "./FrontstageZone";
import { ContentLayout } from "./ContentLayout";

import NZ_Zones from "@bentley/ui-ninezone/lib/zones/Zones";
import NineZone from "@bentley/ui-ninezone/lib/zones/state/NineZone";

// -----------------------------------------------------------------------------
// Frontstage React component
// -----------------------------------------------------------------------------

export interface FrontStageWithDefProps {
  frontstageDef: FrontstageDef;
  nineZone: NineZone;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  ghostOutlineProvider: GhostOutlineProvider;
}

/** State for the FrontstageComposer component.
 */
export interface FrontStateWithDefState {
  toolId: string;
}

/** Frontstage React component with a FrontstageDef.
 */
export class FrontstageWithDef extends React.Component<FrontStageWithDefProps, FrontStateWithDefState> {

  public readonly state: Readonly<FrontStateWithDefState> = {
    toolId: "",
  };

  public componentDidMount(): void {
    FrontstageManager.ToolActivatedEvent.addListener(this.handleToolActivatedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.ToolActivatedEvent.removeListener(this.handleToolActivatedEvent);
  }

  private handleToolActivatedEvent = (args: ToolActivatedEventArgs) => {
    this.setState((_prevState, _props) => ({ toolId: args.toolId }));
  }

  // This uses ConfigurableUI to render the content
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

    const zones = [1, 2, 3, 4, 6, 7, 8, 9];
    return (
      <div style={divStyle}>
        {this.doContentLayoutRender()}

        <NZ_Zones style={zonesStyle}>
          {
            zones.map((zoneId) => (
              <FrontstageZone
                key={zoneId}
                zoneState={FrontstageManager.NineZoneStateManagement.getZone(zoneId, this.props.nineZone)}
                nineZone={this.props.nineZone}
                widgetChangeHandler={this.props.widgetChangeHandler}
                targetChangeHandler={this.props.targetChangeHandler}
                zoneDefProvider={this.props.zoneDefProvider}
                ghostOutlineProvider={this.props.ghostOutlineProvider}
              />
            ))
          }
        </NZ_Zones>
      </div>
    );
  }
}
