/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { ReactNode } from "react";

import { ZoneDef } from "./ZoneDef";
import { TargetChangeHandler, WidgetChangeHandler } from "./FrontstageComposer";
import ZoneTargets from "./ZoneTargets";
import { StatusBar } from "./StatusBar";

// import TemporaryMessage from "@bentley/ui-ninezone/messages/Temporary";
import { StatusZoneProps as NZ_ZoneState, DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import NZ_FooterZone from "@bentley/ui-ninezone/lib/zones/Footer";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import GhostOutline from "@bentley/ui-ninezone/lib/zones/GhostOutline";

export interface StatusBarZoneProps {
  zoneDef?: ZoneDef;
  zoneState: NZ_ZoneState;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  dropTarget: DropTarget;
}

/** Status Bar Zone React component.
 */
export class StatusBarZone extends React.Component<StatusBarZoneProps, {}> {
  public render(): ReactNode {
    return (
      <>
        <NZ_FooterZone
          isInFooterMode={this.props.zoneState.isInFooterMode}
          bounds={this.props.zoneState.floating ? this.props.zoneState.floating.bounds : this.props.zoneState.bounds}
        >
          {
            this.props.zoneDef &&
            <StatusBar
              isInFooterMode={this.props.zoneState.isInFooterMode}
              zoneDef={this.props.zoneDef}
            />
          }
        </NZ_FooterZone>
        <NZ_FooterZone bounds={this.props.zoneState.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneState.id}
            dropTarget={this.props.dropTarget}
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
