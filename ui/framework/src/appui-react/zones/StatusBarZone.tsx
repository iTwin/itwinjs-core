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
  public override render(): React.ReactNode {
    const bounds = getFloatingZoneBounds(this.props.zoneProps);
    return (
      <SafeAreaContext.Consumer>
        {(safeAreaInsets) => (
          <>
            <Zone
              bounds={this.props.isInFooterMode ? undefined : bounds}
              className={this.props.className}
              id={this.props.zoneProps.id}
              isHidden={this.props.isHidden}
              isInFooterMode={this.props.isInFooterMode}
              safeAreaInsets={safeAreaInsets}
            >
              {
                this.props.widgetControl &&
                <StatusBar
                  isInFooterMode={this.props.isInFooterMode}
                  widgetControl={this.props.widgetControl}
                />
              }
            </Zone>
            <Zone
              bounds={this.props.zoneProps.bounds}
              id={this.props.zoneProps.id}
              isInFooterMode={this.props.isInFooterMode}
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
