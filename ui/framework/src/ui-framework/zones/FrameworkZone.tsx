/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";
import { CommonProps, RectangleProps } from "@bentley/ui-core";
import {
  ZoneTargetType,
  Zone as NZ_Zone,
  Outline,
  ZoneManagerProps,
  WidgetZoneId,
  DraggedWidgetManagerProps,
  WidgetManagerProps,
} from "@bentley/ui-ninezone";
import { WidgetChangeHandler, TargetChangeHandler } from "../frontstage/FrontstageComposer";
import { WidgetStack, WidgetTabs } from "../widgets/WidgetStack";
import { ZoneTargets } from "../dragdrop/ZoneTargets";

/** Properties for the [[FrameworkZone]] component.
 * @internal
 */
export interface FrameworkZoneProps extends CommonProps {
  activeTabIndex: number;
  draggedWidget: DraggedWidgetManagerProps | undefined;
  dropTarget: ZoneTargetType | undefined;
  fillZone?: boolean;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isHidden: boolean;
  openWidgetId: WidgetZoneId | undefined;
  targetChangeHandler: TargetChangeHandler;
  targetedBounds?: RectangleProps;
  widget: WidgetManagerProps | undefined;
  widgetElement: React.ReactNode;
  widgetChangeHandler: WidgetChangeHandler;
  widgetTabs: WidgetTabs;
  zone: ZoneManagerProps;
}

/** FrameworkZone React component.
 * @internal
 */
export class FrameworkZone extends React.PureComponent<FrameworkZoneProps> {
  public render(): React.ReactNode {
    const zIndexStyle: React.CSSProperties | undefined = this.props.zone.floating ?
      { zIndex: this.props.zone.floating.stackId, position: "relative" } : undefined;

    return (
      <span style={zIndexStyle}>
        <NZ_Zone
          bounds={this.props.zone.floating ? this.props.zone.floating.bounds : this.props.zone.bounds}
          className={this.props.className}
          style={this.props.style}
          isHidden={this.props.isHidden}
        >
          {this._getWidget()}
        </NZ_Zone>
        <NZ_Zone bounds={this.props.zone.bounds}>
          <ZoneTargets
            zoneId={this.props.zone.id}
            dropTarget={this.props.dropTarget}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </NZ_Zone>
        {this.props.targetedBounds && <Outline bounds={this.props.targetedBounds} />}
      </span>
    );
  }

  private _getWidget() {
    const widget = this.props.widget;
    if (!widget)
      return null;

    if (this.props.widgetElement !== undefined)
      return this.props.widgetElement;

    return (
      <WidgetStack
        activeTabIndex={this.props.activeTabIndex}
        draggedWidget={this.props.draggedWidget}
        fillZone={this.props.fillZone || this.props.zone.isLayoutChanged}
        getWidgetContentRef={this.props.getWidgetContentRef}
        horizontalAnchor={widget.horizontalAnchor}
        isCollapsed={false}
        isFloating={this.props.zone.floating ? true : false}
        isInStagePanel={false}
        openWidgetId={this.props.openWidgetId}
        verticalAnchor={widget.verticalAnchor}
        widgets={this.props.zone.widgets}
        widgetTabs={this.props.widgetTabs}
        widgetChangeHandler={this.props.widgetChangeHandler}
      />
    );
  }
}
