/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { WidgetChangeHandler } from "./FrontstageComposer";
import { Icon, IconInfo } from "./IconLabelSupport";

import NZ_StackedWidget, { HorizontalAnchor, VerticalAnchor } from "@bentley/ui-ninezone/lib/widget/Stacked";
import ResizeHandle from "@bentley/ui-ninezone/lib/widget/rectangular/ResizeHandle";
import WidgetTab from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Draggable";
import TabGroup, { VisibilityMode } from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Group";
import { PointProps } from "@bentley/ui-ninezone/lib/utilities/Point";
import TabSeparator from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Separator";
import { WidgetZoneIndex } from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import { TabMode } from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Tab";

/** Properties for a [[StackedWidget]] Tab.
 */
export interface WidgetTabProps {
  isActive: boolean;
  icon: IconInfo;
}

/** Properties for a Widget in a [[StackedWidget]].
 */
export interface EachWidgetProps {
  id: WidgetZoneIndex;
  tabs: WidgetTabProps[];
}

/** Properties for the [[StackedWidget]] React component.
 */
export interface StackedWidgetProps {
  children?: React.ReactNode;
  fillZone: boolean;
  isFloating: boolean;
  zoneId: number;
  widgets: EachWidgetProps[];
  widgetChangeHandler: WidgetChangeHandler;
  horizontalAnchor: HorizontalAnchor;
  verticalAnchor: VerticalAnchor;
  isDragged: boolean | undefined;
  lastPosition: PointProps | undefined;
  isUnmergeDrag: boolean;
}

/** Stacked Widget React component.
 */
export class StackedWidget extends React.Component<StackedWidgetProps> {
  public render(): React.ReactNode {
    const isWidgetOpen = this.props.widgets.some((w) => w.tabs.some((t) => t.isActive));

    let tabs: JSX.Element[] = new Array<JSX.Element>();
    for (let i = 0; i < this.props.widgets.length; i++) {
      const widget = this.props.widgets[i];
      const widgetTabs = this.getWidgetTabs(widget, isWidgetOpen);

      if (i !== 0)
        tabs.push(<TabSeparator key={i} />);

      if (widgetTabs.length > 1) {
        tabs.push(
          <TabGroup
            key={widget.id}
            anchor={this.props.horizontalAnchor}
            handleMode={this.getTabHandleMode(widget.id)}
          >
            {widgetTabs}
          </TabGroup>,
        );
      } else {
        tabs = tabs.concat(widgetTabs);
      }
    }

    return (
      <NZ_StackedWidget
        content={this.props.children}
        fillZone={this.props.fillZone}
        horizontalAnchor={this.props.horizontalAnchor}
        isDragged={this.props.isDragged}
        isFloating={this.props.isFloating}
        isOpen={isWidgetOpen}
        onResize={
          (x, y, handle, filledHeightDiff) => {
            this._handleOnWidgetResize(this.props.zoneId, x, y, handle, filledHeightDiff);
          }
        }
        tabs={tabs}
        verticalAnchor={this.props.verticalAnchor}
      />
    );
  }

  private getTabHandleMode(widgetId: WidgetZoneIndex) {
    if (this.props.isUnmergeDrag && this.props.isDragged && widgetId === this.props.zoneId)
      return VisibilityMode.Visible;

    if (this.props.widgets.length > 1)
      return VisibilityMode.OnHover;

    return VisibilityMode.Timeout;
  }

  private getWidgetTabs(stackedWidget: EachWidgetProps, isWidgetOpen: boolean): JSX.Element[] {
    return stackedWidget.tabs.map((tab: WidgetTabProps, index: number) => {
      const mode = !isWidgetOpen ? TabMode.Closed : tab.isActive ? TabMode.Active : TabMode.Open;
      return (
        <WidgetTab
          key={`${stackedWidget.id}_${index}`}
          anchor={this.props.horizontalAnchor}
          mode={mode}
          lastPosition={this.props.lastPosition}
          onClick={() => this._handleWidgetTabClick(stackedWidget.id, index)}
          onDragStart={(initialPosition, offset) => this._handleTabDragStart(stackedWidget.id, index, initialPosition, offset)}
          onDrag={this._handleWidgetTabDrag}
          onDragEnd={this._handleTabDragEnd}
        >
          <Icon iconInfo={tab.icon} />
        </WidgetTab>
      );
    });
  }

  private _handleTabDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, offset: PointProps) => {
    this.props.widgetChangeHandler.handleTabDragStart(widgetId, tabId, initialPosition, offset);
  }

  private _handleTabDragEnd = () => {
    this.props.widgetChangeHandler.handleTabDragEnd();
  }

  private _handleOnWidgetResize = (zoneId: number, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.props.widgetChangeHandler.handleResize(zoneId, x, y, handle, filledHeightDiff);
  }

  private _handleWidgetTabClick = (widgetId: number, tabIndex: number) => {
    this.props.widgetChangeHandler.handleTabClick(widgetId, tabIndex);
  }

  private _handleWidgetTabDrag = (dragged: PointProps) => {
    this.props.widgetChangeHandler.handleTabDrag(dragged);
  }
}

export default StackedWidget;
