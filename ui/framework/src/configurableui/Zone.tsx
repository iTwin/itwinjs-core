/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import { ZoneState, ZoneDef } from "./ZoneDef";
import { WidgetDef } from "./WidgetDef";
import { ConfigurableUiControlType } from "./ConfigurableUiControl";
import { FrameworkZone } from "./FrameworkZone";
import { StatusBarWidgetControl } from "./StatusBarWidgetControl";
import { WidgetProps, Widget } from "./Widget";
import { ZoneLocation } from "./Frontstage";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "./FrontstageComposer";
import { ToolSettingsZone } from "./ToolSettingsZone";
import { StatusBarZone } from "./StatusBarZone";

import { isStatusZone } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { ZoneProps as NZ_ZoneProps, DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { HorizontalAnchor, VerticalAnchor } from "@bentley/ui-ninezone/lib/widget/Stacked";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import { PointProps } from "@bentley/ui-ninezone/lib/utilities/Point";

/** Properties of a [[Zone]] component
 */
export interface ZoneProps {
  /** Default Zone state. Controls how the Zone is initially displayed. Defaults to ZoneState.Open. */
  defaultState?: ZoneState;
  /** Indicates if other Zones may be merged with this Zone. Defaults to false.  */
  allowsMerging?: boolean;
  /** Any application data to attach to this Zone. */
  applicationData?: any;
  /** Indicates with which other zone to merge. */
  mergeWithZone?: ZoneLocation;

  /** Properties for the Widgets in this Zone. */
  widgets?: Array<React.ReactElement<WidgetProps>>;

  /** @hidden */
  runtimeProps?: ZoneRuntimeProps;
}

/** Runtime Properties for the [[Zone]] component.
 */
export interface ZoneRuntimeProps {
  zoneDef: ZoneDef;
  zoneProps: NZ_ZoneProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  ghostOutline: RectangleProps | undefined;
  dropTarget: DropTarget;
  horizontalAnchor: HorizontalAnchor;
  verticalAnchor: VerticalAnchor;
  isDragged: boolean | undefined;
  lastPosition: PointProps | undefined;
  isUnmergeDrag: boolean;
}

/** ConfigurableUi Zone React component.
 */
export class Zone extends React.Component<ZoneProps> {

  constructor(props: ZoneProps) {
    super(props);
  }

  public static initializeZoneDef(zoneDef: ZoneDef, props: ZoneProps): void {
    if (props.defaultState)
      zoneDef.zoneState = props.defaultState;
    if (props.allowsMerging !== undefined)
      zoneDef.allowsMerging = props.allowsMerging;
    if (props.applicationData !== undefined)
      zoneDef.applicationData = props.applicationData;
    if (props.mergeWithZone !== undefined)
      zoneDef.mergeWithZone = props.mergeWithZone;

    if (props.widgets) {
      props.widgets.forEach((widgetNode: React.ReactElement<WidgetProps>) => {
        const widgetDef = Zone.createWidgetDef(widgetNode);
        if (widgetDef) {
          zoneDef.addWidgetDef(widgetDef);
        }
      });
    }
  }

  private static createWidgetDef(widgetNode: React.ReactElement<WidgetProps>): WidgetDef | undefined {
    if (widgetNode && React.isValidElement(widgetNode)) {
      const widgetDef = new WidgetDef(widgetNode.props);
      Widget.initializeWidgetDef(widgetDef, widgetNode.props);
      return widgetDef;
    }

    return undefined;
  }

  public render(): React.ReactNode {
    const { runtimeProps } = this.props;

    if (!runtimeProps)
      return null;

    const { zoneDef } = runtimeProps;

    if (runtimeProps.zoneProps.widgets.length === 1) {
      if (zoneDef.isToolSettings) {
        return (
          <ToolSettingsZone
            bounds={runtimeProps.zoneProps.bounds} />
        );
      } else if (zoneDef.isStatusBar) {
        if (!isStatusZone(runtimeProps.zoneProps))
          throw new TypeError();

        let widgetControl: StatusBarWidgetControl | undefined;
        const widgetDef = zoneDef.getOnlyWidgetDef();
        if (widgetDef)
          widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

        return (
          <StatusBarZone
            widgetControl={widgetControl}
            zoneProps={runtimeProps.zoneProps}
            widgetChangeHandler={runtimeProps.widgetChangeHandler}
            targetChangeHandler={runtimeProps.targetChangeHandler}
            targetedBounds={runtimeProps.ghostOutline}
            dropTarget={runtimeProps.dropTarget}
          />
        );
      }
    }

    return (
      <FrameworkZone
        zoneProps={runtimeProps.zoneProps}
        widgetChangeHandler={runtimeProps.widgetChangeHandler}
        targetedBounds={runtimeProps.ghostOutline}
        targetChangeHandler={runtimeProps.targetChangeHandler}
        zoneDefProvider={runtimeProps.zoneDefProvider}
        dropTarget={runtimeProps.dropTarget}
        horizontalAnchor={runtimeProps.horizontalAnchor}
        verticalAnchor={runtimeProps.verticalAnchor}
        isDragged={runtimeProps.isDragged}
        lastPosition={runtimeProps.lastPosition}
        isUnmergeDrag={runtimeProps.isUnmergeDrag}
      />
    );
  }
}
