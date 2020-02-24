/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";
import * as classnames from "classnames";
import { StagePanelLocation } from "@bentley/ui-abstract";
import {
  StagePanel as NZ_StagePanel,
  StagePanelTypeHelpers,
  NineZoneStagePanelManagerProps,
  StagePanelTarget,
  Splitter,
  WidgetZoneId,
  SplitterTarget,
  SplitterPaneTarget as NZ_SplitterPaneTarget,
  ZonesManagerWidgetsProps,
  SafeAreaInsets,
} from "@bentley/ui-ninezone";
import { WidgetStack, WidgetTabs } from "../widgets/WidgetStack";
import { StagePanelChangeHandler, WidgetChangeHandler } from "../frontstage/FrontstageComposer";
import { ZoneLocation } from "../zones/Zone";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { getStagePanelType, getNestedStagePanelKey } from "./StagePanel";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import "./FrameworkStagePanel.scss";

/** Properties of a [[FrameworkStagePanel]] component
 * @internal
 */
export interface FrameworkStagePanelProps {
  allowedZones?: ZoneLocation[];
  changeHandler: StagePanelChangeHandler;
  draggedWidgetId: WidgetZoneId | undefined;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  header?: React.ReactNode;
  initialSize?: number;
  isInFooterMode: boolean;
  isTargeted: boolean;
  maxSize?: number;
  minSize?: number;
  location: StagePanelLocation;
  panel: NineZoneStagePanelManagerProps;
  renderPane: (index: number) => React.ReactNode;
  resizable: boolean;
  widgetChangeHandler: WidgetChangeHandler;
  widgetCount: number;
  widgets: ZonesManagerWidgetsProps;
  widgetTabs: WidgetTabs;
}

/** Stage Panel React component.
 * @internal
 */
export class FrameworkStagePanel extends React.PureComponent<FrameworkStagePanelProps> {
  private _measurer = React.createRef<HTMLDivElement>();

  public componentDidMount(): void {
    this.initializeSize();
    this.setMinMaxSize();
  }

  public componentDidUpdate(): void {
    this.initializeSize();
    this.setMinMaxSize();
  }

  public render(): React.ReactNode {
    const className = classnames("uifw-stagepanel");
    const paneCount = this.props.widgetCount + this.props.panel.panes.length;
    const type = getStagePanelType(this.props.location);

    const isTargetVisible = !!this.props.draggedWidgetId && this.props.allowedZones && this.props.allowedZones.some((z) => this.props.draggedWidgetId === z);
    if (paneCount === 0) {
      if (!isTargetVisible)
        return null;
      return (
        <SafeAreaContext.Consumer>
          {(safeAreaInsets) => (
            <StagePanelTarget
              onTargetChanged={this._handleTargetChanged}
              safeAreaInsets={safeAreaInsets}
              type={type}
            />
          )}
        </SafeAreaContext.Consumer>
      );
    }

    const isSplitterTargetVisible = isTargetVisible && !this.props.isTargeted;
    const isVertical = StagePanelTypeHelpers.isVertical(type);
    return (
      <SafeAreaContext.Consumer>
        {(safeAreaInsets) => {
          if (this.props.isInFooterMode)
            safeAreaInsets &= ~SafeAreaInsets.Bottom;
          return (
            <NZ_StagePanel
              className={className}
              onResize={this.props.resizable ? this._handleResize : undefined}
              onToggleCollapse={this._handleToggleCollapse}
              safeAreaInsets={safeAreaInsets}
              size={this.props.panel.isCollapsed ? undefined : this.props.panel.size}
              type={type}
            >
              <div
                ref={this._measurer}
                style={{ width: "100%", height: "100%", position: "absolute", zIndex: -1 }}
              />
              <div className="uifw-content">
                {this.props.panel.isCollapsed ? undefined : this.props.header}
                <div className="uifw-widgets">
                  <SplitterTarget
                    isVertical={isVertical}
                    onTargetChanged={this._handleTargetChanged}
                    paneCount={paneCount}
                    style={{
                      ...isTargetVisible ? {} : { display: "none" },
                    }}
                  />
                  <Splitter
                    isGripHidden={this.props.panel.isCollapsed}
                    isVertical={isVertical}
                  >
                    {Array.from({ length: this.props.widgetCount }, (_, index) => index).map((index) => {
                      return this.props.renderPane(index);
                    })}
                    {this.props.panel.panes.map((pane, index) => {
                      const openWidgetId = pane.widgets.find((wId) => this.props.widgets[wId].tabIndex >= 0);
                      const activeTabIndex = openWidgetId ? this.props.widgets[openWidgetId].tabIndex : 0;
                      const firstWidget = this.props.widgets[pane.widgets[0]];
                      return (
                        <div
                          key={`w-${index}`}
                          style={{ height: "100%", position: "relative" }}
                        >
                          <WidgetStack
                            activeTabIndex={activeTabIndex}
                            disabledResizeHandles={undefined}
                            draggedWidget={undefined}
                            fillZone={true}
                            getWidgetContentRef={this.props.getWidgetContentRef}
                            horizontalAnchor={firstWidget.horizontalAnchor}
                            isCollapsed={this.props.panel.isCollapsed}
                            isFloating={false}
                            isInStagePanel={true}
                            openWidgetId={openWidgetId}
                            verticalAnchor={firstWidget.verticalAnchor}
                            widgets={pane.widgets}
                            widgetTabs={this.props.widgetTabs}
                            widgetChangeHandler={this.props.widgetChangeHandler}
                          />
                          {isSplitterTargetVisible && <SplitterPaneTarget
                            onTargetChanged={this._handlePaneTargetChanged}
                            paneIndex={index}
                          />}
                        </div>
                      );
                    })}
                  </Splitter>
                </div>
              </div>
            </NZ_StagePanel>
          );
        }}
      </SafeAreaContext.Consumer>
    );
  }

  private setMinMaxSize() {
    const panel = getNestedStagePanelKey(this.props.location);
    const nestedPanelsManager = FrontstageManager.NineZoneManager.getNestedPanelsManager();
    this.props.minSize && (nestedPanelsManager.getPanelsManager(panel.id).getPanelManager(panel.type).minSize = this.props.minSize);
    this.props.maxSize && (nestedPanelsManager.getPanelsManager(panel.id).getPanelManager(panel.type).maxSize = this.props.maxSize);
  }

  private _handleResize = (resizeBy: number) => {
    this.props.changeHandler.handlePanelResize(this.props.location, resizeBy);
  }

  private _handleTargetChanged = (isTargeted: boolean) => {
    this.props.changeHandler.handlePanelTargetChange(isTargeted ? this.props.location : undefined);
  }

  private _handleToggleCollapse = () => {
    this.props.changeHandler.handleTogglePanelCollapse(this.props.location);
  }

  private _handlePaneTargetChanged = (paneIndex: number | undefined) => {
    this.props.changeHandler.handlePanelPaneTargetChange(this.props.location, paneIndex);
  }

  private initializeSize() {
    if (this.props.panel.size !== undefined || !this._measurer.current)
      return;

    const location = this.props.location;
    if (this.props.initialSize) {
      this.props.changeHandler.handlePanelInitialize(location, this.props.initialSize);
      return;
    }
    const clientRect = this._measurer.current.getBoundingClientRect();
    const type = getStagePanelType(location);
    const size = StagePanelTypeHelpers.isVertical(type) ? clientRect.width : clientRect.height;
    this.props.changeHandler.handlePanelInitialize(location, size);
  }
}

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
