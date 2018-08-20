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

/** Props for the FrameworkFrontstage component.
 */
export interface FrameworkFrontstageProps {
  frontstageDef: FrontstageDef;
  nineZone: NineZone;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  ghostOutlineProvider: GhostOutlineProvider;
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
    FrontstageManager.ToolActivatedEvent.addListener(this._handleToolActivatedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.ToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
  }

  private _handleToolActivatedEvent = (args: ToolActivatedEventArgs) => {
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
