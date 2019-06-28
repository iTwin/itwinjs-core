/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import * as classnames from "classnames";
import {
  StagePanel as NZ_StagePanel, StagePanelType as NZ_StagePanelType, NestedStagePanelKey, NestedStagePanelsManagerProps,
  StagePanelTypeHelpers, NineZoneStagePanelManagerProps, StagePanelTarget, Splitter, ZonesManagerProps,
  WidgetZoneIndex, SplitterTarget, SplitterPaneTarget as NZ_SplitterPaneTarget,
} from "@bentley/ui-ninezone";
import { StagePanelState as StagePanelState, StagePanelDef } from "./StagePanelDef";
import { WidgetDef } from "../widgets/WidgetDef";
import { WidgetProps } from "../widgets/Widget";
import { WidgetStack } from "../widgets/WidgetStack";
import { StagePanelChangeHandler, WidgetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { ZoneLocation } from "../zones/Zone";
import "./StagePanel.scss";

/** Available StagePanel locations.
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
 * @alpha
 */
export enum StagePanelLocation {
  Top,
  TopMost,
  Left,
  Right,
  Bottom,
  BottomMost,
}

/** Properties of a [[StagePanel]] component
 * @alpha
 */
export interface StagePanelProps {
  /** Describes which zones are allowed in this stage panel. */
  allowedZones?: ZoneLocation[];
  /** Default size of the panel. */
  size?: number;
  /** Default Panel state. Controls how the panel is initially displayed. Defaults to StagePanelState.Open. */
  defaultState?: StagePanelState;
  /** Indicates whether the panel is resizable. Defaults to true. */
  resizable: boolean;
  /** Any application data to attach to this Panel. */
  applicationData?: any;

  /** Properties for the Widgets in this Panel. */
  widgets?: Array<React.ReactElement<WidgetProps>>;

  /** @internal */
  runtimeProps?: StagePanelRuntimeProps;
}

/** Default properties of [[StagePanel]] component.
 * @alpha
 */
export type StagePanelDefaultProps = Pick<StagePanelProps, "resizable">;

/** Runtime Properties for the [[StagePanel]] component.
 * @internal
 */
export interface StagePanelRuntimeProps {
  getWidgetContentRef: (id: WidgetZoneIndex) => React.Ref<HTMLDivElement>;
  panel: NineZoneStagePanelManagerProps;
  panelDef: StagePanelDef;
  stagePanelChangeHandler: StagePanelChangeHandler;
  widgetChangeHandler: WidgetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  zones: ZonesManagerProps;
}

/** Frontstage Panel React component.
 * @alpha
 */
export class StagePanel extends React.Component<StagePanelProps> {
  private _measurer = React.createRef<HTMLDivElement>();

  public static readonly defaultProps: StagePanelDefaultProps = {
    resizable: true,
  };

  constructor(props: StagePanelProps) {
    super(props);
  }

  public componentDidMount(): void {
    this.initializeSize();
  }

  public componentDidUpdate(): void {
    this.initializeSize();
  }

  public static initializeStagePanelDef(panelDef: StagePanelDef, props: StagePanelProps, panelLocation: StagePanelLocation): void {
    panelDef.size = props.size;
    panelDef.location = panelLocation;

    if (props.defaultState)
      panelDef.panelState = props.defaultState;
    panelDef.resizable = props.resizable;
    if (props.applicationData !== undefined)
      panelDef.applicationData = props.applicationData;

    if (props.widgets) {
      props.widgets.forEach((widgetNode: React.ReactElement<WidgetProps>) => {
        const widgetDef = new WidgetDef(widgetNode.props);
        panelDef.addWidgetDef(widgetDef);
      });
    }
  }

  public render(): React.ReactNode {
    if (!this.props.runtimeProps)
      return null;

    const className = classnames("uifw-stagepanel");
    const { panelDef, panel, zones, zoneDefProvider, getWidgetContentRef, widgetChangeHandler } = this.props.runtimeProps;
    const draggingWidget = zones.draggingWidget;
    const isTargetVisible = draggingWidget && this.props.allowedZones && this.props.allowedZones.some((z) => draggingWidget.id === z);
    const paneCount = panelDef.widgetCount + panel.panes.length;
    const type = getStagePanelType(panelDef.location);
    if (paneCount === 0) {
      if (isTargetVisible) {
        return (
          <StagePanelTarget
            onTargetChanged={this._handleTargetChanged}
            type={type}
          />
        );
      }
      return null;
    }

    const isVertical = StagePanelTypeHelpers.isVertical(type);
    return (
      <NZ_StagePanel
        className={className}
        onResize={this.props.resizable ? this._handleResize : undefined}
        onToggleCollapse={this._handleToggleCollapse}
        size={panel.isCollapsed ? undefined : panel.size}
        type={type}
      >
        <div
          ref={this._measurer}
          style={{ width: "100%", height: "100%", position: "absolute", zIndex: -1 }}
        />
        <SplitterTarget
          isVertical={isVertical}
          onTargetChanged={this._handleTargetChanged}
          paneCount={paneCount}
          style={{
            ...isTargetVisible ? {} : { display: "none" },
          }}
        />
        <Splitter
          isGripHidden={panel.isCollapsed}
          isVertical={isVertical}
        >
          {Array.from({ length: panelDef.widgetCount }, (_, index) => index).map((index) => {
            const widgetDef = panelDef.widgetDefs[index];
            if (!widgetDef.isVisible)
              return null;
            return (
              <div
                key={`wd-${index}`}
                style={{
                  height: "100%",
                  display: panel.isCollapsed ? "none" : "block",
                }}
              >
                {widgetDef.reactElement}
              </div>
            );
          })}
          {panel.panes.map((paneProps, index) => {
            return (
              <div
                key={`w-${index}`}
                style={{ height: "100%", position: "relative" }}
              >
                <WidgetStack
                  draggingWidget={undefined}
                  fillZone={true}
                  getWidgetContentRef={getWidgetContentRef}
                  isCollapsed={panel.isCollapsed}
                  isFloating={false}
                  isInStagePanel={true}
                  widgets={paneProps.widgets}
                  widgetChangeHandler={widgetChangeHandler}
                  zoneDefProvider={zoneDefProvider}
                  zonesWidgets={zones.widgets}
                />
                {isTargetVisible && <SplitterPaneTarget
                  onTargetChanged={this._handlePaneTargetChanged}
                  paneIndex={index}
                />}
              </div>
            );
          })}
        </Splitter>
      </NZ_StagePanel>
    );
  }

  private _handleResize = (resizeBy: number) => {
    const runtimeProps = this.props.runtimeProps;
    if (!runtimeProps)
      return;
    runtimeProps.stagePanelChangeHandler.handlePanelResize(runtimeProps.panelDef.location, resizeBy);
  }

  private _handleTargetChanged = (isTargeted: boolean) => {
    const runtimeProps = this.props.runtimeProps;
    if (!runtimeProps)
      return;
    runtimeProps.stagePanelChangeHandler.handlePanelTargetChange(isTargeted ? runtimeProps.panelDef.location : undefined);
  }

  private _handleToggleCollapse = () => {
    const runtimeProps = this.props.runtimeProps;
    if (!runtimeProps)
      return;
    runtimeProps.stagePanelChangeHandler.handleTogglePanelCollapse(runtimeProps.panelDef.location);
  }

  private _handlePaneTargetChanged = (paneIndex: number | undefined) => {
    const runtimeProps = this.props.runtimeProps;
    if (!runtimeProps)
      return;
    runtimeProps.stagePanelChangeHandler.handlePanelPaneTargetChange(runtimeProps.panelDef.location, paneIndex);
  }

  private initializeSize() {
    const runtimeProps = this.props.runtimeProps;
    if (!runtimeProps || runtimeProps.panel.size !== undefined || !this._measurer.current)
      return;
    const panelDef = runtimeProps.panelDef;
    const location = panelDef.location;
    if (panelDef.size) {
      runtimeProps.stagePanelChangeHandler.handlePanelInitialize(location, panelDef.size);
      return;
    }
    const clientRect = this._measurer.current.getBoundingClientRect();
    const type = getStagePanelType(location);
    const size = StagePanelTypeHelpers.isVertical(type) ? clientRect.width : clientRect.height;
    runtimeProps.stagePanelChangeHandler.handlePanelInitialize(location, size);
  }
}

/** @internal */
export const getStagePanelType = (location: StagePanelLocation): NZ_StagePanelType => {
  switch (location) {
    case StagePanelLocation.Bottom:
    case StagePanelLocation.BottomMost:
      return NZ_StagePanelType.Bottom;
    case StagePanelLocation.Left:
      return NZ_StagePanelType.Left;
    case StagePanelLocation.Right:
      return NZ_StagePanelType.Right;
    case StagePanelLocation.Top:
    case StagePanelLocation.TopMost:
      return NZ_StagePanelType.Top;
  }
};

/** @internal */
export const getNestedStagePanelKey = (location: StagePanelLocation): NestedStagePanelKey<NestedStagePanelsManagerProps> => {
  switch (location) {
    case StagePanelLocation.Bottom:
      return {
        id: "inner",
        type: NZ_StagePanelType.Bottom,
      };
    case StagePanelLocation.BottomMost:
      return {
        id: "outer",
        type: NZ_StagePanelType.Bottom,
      };
    case StagePanelLocation.Left:
      return {
        id: "inner",
        type: NZ_StagePanelType.Left,
      };
    case StagePanelLocation.Right:
      return {
        id: "inner",
        type: NZ_StagePanelType.Right,
      };
    case StagePanelLocation.Top:
      return {
        id: "inner",
        type: NZ_StagePanelType.Top,
      };
    case StagePanelLocation.TopMost:
      return {
        id: "outer",
        type: NZ_StagePanelType.Top,
      };
  }
};

/** @internal */
export interface SplitterPaneTargetProps {
  onTargetChanged: (paneIndex: number | undefined) => void;
  paneIndex: number;
}

/** @internal */
export class SplitterPaneTarget extends React.PureComponent<SplitterPaneTargetProps> {
  public render() {
    return (
      <NZ_SplitterPaneTarget
        onTargetChanged={this._handleTargetChanged}
      />
    );
  }

  private _handleTargetChanged = (isTargeted: boolean) => {
    const target = isTargeted ? this.props.paneIndex : undefined;
    this.props.onTargetChanged(target);
  }
}
