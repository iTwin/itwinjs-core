/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { ReactNode } from "react";

import { ZoneDef } from "./ZoneDef";
import { TargetChangeHandler, WidgetChangeHandler } from "./FrontstageComposer";
import ZoneTargets from "./ZoneTargets";
import { StatusBar } from "./StatusBar";

// import TemporaryMessage from "@bentley/ui-ninezone/messages/Temporary";
import NZ_ZoneState from "@bentley/ui-ninezone/lib/zones/state/Zone";
import NZ_FooterZone from "@bentley/ui-ninezone/lib/zones/Footer";
import { ZoneTargetProvider } from "./FrontstageZone";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import GhostOutline from "@bentley/ui-ninezone/lib/zones/GhostOutline";

export interface StatusBarZoneProps {
  zoneDef?: ZoneDef;
  zoneState: NZ_ZoneState;
  isInFooterMode: boolean;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  targetProvider: ZoneTargetProvider;
}

/** Status Bar Zone React component.
 */
export class StatusBarZone extends React.Component<StatusBarZoneProps, {}> {
  public render(): ReactNode {
    return (
      <>
        <NZ_FooterZone
          isInFooterMode={this.props.isInFooterMode}
          bounds={this.props.zoneState.floatingBounds || this.props.zoneState.bounds}
        >
          {
            this.props.zoneDef &&
            <StatusBar
              isInFooterMode={this.props.isInFooterMode}
              zoneDef={this.props.zoneDef}
            />
          }
        </NZ_FooterZone>
        <NZ_FooterZone bounds={this.props.zoneState.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneState.id}
            targetProvider={this.props.targetProvider}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </NZ_FooterZone>
        {
          this.props.targetedBounds &&
          <NZ_FooterZone bounds={this.props.targetedBounds}>
            <GhostOutline />
          </NZ_FooterZone>
        }
      </>
    );
  }
}
