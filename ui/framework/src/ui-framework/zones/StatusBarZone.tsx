/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { TargetChangeHandler, WidgetChangeHandler } from "../frontstage/FrontstageComposer";
import { ZoneTargets } from "../dragdrop/ZoneTargets";
import { StatusBar } from "../widgets/StatusBar";
import { StatusBarWidgetControl } from "../widgets/StatusBarWidgetControl";

// import TemporaryMessage from "@bentley/ui-ninezone/messages/Temporary";
import { StatusZoneManagerProps as NZ_ZoneProps, DropTarget, StatusZone, RectangleProps, GhostOutline } from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[StatusBarZone]] component
 * @internal
 */
export interface StatusBarZoneProps extends CommonProps {
  widgetControl?: StatusBarWidgetControl;
  zoneProps: NZ_ZoneProps;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  dropTarget: DropTarget;
}

/** Status Bar Zone React component.
 * @internal
 */
export class StatusBarZone extends React.Component<StatusBarZoneProps> {
  public render(): React.ReactNode {
    return (
      <>
        <StatusZone
          className={this.props.className}
          style={this.props.style}
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
        </StatusZone>
        <StatusZone bounds={this.props.zoneProps.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneProps.id}
            dropTarget={this.props.dropTarget}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </StatusZone>
        {
          this.props.targetedBounds &&
          <StatusZone bounds={this.props.targetedBounds}>
            <GhostOutline />
          </StatusZone>
        }
      </>
    );
  }
}
