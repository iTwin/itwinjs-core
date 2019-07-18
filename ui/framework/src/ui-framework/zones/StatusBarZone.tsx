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
import { ZoneManagerProps, ZoneTargetType, Zone, Rectangle, RectangleProps, Outline } from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[StatusBarZone]] component
 * @internal
 */
export interface StatusBarZoneProps extends CommonProps {
  dropTarget: ZoneTargetType | undefined;
  isHidden: boolean;
  isInFooterMode: boolean;
  targetChangeHandler: TargetChangeHandler;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  widgetControl?: StatusBarWidgetControl;
  zoneProps: ZoneManagerProps;
}

/** Status Bar Zone React component.
 * @internal
 */
export class StatusBarZone extends React.PureComponent<StatusBarZoneProps> {
  public render(): React.ReactNode {
    const bounds = Rectangle.create(this.props.zoneProps.floating ? this.props.zoneProps.floating.bounds : this.props.zoneProps.bounds);
    return (
      <>
        <Zone
          bounds={this.props.isInFooterMode ? undefined : bounds}
          className={this.props.className}
          isHidden={this.props.isHidden}
          isInFooterMode={this.props.isInFooterMode}
          style={{
            ...this.props.style,
            ...this.props.isInFooterMode ? { height: `${bounds.getHeight()}px` } : {},
          }}
        >
          {
            this.props.widgetControl &&
            <StatusBar
              isInFooterMode={this.props.isInFooterMode}
              widgetControl={this.props.widgetControl}
            />
          }
        </Zone>
        <Zone bounds={this.props.zoneProps.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneProps.id}
            dropTarget={this.props.dropTarget}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </Zone>
        {this.props.targetedBounds && <Outline bounds={this.props.targetedBounds} />}
      </>
    );
  }
}
