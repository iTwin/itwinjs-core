/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";
import { CommonProps, RectangleProps } from "@bentley/ui-core";
import {
  ZoneTargetType, ZoneManagerProps, WidgetZoneId, DraggedWidgetManagerProps, WidgetManagerProps, ToolSettingsWidgetManagerProps,
  ToolSettingsWidgetMode, DisabledResizeHandles,
} from "@bentley/ui-ninezone";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";
import { WidgetProps } from "../widgets/Widget";
import { WidgetDef, WidgetStateChangedEventArgs, WidgetState, WidgetType } from "../widgets/WidgetDef";
import { WidgetTabs } from "../widgets/WidgetStack";
import { FrameworkZone } from "./FrameworkZone";
import { StatusBarZone } from "./StatusBarZone";
import { ZoneState, ZoneDef } from "./ZoneDef";
import { ToolSettingsZone } from "./toolsettings/ToolSettingsZone";
import { FrontstageManager } from "../frontstage/FrontstageManager";

/** Enum for [[Zone]] Location.
 * @public
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

/** Properties of a [[Zone]] component
 * @public
 */
export interface ZoneProps extends CommonProps {
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

  /** @internal */
  runtimeProps?: ZoneRuntimeProps;
}

/** Runtime Properties for the [[Zone]] component.
 * @internal
 */
export interface ZoneRuntimeProps {
  activeTabIndex: number;
  disabledResizeHandles: DisabledResizeHandles | undefined;
  draggedWidget: DraggedWidgetManagerProps | undefined;
  dropTarget: ZoneTargetType | undefined;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  ghostOutline: RectangleProps | undefined;
  isHidden: boolean;
  isInFooterMode: boolean;
  openWidgetId: WidgetZoneId | undefined;
  targetChangeHandler: TargetChangeHandler;
  widget: WidgetManagerProps | undefined;
  widgetTabs: WidgetTabs;
  widgetChangeHandler: WidgetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  zoneDef: ZoneDef;
  zone: ZoneManagerProps;
}

/** Zone React component.
 * A Zone is a standard area on the screen for users to read and interact with data applicable to the current task. Each Zone has a defined purpose.
 * @public
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

    // istanbul ignore else
    if (props.widgets) {
      props.widgets.forEach((widgetNode: React.ReactElement<WidgetProps>) => {
        const widgetDef = Zone.createWidgetDef(widgetNode);
        // istanbul ignore else
        if (widgetDef) {
          zoneDef.addWidgetDef(widgetDef);
        }
      });
    }
  }

  private static createWidgetDef(widgetNode: React.ReactElement<WidgetProps>): WidgetDef | undefined {
    let widgetDef: WidgetDef | undefined;

    // istanbul ignore else
    if (React.isValidElement(widgetNode))
      widgetDef = new WidgetDef(widgetNode.props);

    return widgetDef;
  }

  public componentDidMount(): void {
    FrontstageManager.onWidgetStateChangedEvent.addListener(this._handleWidgetStateChangedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.onWidgetStateChangedEvent.removeListener(this._handleWidgetStateChangedEvent);
  }

  public render(): React.ReactNode {
    const { runtimeProps } = this.props;

    if (!runtimeProps)
      return null;

    const { zoneDef } = runtimeProps;

    let widgetElement: React.ReactNode;
    // istanbul ignore else
    if (runtimeProps.zone.widgets.length === 1) {
      if (zoneDef.isToolSettings && isToolSettingsWidgetManagerProps(runtimeProps.widget) && runtimeProps.widget.mode === ToolSettingsWidgetMode.TitleBar) {
        const widgetDef = zoneDef.getSingleWidgetDef();
        const isClosed = widgetDef ? (widgetDef.state === WidgetState.Closed || widgetDef.state === WidgetState.Hidden) : false;
        return (
          <ToolSettingsZone
            className={this.props.className}
            dropTarget={runtimeProps.dropTarget}
            getWidgetContentRef={runtimeProps.getWidgetContentRef}
            isClosed={isClosed}
            isHidden={runtimeProps.isHidden}
            lastPosition={runtimeProps.draggedWidget && runtimeProps.draggedWidget.lastPosition}
            style={this.props.style}
            targetChangeHandler={runtimeProps.targetChangeHandler}
            targetedBounds={runtimeProps.ghostOutline}
            widgetChangeHandler={runtimeProps.widgetChangeHandler}
            zone={runtimeProps.zone}
          />
        );
      } else if (zoneDef.isStatusBar) {
        if (runtimeProps.zone.id !== 8)
          throw new TypeError();

        let widgetControl: StatusBarWidgetControl | undefined;
        const widgetDef = zoneDef.getSingleWidgetDef();

        // istanbul ignore else
        if (widgetDef)
          widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

        return (
          <StatusBarZone
            className={this.props.className}
            dropTarget={runtimeProps.dropTarget}
            isHidden={runtimeProps.isHidden}
            isInFooterMode={runtimeProps.isInFooterMode}
            style={this.props.style}
            targetChangeHandler={runtimeProps.targetChangeHandler}
            targetedBounds={runtimeProps.ghostOutline}
            widgetChangeHandler={runtimeProps.widgetChangeHandler}
            widgetControl={widgetControl}
            zoneProps={runtimeProps.zone}
          />
        );
      }

      const zDef = runtimeProps.zoneDefProvider.getZoneDef(runtimeProps.zone.widgets[0]);
      // istanbul ignore if
      if (!zDef) {
        widgetElement = null;
      } else if (zDef.widgetCount === 1 && zDef.widgetDefs[0].widgetType !== WidgetType.Rectangular) {
        /** Return free-form nzWidgetProps */
        const widgetDef = zDef.widgetDefs[0];
        widgetElement = (widgetDef.isVisible) ? widgetDef.reactElement : null;
      }
    }

    return (
      <FrameworkZone
        activeTabIndex={runtimeProps.activeTabIndex}
        className={this.props.className}
        disabledResizeHandles={runtimeProps.disabledResizeHandles}
        draggedWidget={runtimeProps.draggedWidget}
        dropTarget={runtimeProps.dropTarget}
        fillZone={zoneDef.shouldFillZone}
        getWidgetContentRef={runtimeProps.getWidgetContentRef}
        isHidden={runtimeProps.isHidden}
        openWidgetId={runtimeProps.openWidgetId}
        style={this.props.style}
        targetedBounds={runtimeProps.ghostOutline}
        targetChangeHandler={runtimeProps.targetChangeHandler}
        widget={runtimeProps.widget}
        widgetElement={widgetElement}
        widgetTabs={runtimeProps.widgetTabs}
        widgetChangeHandler={runtimeProps.widgetChangeHandler}
        zone={runtimeProps.zone}
      />
    );
  }

  private _handleWidgetStateChangedEvent = (args: WidgetStateChangedEventArgs) => {
    if (!this.props.runtimeProps)
      return;

    const widgetDef = args.widgetDef;
    const id = this.getWidgetIdForDef(widgetDef);
    if (!id)
      return;

    const zoneDef = this.props.runtimeProps.zoneDefProvider.getZoneDef(id);
    // istanbul ignore else
    if (!zoneDef)
      return;

    const visibleWidgets = zoneDef.widgetDefs.filter((wd) => wd.isVisible || wd === widgetDef);
    for (let index = 0; index < visibleWidgets.length; index++) {
      const wDef = visibleWidgets[index];
      if (wDef === widgetDef) {
        this.props.runtimeProps.widgetChangeHandler.handleWidgetStateChange(id, index, widgetDef.state === WidgetState.Open);
        break;
      }
    }
  }

  private getWidgetIdForDef(widgetDef: WidgetDef): WidgetZoneId | undefined {
    if (!this.props.runtimeProps)
      return undefined;

    // istanbul ignore else
    if (this.props.runtimeProps.zone.widgets.length > 0) {
      for (const wId of this.props.runtimeProps.zone.widgets) {
        const zoneDef = this.props.runtimeProps.zoneDefProvider.getZoneDef(wId);

        // istanbul ignore else
        if (zoneDef) {
          if (zoneDef.widgetDefs.some((wDef: WidgetDef) => wDef === widgetDef))
            return wId;
        }
      }
    }

    return undefined;
  }
}

/** @internal */
export const isToolSettingsWidgetManagerProps = (props: WidgetManagerProps | undefined): props is ToolSettingsWidgetManagerProps => {
  return !!props && props.id === 2;
};
