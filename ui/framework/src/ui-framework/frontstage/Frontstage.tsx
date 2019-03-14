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
import { ToolItemDef } from "../shared/Item";
import { ZoneDef } from "../zones/ZoneDef";
import { Zone, ZoneProps, ZoneRuntimeProps, ZoneLocation } from "../zones/Zone";
import { Zones as NZ_Zones, NineZone, WidgetZoneIndex, WidgetZone } from "@bentley/ui-ninezone";
import { UiFramework, UiVisibilityEventArgs } from "../UiFramework";
import { StagePanelProps, StagePanel, StagePanelLocation, StagePanelRuntimeProps } from "../stagepanels/StagePanel";
import { StagePanelDef } from "../stagepanels/StagePanelDef";

/** Properties for a [[Frontstage]] component.
 */
export interface FrontstageProps {
  /** Id for the Frontstage */
  id: string;
  /** Tool that is started once the Frontstage is activated */
  defaultTool: ToolItemDef;
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

  /** The StagePanel on the top of the 9-zone area. */
  topPanel?: React.ReactElement<StagePanelProps>;
  /** The StagePanel on the very top across the full width. */
  topMostPanel?: React.ReactElement<StagePanelProps>;
  /** The StagePanel on the left. */
  leftPanel?: React.ReactElement<StagePanelProps>;
  /** The StagePanel on the right. */
  rightPanel?: React.ReactElement<StagePanelProps>;
  /** The StagePanel on the bottom of the 9-zone area. */
  bottomPanel?: React.ReactElement<StagePanelProps>;
  /** The StagePanel on the very bottom across the full width. */
  bottomMostPanel?: React.ReactElement<StagePanelProps>;

  /** @hidden */
  runtimeProps?: FrontstageRuntimeProps;
}

interface FrontstageState {
  isUiVisible: boolean;
}

/** ConfigurableUi Frontstage React component.
 */
export class Frontstage extends React.Component<FrontstageProps, FrontstageState> {

  constructor(props: FrontstageProps) {
    super(props);

    this.state = { isUiVisible: UiFramework.getIsUiVisible() };
  }

  public async componentDidMount() {
    UiFramework.onUiVisibilityChanged.addListener(this._uiVisibilityChanged);
  }

  public componentWillUnmount() {
    UiFramework.onUiVisibilityChanged.removeListener(this._uiVisibilityChanged);
  }

  private _uiVisibilityChanged = (args: UiVisibilityEventArgs): void => {
    this.setState({ isUiVisible: args.visible });
  }

  public static initializeFrontstageDef(frontstageDef: FrontstageDef, props: FrontstageProps): void {
    frontstageDef.id = props.id;

    frontstageDef.defaultTool = props.defaultTool;

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

    frontstageDef.topPanel = Frontstage.createStagePanelDef(props.topPanel, StagePanelLocation.Top, props);
    frontstageDef.topMostPanel = Frontstage.createStagePanelDef(props.topMostPanel, StagePanelLocation.TopMost, props);
    frontstageDef.leftPanel = Frontstage.createStagePanelDef(props.leftPanel, StagePanelLocation.Left, props);
    frontstageDef.rightPanel = Frontstage.createStagePanelDef(props.rightPanel, StagePanelLocation.Right, props);
    frontstageDef.bottomPanel = Frontstage.createStagePanelDef(props.bottomPanel, StagePanelLocation.Bottom, props);
    frontstageDef.bottomMostPanel = Frontstage.createStagePanelDef(props.bottomMostPanel, StagePanelLocation.BottomMost, props);
  }

  private static createZoneDef(zoneNode: React.ReactElement<ZoneProps> | undefined, zoneLocation: ZoneLocation, props: FrontstageProps): ZoneDef | undefined {
    if (zoneNode) {
      const zoneDef = new ZoneDef();
      const zoneElement = Frontstage.getZoneElement(zoneLocation, props);

      // istanbul ignore else
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
      // istanbul ignore default
      default:
        throw new RangeError();
    }

    // Zones can be undefined in a Frontstage

    return zoneElement;
  }

  private static createStagePanelDef(panelNode: React.ReactElement<StagePanelProps> | undefined, panelLocation: StagePanelLocation, props: FrontstageProps): StagePanelDef | undefined {
    if (panelNode) {
      const panelDef = new StagePanelDef();
      const panelElement = Frontstage.getStagePanelElement(panelLocation, props);

      // istanbul ignore else
      if (panelElement && React.isValidElement(panelElement)) {
        StagePanel.initializeStagePanelDef(panelDef, panelElement.props, panelLocation);
        panelDef.location = panelLocation;
        return panelDef;
      }
    }

    return undefined;
  }

  private static getStagePanelElement(location: StagePanelLocation, props: FrontstageProps): React.ReactElement<StagePanelProps> | undefined {
    let panelElement: React.ReactElement<StagePanelProps> | undefined;

    switch (location) {
      case StagePanelLocation.Top:
        panelElement = props.topPanel;
        break;
      case StagePanelLocation.TopMost:
        panelElement = props.topMostPanel;
        break;
      case StagePanelLocation.Left:
        panelElement = props.leftPanel;
        break;
      case StagePanelLocation.Right:
        panelElement = props.rightPanel;
        break;
      case StagePanelLocation.Bottom:
        panelElement = props.bottomPanel;
        break;
      case StagePanelLocation.BottomMost:
        panelElement = props.bottomMostPanel;
        break;
      // istanbul ignore default
      default:
        throw new RangeError();
    }

    // Panels can be undefined in a Frontstage

    return panelElement;
  }

  // This uses ConfigurableUi to render the content
  private doContentLayoutRender(): any {
    // istanbul ignore else
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

  private cloneStagePanelElement(panelDef: StagePanelDef | undefined): React.ReactNode {
    if (!this.state.isUiVisible)
      return null;

    if (panelDef) {
      const { location } = panelDef;
      const panelElement = Frontstage.getStagePanelElement(location, this.props);

      if (panelElement && React.isValidElement(panelElement)) {
        const panelRuntimeProps: StagePanelRuntimeProps = {
          panelDef,
        };

        return React.cloneElement(panelElement, { runtimeProps: panelRuntimeProps });
      }
    }

    return null;
  }

  private cloneZoneElements(zones: WidgetZoneIndex[], nineZone: NineZone, runtimeProps: FrontstageRuntimeProps): React.ReactNode[] {
    return zones.map((zoneId: WidgetZoneIndex) => {
      const zoneElement = Frontstage.getZoneElement(zoneId, this.props) as React.ReactElement<ZoneProps>;
      if (!zoneElement || !React.isValidElement(zoneElement))
        return null;

      const zoneDef = runtimeProps.zoneDefProvider.getZoneDef(zoneId);

      // istanbul ignore if
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
    });
  }

  public render(): React.ReactNode {
    const { runtimeProps } = this.props;

    if (runtimeProps === undefined)
      return null;

    /** Layout of Panels:
     * ------------------------------------------------------------------------------------
     * TopMost
     * ------------------------------------------------------------------------------------
     * Left     | Top                                                           | Right
     *          |---------------------------------------------------------------|
     *          | Nine-zone                                                     |
     *          |                                                               |
     *          |                                                               |
     *          |                                                               |
     *          |                                                               |
     *          |                                                               |
     *          |---------------------------------------------------------------|
     *          | Bottom                                                        |
     * ------------------------------------------------------------------------------------
     * BottomMost
     * ------------------------------------------------------------------------------------
     */

    /** For div around TopMost through BottomMost */
    const outerStyle: React.CSSProperties = {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    };

    /** For div around Left, center and Right */
    const innerStyle: React.CSSProperties = {
      position: "relative",
      flex: "1",
      display: "flex",
      flexDirection: "row",
    };

    /** For div around Top, Nine-zone and Bottom */
    const centerStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      flex: "1",
    };

    /** For Nine-zone area; includes ContentLayout */
    const ninezoneStyle: React.CSSProperties = {
      position: "relative",
      flex: "1",
    };

    /** For Zones area within the Nine-zone area; excludes */
    const zonesStyle: React.CSSProperties = {
      position: "absolute",
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
    const frontstageDef = runtimeProps.frontstageDef;

    return (
      <div style={outerStyle}>
        {this.cloneStagePanelElement(frontstageDef.topMostPanel)}

        <div style={innerStyle}>
          {this.cloneStagePanelElement(frontstageDef.leftPanel)}

          <div style={centerStyle}>
            {this.cloneStagePanelElement(frontstageDef.topPanel)}

            <div style={ninezoneStyle} id="uifw-ninezone-area">
              {this.doContentLayoutRender()}

              <NZ_Zones style={zonesStyle} isHidden={!this.state.isUiVisible}>
                {this.cloneZoneElements(zones, nineZone, runtimeProps)}
              </NZ_Zones>
            </div>

            {this.cloneStagePanelElement(frontstageDef.bottomPanel)}
          </div>

          {this.cloneStagePanelElement(frontstageDef.rightPanel)}
        </div>

        {this.cloneStagePanelElement(frontstageDef.bottomMostPanel)}
      </div>
    );
  }

}
