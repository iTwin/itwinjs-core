/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";

import { TargetChangeHandler, WidgetChangeHandler } from "./FrontstageComposer";
import ZoneTargets from "./ZoneTargets";
import { StatusBar } from "./StatusBar";
import { StatusBarWidgetControl } from "./StatusBarWidgetControl";

// import TemporaryMessage from "@bentley/ui-ninezone/messages/Temporary";
import { StatusZoneProps as NZ_ZoneProps, DropTarget, FooterZone as NZ_FooterZone, RectangleProps, GhostOutline } from "@bentley/ui-ninezone";

/** Properties for the [[StatusBarZone]] component */
export interface StatusBarZoneProps {
  widgetControl?: StatusBarWidgetControl;
  zoneProps: NZ_ZoneProps;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  dropTarget: DropTarget;
}

/** Status Bar Zone React component.
 */
export class StatusBarZone extends React.Component<StatusBarZoneProps, {}> {
  public render(): React.ReactNode {
    return (
      <>
        <NZ_FooterZone
          isInFooterMode={this.props.zoneProps.isInFooterMode}
          bounds={this.props.zoneProps.floating ? this.props.zoneProps.floating.bounds : this.props.zoneProps.bounds}
        >
          {
            this.props.widgetControl &&
            <StatusBar
              isInFooterMode={this.props.zoneProps.isInFooterMode}
              widgetControl={this.props.widgetControl}
            />
          }
        </NZ_FooterZone>
        <NZ_FooterZone bounds={this.props.zoneProps.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneProps.id}
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
