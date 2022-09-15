/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { CommonProps, RectangleProps } from "@itwin/core-react";
import { Zone, ZoneManagerProps, ZoneTargetType } from "@itwin/appui-layout-react";
import { TargetChangeHandler, WidgetChangeHandler } from "../frontstage/FrontstageComposer";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { StatusBar } from "../statusbar/StatusBar";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";
import { getFloatingZoneBounds } from "./FrameworkZone";
import { Outline } from "./Outline";
import { ZoneTargets } from "../dragdrop/ZoneTargets";

// cspell:ignore safearea

/** Properties for the [[StatusBarZone]] component
 * @internal
 */
export interface StatusBarZoneProps extends CommonProps {
  dropTarget: ZoneTargetType | undefined; // eslint-disable-line deprecation/deprecation
  isHidden: boolean;
  targetChangeHandler: TargetChangeHandler; // eslint-disable-line deprecation/deprecation
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler; // eslint-disable-line deprecation/deprecation
  widgetControl?: StatusBarWidgetControl;
  zoneProps: ZoneManagerProps;
}

/** Status Bar Zone React component.
 * @internal
 */
export class StatusBarZone extends React.PureComponent<StatusBarZoneProps> {
  public override render(): React.ReactNode {
    return (
      <SafeAreaContext.Consumer>
        {(safeAreaInsets) => (
          <>
            <Zone
              className={this.props.className}
              id={this.props.zoneProps.id}
              isHidden={this.props.isHidden}
              safeAreaInsets={safeAreaInsets}
            >
              {
                this.props.widgetControl &&
                <StatusBar
                  widgetControl={this.props.widgetControl}
                />
              }
            </Zone>
            <Zone
              bounds={this.props.zoneProps.bounds}
              id={this.props.zoneProps.id}
              safeAreaInsets={safeAreaInsets}
            >
              <ZoneTargets
                zoneId={this.props.zoneProps.id}
                dropTarget={this.props.dropTarget}
                targetChangeHandler={this.props.targetChangeHandler}
              />
            </Zone>
            <Outline bounds={this.props.targetedBounds} />
          </>
        )}
      </SafeAreaContext.Consumer>
    );
  }
}
