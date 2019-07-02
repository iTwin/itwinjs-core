/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import {
  Stacked as NZ_WidgetStack, HorizontalAnchor, VerticalAnchor, ResizeHandle, Tab, TabGroup, PointProps,
  TabSeparator, WidgetZoneIndex, TabMode, HandleMode, Rectangle, ZonesManagerWidgets, DraggingWidgetProps, RectangleProps, VerticalAnchorHelpers,
} from "@bentley/ui-ninezone";
import { BetaBadge } from "../betabadge/BetaBadge";
import { WidgetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { Icon } from "../shared/IconComponent";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { WidgetDef, WidgetState } from "./WidgetDef";

/** Properties for a [[WidgetStack]] Tab.
 * @internal
 */
export interface WidgetTabProps {
  betaBadge: boolean;
  isActive: boolean;
  iconSpec?: string | React.ReactNode;
  title: string;
  widgetName: string;
}

/** Properties for a Widget in a [[WidgetStack]].
 * @internal
 */
export interface EachWidgetProps {
  id: WidgetZoneIndex;
  tabs: WidgetTabProps[];
  isStatusBar: boolean;
}

/** Properties for the [[WidgetStack]] React component.
 * @internal
 */
export interface WidgetStackProps extends CommonProps {
  draggingWidget: DraggingWidgetProps | undefined;
  fillZone: boolean;
  getWidgetContentRef: (id: WidgetZoneIndex) => React.Ref<HTMLDivElement>;
  isFloating: boolean;
  isCollapsed: boolean;
  isInStagePanel: boolean;
  widgets: ReadonlyArray<WidgetZoneIndex>;
  widgetChangeHandler: WidgetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  zonesWidgets: ZonesManagerWidgets;
}

/** Widget stack React component.
 * @internal
 */
export class WidgetStack extends React.Component<WidgetStackProps> {
  private _widgetStack = React.createRef<NZ_WidgetStack>();

  public render(): React.ReactNode {
    let widgetDefToActivate: WidgetDef | undefined;
    const widgets: EachWidgetProps[] = new Array<EachWidgetProps>();

    this.props.widgets.forEach((wId) => {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(wId);
      // istanbul ignore if
      if (!zoneDef)
        return;

      const nzWidgetProps = this.props.zonesWidgets[wId];
      const visibleWidgetDefs = zoneDef.widgetDefs
        .filter((widgetDef: WidgetDef) => {
          return widgetDef.isVisible && !widgetDef.isFloating;
        });

      if (!visibleWidgetDefs || 0 === visibleWidgetDefs.length)
        return;

      if (nzWidgetProps.tabIndex === -2) { // -2 is used when stage is initially created and we need to apply default widget state.
        // No WidgetTab has been selected so find the first WidgetDef set to Open and use that as the widgetDefToActivate
        for (const currentWidgetDef of visibleWidgetDefs) {
          if (WidgetState.Open === currentWidgetDef.state) {
            if (!widgetDefToActivate)
              widgetDefToActivate = currentWidgetDef;
          }
        }
      } else {
        // if there was a state change in this zone then force the WidgetDef state to match that defined by the active tabIndex
        for (let index = 0; index < visibleWidgetDefs.length; index++) {
          if (nzWidgetProps.tabIndex === index)
            widgetDefToActivate = visibleWidgetDefs[index];
        }
      }

      widgets.push({
        id: nzWidgetProps.id,
        isStatusBar: zoneDef.isStatusBar,
        tabs: visibleWidgetDefs.map((widgetDef: WidgetDef) => {
          return {
            betaBadge: widgetDef.betaBadge === undefined ? false : widgetDef.betaBadge,
            isActive: widgetDef === widgetDefToActivate,
            iconSpec: widgetDef.iconSpec,
            title: widgetDef.label,
            widgetName: widgetDef.id,
          };
        }),
      });
    });

    if (widgets.length === 0)
      return null;

    const isWidgetOpen = widgets.some((w) => w.tabs.some((t) => t.isActive));
    const openWidget = widgets.find((w) => this.props.zonesWidgets[w.id].tabIndex >= 0);
    const firstWidget = this.props.zonesWidgets[widgets[0].id];
    const horizontalAnchor = firstWidget.horizontalAnchor;
    const verticalAnchor = firstWidget.verticalAnchor;
    const isDragged = widgets.some((w) => !!this.props.draggingWidget && this.props.draggingWidget.id === w.id);
    return (
      <NZ_WidgetStack
        className={this.props.className}
        style={this.props.style}
        contentRef={openWidget ? this.props.getWidgetContentRef(openWidget.id) : undefined}
        fillZone={this.props.fillZone || this.props.isInStagePanel}
        horizontalAnchor={horizontalAnchor}
        isCollapsed={this.props.isCollapsed}
        isTabBarVisible={this.props.isInStagePanel}
        isDragged={isDragged}
        isFloating={this.props.isFloating}
        isOpen={isWidgetOpen}
        onResize={this.props.isInStagePanel ? undefined : this._handleOnWidgetResize}
        ref={this._widgetStack}
        tabs={<WidgetStackTabs
          draggingWidget={this.props.draggingWidget}
          horizontalAnchor={horizontalAnchor}
          isCollapsed={this.props.isCollapsed}
          isProtruding={!this.props.isInStagePanel}
          isWidgetOpen={isWidgetOpen}
          onTabClick={this._handleTabClick}
          onTabDrag={this._handleTabDrag}
          onTabDragEnd={this._handleTabDragEnd}
          onTabDragStart={this._handleTabDragStart}
          verticalAnchor={verticalAnchor}
          widgets={widgets}
        />}
        verticalAnchor={verticalAnchor}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      />
    );
  }

  private _handleOnWidgetResize = (x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.props.widgetChangeHandler.handleResize(this.props.widgets[0], x, y, handle, filledHeightDiff);
  }

  private _handleTabDragStart = (widgetId: WidgetZoneIndex, tabIndex: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => {
    if (!this._widgetStack.current)
      return;

    const tabBounds = Rectangle.create(firstTabBounds);
    const stackedWidgetBounds = Rectangle.create(this._widgetStack.current.getBounds());
    const offsetToFirstTab = stackedWidgetBounds.topLeft().getOffsetTo(tabBounds.topLeft());
    let widgetBounds;
    if (VerticalAnchorHelpers.isHorizontal(this.props.zonesWidgets[widgetId].verticalAnchor))
      widgetBounds = stackedWidgetBounds.offsetX(offsetToFirstTab.x);
    else
      widgetBounds = stackedWidgetBounds.offsetY(offsetToFirstTab.y);

    this.props.widgetChangeHandler.handleTabDragStart(widgetId, tabIndex, initialPosition, widgetBounds);
  }

  private _handleTabDragEnd = () => {
    this.props.widgetChangeHandler.handleTabDragEnd();
  }

  private _handleTabClick = (widgetId: WidgetZoneIndex, tabIndex: number) => {
    this.props.widgetChangeHandler.handleTabClick(widgetId, tabIndex);
  }

  private _handleTabDrag = (dragged: PointProps) => {
    this.props.widgetChangeHandler.handleTabDrag(dragged);
  }
}

/** Properties for the [[WidgetStackTabs]] component.
 * @internal
 */
export interface WidgetStackTabsProps {
  draggingWidget: DraggingWidgetProps | undefined;
  horizontalAnchor: HorizontalAnchor;
  isCollapsed: boolean;
  isProtruding: boolean;
  isWidgetOpen: boolean;
  onTabClick: (widgetId: WidgetZoneIndex, tabIndex: number) => void;
  onTabDrag: (dragged: PointProps) => void;
  onTabDragEnd: () => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabIndex: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => void;
  verticalAnchor: VerticalAnchor;
  widgets: ReadonlyArray<EachWidgetProps>;
}

/** Tabs of [[WidgetStack]] component.
 * @internal
 */
export class WidgetStackTabs extends React.Component<WidgetStackTabsProps> {
  public render(): React.ReactNode {
    return this.props.widgets.map((widget, index) => {
      return (
        <React.Fragment key={widget.id}>
          {index === 0 ? undefined : <TabSeparator
            isHorizontal={VerticalAnchorHelpers.isHorizontal(this.props.verticalAnchor)}
          />}
          <WidgetStackTabGroup
            draggingWidget={this.props.draggingWidget}
            horizontalAnchor={this.props.horizontalAnchor}
            isCollapsed={this.props.isCollapsed}
            isProtruding={this.props.isProtruding}
            isStacked={this.props.widgets.length > 1}
            isWidgetOpen={this.props.isWidgetOpen}
            onTabClick={this.props.onTabClick}
            onTabDrag={this.props.onTabDrag}
            onTabDragEnd={this.props.onTabDragEnd}
            onTabDragStart={this.props.onTabDragStart}
            tabs={widget.tabs}
            verticalAnchor={this.props.verticalAnchor}
            widgetId={widget.id}
          />
        </React.Fragment>
      );
    });
  }
}

/** Properties for the [[WidgetStackTabGroup]] component.
 * @internal
 */
export interface WidgetStackTabGroupProps {
  draggingWidget: DraggingWidgetProps | undefined;
  horizontalAnchor: HorizontalAnchor;
  isCollapsed: boolean;
  isProtruding: boolean;
  isStacked: boolean;
  isWidgetOpen: boolean;
  onTabClick: (widgetId: WidgetZoneIndex, tabIndex: number) => void;
  onTabDrag: (dragged: PointProps) => void;
  onTabDragEnd: () => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabIndex: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => void;
  tabs: WidgetTabProps[];
  verticalAnchor: VerticalAnchor;
  widgetId: WidgetZoneIndex;
}

/** Widget tab group used in [[WidgetStackTabs]] component.
 * @internal
 */
export class WidgetStackTabGroup extends React.Component<WidgetStackTabGroupProps> {
  private _firstTab = React.createRef<Tab>();

  public render(): React.ReactNode {
    const isDragged = this.props.draggingWidget && this.props.draggingWidget.id === this.props.widgetId;
    const lastPosition = isDragged ? this.props.draggingWidget!.lastPosition : undefined;
    const tabs = this.props.tabs.map((tab: WidgetTabProps, index: number) => {
      const mode = !this.props.isWidgetOpen ? TabMode.Closed : tab.isActive ? TabMode.Active : TabMode.Open;
      return (
        <WidgetStackTab
          horizontalAnchor={this.props.horizontalAnchor}
          iconSpec={tab.iconSpec}
          isBetaBadgeVisible={tab.betaBadge}
          isCollapsed={this.props.isCollapsed}
          index={index}
          isProtruding={this.props.isProtruding}
          key={`${this.props.widgetId}-${index}`}
          lastPosition={lastPosition}
          mode={mode}
          onClick={this._handleTabClick}
          onDrag={this.props.onTabDrag}
          onDragEnd={this.props.onTabDragEnd}
          onDragStart={this._handleTabDragStart}
          tabRef={index === 0 ? this._firstTab : undefined}
          title={tab.title}
          verticalAnchor={this.props.verticalAnchor}
        />
      );
    });

    if (tabs.length > 1) {
      return (
        <TabGroup
          handle={this.getTabHandleMode()}
          horizontalAnchor={this.props.horizontalAnchor}
          isCollapsed={this.props.isCollapsed}
          verticalAnchor={this.props.verticalAnchor}
        >
          {tabs}
        </TabGroup>
      );
    }

    return tabs;
  }

  private getTabHandleMode() {
    if (this.props.draggingWidget && this.props.draggingWidget.id === this.props.widgetId && this.props.draggingWidget.isUnmerge)
      return HandleMode.Visible;

    if (this.props.isStacked)
      return HandleMode.Hovered;

    return HandleMode.Timedout;
  }

  private _handleTabDragStart = (tabIndex: number, initialPosition: PointProps) => {
    if (!this._firstTab.current)
      return;

    const firstTabBounds = Rectangle.create(this._firstTab.current.getBounds()).toProps();
    this.props.onTabDragStart(this.props.widgetId, tabIndex, initialPosition, firstTabBounds);
  }

  private _handleTabClick = (tabIndex: number) => {
    this.props.onTabClick(this.props.widgetId, tabIndex);
  }
}

/** Properties for the [[WidgetStackTab]] component.
 * @internal
 */
export interface WidgetStackTabProps {
  horizontalAnchor: HorizontalAnchor;
  iconSpec?: string | React.ReactNode;
  index: number;
  isBetaBadgeVisible: boolean;
  isCollapsed: boolean;
  isProtruding: boolean;
  lastPosition: PointProps | undefined;
  mode: TabMode;
  onClick: (index: number) => void;
  onDrag: (dragged: PointProps) => void;
  onDragEnd: () => void;
  onDragStart: (index: number, initialPosition: PointProps) => void;
  tabRef?: React.Ref<Tab>;
  title: string;
  verticalAnchor: VerticalAnchor;
}

/** Tab used in [[WidgetStackTabGroup]] component.
 * @internal
 */
export class WidgetStackTab extends React.Component<WidgetStackTabProps> {
  public render(): React.ReactNode {
    return (
      <Tab
        betaBadge={this.props.isBetaBadgeVisible ? <BetaBadge /> : undefined}
        horizontalAnchor={this.props.horizontalAnchor}
        isCollapsed={this.props.isCollapsed}
        isProtruding={this.props.isProtruding}
        lastPosition={this.props.lastPosition}
        mode={this.props.mode}
        onClick={this._handleClick}
        onDrag={this.props.onDrag}
        onDragEnd={this.props.onDragEnd}
        onDragStart={this._handleDragStart}
        ref={this.props.tabRef}
        title={this.props.title}
        verticalAnchor={this.props.verticalAnchor}
      >
        <Icon iconSpec={this.props.iconSpec} />
      </Tab>
    );
  }

  private _handleDragStart = (initialPosition: PointProps) => {
    this.props.onDragStart(this.props.index, initialPosition);
  }

  private _handleClick = () => {
    this.props.onClick(this.props.index);
  }
}
