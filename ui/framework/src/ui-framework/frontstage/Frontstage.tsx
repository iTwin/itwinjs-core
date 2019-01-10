/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { ContentLayoutDef, ContentLayout } from "../content/ContentLayout";
import { ContentGroup } from "../content/ContentGroup";
import { FrontstageRuntimeProps } from "./FrontstageComposer";
import { FrontstageDef } from "./FrontstageDef";
import { ZoneDef } from "../zones/ZoneDef";
import { Zone, ZoneProps, ZoneRuntimeProps } from "../zones/Zone";

import { Zones as NZ_Zones, NineZone, WidgetZoneIndex, WidgetZone } from "@bentley/ui-ninezone";

/** Enum for Zone Location. Useful for zone merging.
 */
export enum ZoneLocation {
  TopLeft = 1,
  TopCenter = 2,
  TopRight = 3,
  CenterLeft = 4,
  CenterRight = 6,
  BottomLeft = 7,
  BottomCenter = 8,
  BottomRight = 9,
}

/** Properties for a [[Frontstage]] component.
 */
export interface FrontstageProps {
  /** Id for the Frontstage */
  id: string;
  /** ToolId that is started once the Frontstage is activated */
  defaultToolId: string;
  /** The default Content Layout used */
  defaultLayout: string | ContentLayoutDef;
  /** The Content Group providing the Content Views */
  contentGroup: string | ContentGroup;
  /** Id of the Content View to be activated initially */
  defaultContentId?: string;
  /** Indicated whether the StatusBar is in footer mode or widget mode. Defaults to true. */
  isInFooterMode?: boolean;                     // Default - true
  /** Any application data to attach to this Frontstage. */
  applicationData?: any;

  /** The Zone in the top-left corner. */
  topLeft?: React.ReactElement<ZoneProps>;
  /** The Zone along the top-center edge. */
  topCenter?: React.ReactElement<ZoneProps>;
  /** The Zone in the top-right corner. */
  topRight?: React.ReactElement<ZoneProps>;
  /** The Zone along the center-left edge. */
  centerLeft?: React.ReactElement<ZoneProps>;
  /** The Zone along the center-right edge. */
  centerRight?: React.ReactElement<ZoneProps>;
  /** The Zone in the bottom-left corner. */
  bottomLeft?: React.ReactElement<ZoneProps>;
  /** The Zone along the bottom-center edge. */
  bottomCenter?: React.ReactElement<ZoneProps>;
  /** The Zone in the bottom-right corner. */
  bottomRight?: React.ReactElement<ZoneProps>;

  /** @hidden */
  runtimeProps?: FrontstageRuntimeProps;
}

/** ConfigurableUi Frontstage React component.
 */
export class Frontstage extends React.Component<FrontstageProps> {

  constructor(props: FrontstageProps) {
    super(props);
  }

  public static initializeFrontstageDef(frontstageDef: FrontstageDef, props: FrontstageProps): void {
    frontstageDef.id = props.id;

    frontstageDef.defaultToolId = props.defaultToolId;

    if (props.defaultContentId !== undefined)
      frontstageDef.defaultContentId = props.defaultContentId;

    if (typeof props.defaultLayout === "string")
      frontstageDef.defaultLayoutId = props.defaultLayout;
    else
      frontstageDef.defaultLayout = props.defaultLayout;

    if (typeof props.contentGroup === "string")
      frontstageDef.contentGroupId = props.contentGroup;
    else
      frontstageDef.contentGroup = props.contentGroup;

    if (props.isInFooterMode !== undefined)
      frontstageDef.isInFooterMode = props.isInFooterMode;
    if (props.applicationData !== undefined)
      frontstageDef.applicationData = props.applicationData;

    frontstageDef.topLeft = Frontstage.createZoneDef(props.topLeft, ZoneLocation.TopLeft, props);
    frontstageDef.topCenter = Frontstage.createZoneDef(props.topCenter, ZoneLocation.TopCenter, props);
    frontstageDef.topRight = Frontstage.createZoneDef(props.topRight, ZoneLocation.TopRight, props);
    frontstageDef.centerLeft = Frontstage.createZoneDef(props.centerLeft, ZoneLocation.CenterLeft, props);
    frontstageDef.centerRight = Frontstage.createZoneDef(props.centerRight, ZoneLocation.CenterRight, props);
    frontstageDef.bottomLeft = Frontstage.createZoneDef(props.bottomLeft, ZoneLocation.BottomLeft, props);
    frontstageDef.bottomCenter = Frontstage.createZoneDef(props.bottomCenter, ZoneLocation.BottomCenter, props);
    frontstageDef.bottomRight = Frontstage.createZoneDef(props.bottomRight, ZoneLocation.BottomRight, props);
  }

  private static createZoneDef(zoneNode: React.ReactElement<ZoneProps> | undefined, zoneLocation: ZoneLocation, props: FrontstageProps): ZoneDef | undefined {
    if (zoneNode) {
      const zoneDef = new ZoneDef();
      const zoneElement = Frontstage.getZoneElement(zoneLocation, props);
      if (zoneElement && React.isValidElement(zoneElement)) {
        Zone.initializeZoneDef(zoneDef, zoneElement.props);
        return zoneDef;
      }
    }

    return undefined;
  }

  private static getZoneElement(zoneId: WidgetZoneIndex, props: FrontstageProps): React.ReactElement<ZoneProps> | undefined {
    let zoneElement: React.ReactElement<ZoneProps> | undefined;

    switch (zoneId) {
      case ZoneLocation.TopLeft:
        zoneElement = props.topLeft;
        break;
      case ZoneLocation.TopCenter:
        zoneElement = props.topCenter;
        break;
      case ZoneLocation.TopRight:
        zoneElement = props.topRight;
        break;
      case ZoneLocation.CenterLeft:
        zoneElement = props.centerLeft;
        break;
      case ZoneLocation.CenterRight:
        zoneElement = props.centerRight;
        break;
      case ZoneLocation.BottomLeft:
        zoneElement = props.bottomLeft;
        break;
      case ZoneLocation.BottomCenter:
        zoneElement = props.bottomCenter;
        break;
      case ZoneLocation.BottomRight:
        zoneElement = props.bottomRight;
        break;
      default:
        throw new RangeError();
    }

    // Zones can be undefined in a Frontstage

    return zoneElement;
  }

  // This uses ConfigurableUi to render the content
  private doContentLayoutRender(): any {
    if (this.props.runtimeProps && this.props.runtimeProps.frontstageDef) {
      const frontstageDef = this.props.runtimeProps.frontstageDef;
      return (
        <ContentLayout
          contentLayout={frontstageDef.defaultLayout!}
          contentGroup={frontstageDef.contentGroup!}
          isInFooterMode={frontstageDef.isInFooterMode}
        />
      );
    }
  }

  public render(): React.ReactNode {
    const { runtimeProps } = this.props;

    if (runtimeProps === undefined)
      return null;

    const divStyle: React.CSSProperties = {
      position: "relative",
      height: "100%",
    };

    const zonesStyle: React.CSSProperties = {
      position: "relative",
      pointerEvents: "none",
    };

    const zones = Object.keys(runtimeProps.nineZoneProps.zones)
      .map((key) => Number(key) as WidgetZoneIndex)
      .sort((id1, id2) => {
        const z1 = runtimeProps.nineZoneProps.zones[id1];
        const z2 = runtimeProps.nineZoneProps.zones[id2];
        if (!z1.floating && !z2.floating)
          return z1.id - z2.id;

        if (!z1.floating)
          return -1;

        if (!z2.floating)
          return 1;

        return z1.floating.stackId - z2.floating.stackId;
      });
    const nineZone = new NineZone(runtimeProps.nineZoneProps);
    return (
      <div style={divStyle}>
        {this.doContentLayoutRender()}

        <NZ_Zones style={zonesStyle}>
          {
            zones.map((zoneId: WidgetZoneIndex) => {
              const zoneElement = Frontstage.getZoneElement(zoneId, this.props) as React.ReactElement<ZoneProps>;
              if (!zoneElement || !React.isValidElement(zoneElement))
                return null;

              const zoneDef = runtimeProps.zoneDefProvider.getZoneDef(zoneId);
              if (!zoneDef)
                return null;

              const zone: WidgetZone = nineZone.getWidgetZone(zoneId);
              const isDragged = runtimeProps.nineZoneProps.draggingWidget && runtimeProps.nineZoneProps.draggingWidget.id === zoneId;
              const lastPosition = isDragged ? runtimeProps.nineZoneProps.draggingWidget!.lastPosition : undefined;
              const isUnmergeDrag = isDragged ? runtimeProps.nineZoneProps.draggingWidget!.isUnmerge : false;
              const ghostOutline = zone.getGhostOutlineBounds();
              const dropTarget = zone.getDropTarget();
              const zoneRuntimeProps: ZoneRuntimeProps = {
                zoneDef,
                zoneProps: runtimeProps.nineZoneProps.zones[zoneId],
                widgetChangeHandler: runtimeProps.widgetChangeHandler,
                targetChangeHandler: runtimeProps.targetChangeHandler,
                zoneDefProvider: runtimeProps.zoneDefProvider,
                ghostOutline,
                dropTarget,
                horizontalAnchor: zone.horizontalAnchor,
                verticalAnchor: zone.verticalAnchor,
                isDragged,
                lastPosition,
                isUnmergeDrag,
              };
              return React.cloneElement(zoneElement, { key: zoneId, runtimeProps: zoneRuntimeProps });
            })
          }
        </NZ_Zones>
      </div>
    );
  }

}
