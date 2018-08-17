/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { WidgetChangeHandler } from "./FrontstageComposer";
import { Icon, IconInfo } from "./IconLabelSupport";

import NZ_StackedWidget, { Anchor } from "@bentley/ui-ninezone/lib/widget/Stacked";
import ResizeHandle from "@bentley/ui-ninezone/lib/widget/rectangular/ResizeHandle";
import WidgetTab from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Draggable";
import Point, { PointProps } from "@bentley/ui-ninezone/lib/utilities/Point";
import TabSeparator from "@bentley/ui-ninezone/lib/widget/rectangular/tab/Separator";

/** Props for a StackedWidget Tab.
 */
export interface TabProps {
  isActive: boolean;
  icon: IconInfo;
}

/** Props for a Widget in a StackedWidget.
 */
export interface EachWidgetProps {
  id: number;
  tabs: TabProps[];
}

/** Props for the StackedWidget React component.
 */
export interface StackedWidgetProps {
  children?: React.ReactNode;
  zoneId: number;
  widgets: EachWidgetProps[];
  widgetChangeHandler: WidgetChangeHandler;
  anchor: Anchor;
}

/** Stacked Widget React component.
 */
export class StackedWidget extends React.Component<StackedWidgetProps> {

  public render(): React.ReactNode {
    let tabs: JSX.Element[] = new Array<JSX.Element>();
    for (let i = 0; i < this.props.widgets.length; i++) {
      const widget = this.props.widgets[i];
      const widgetTabs = this.getWidgetTabs(widget);

      if (i !== 0)
        tabs.push(<TabSeparator key={i} />);
      tabs = tabs.concat(widgetTabs);
    }

    const isWidgetOpen = this.props.widgets.some((w) => w.tabs.some((t) => t.isActive));

    return (
      <NZ_StackedWidget
        anchor={this.props.anchor}
        content={this.props.children}
        tabs={tabs}
        isOpen={isWidgetOpen}
        onResize={
          (x, y, handle) => {
            this._handleOnWidgetResize(this.props.zoneId, x, y, handle);
          }
        }
      />
    );
  }

  private getWidgetTabs(stackedWidget: EachWidgetProps): JSX.Element[] {
    return stackedWidget.tabs.map((tab: TabProps, index: number) => {
      return (
        <WidgetTab
          key={`${stackedWidget.id}_${index}`}
          isActive={tab.isActive}
          onClick={() => this._handleWidgetTabClick(stackedWidget.id, index)}
          onDragBehaviorChanged={(isDragging) => this._handleWidgetTabDragBehaviorChanged(stackedWidget.id, isDragging)}
          onDrag={this._handleWidgetTabDrag}
          anchor={this.props.anchor}
        >
          <Icon iconInfo={tab.icon} />
        </WidgetTab>
      );
    });
  }

  private _handleOnWidgetResize = (zoneId: number, x: number, y: number, handle: ResizeHandle) => {
    this.props.widgetChangeHandler.handleOnWidgetResize(zoneId, x, y, handle);
  }

  private _handleWidgetTabClick = (widgetId: number, tabIndex: number) => {
    this.props.widgetChangeHandler.handleWidgetTabClick(widgetId, tabIndex);
  }

  private _handleWidgetTabDragBehaviorChanged = (widgetId: number, isDragging: boolean) => {
    this.props.widgetChangeHandler.handleWidgetTabDragBehaviorChanged(widgetId, isDragging);
  }

  private _handleWidgetTabDrag = (dragged: PointProps) => {
    this.props.widgetChangeHandler.handleWidgetTabDrag(dragged as Point);
  }
}

export default StackedWidget;
