/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { WidgetType, WidgetDef } from "./WidgetDef";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "./FrontstageComposer";
import { StackedWidget, EachWidgetProps } from "./StackedWidget";
import ZoneTargets from "./ZoneTargets";
import { StatusBar } from "./StatusBar";
import { FrontstageManager, WidgetStateChangedEventArgs } from "./FrontstageManager";
import { StatusBarWidgetControl } from "./StatusBarWidgetControl";
import { ConfigurableUiControlType } from "./ConfigurableUiControl";

import { ZoneProps as NZ_ZoneProps, DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { WidgetProps as NZ_WidgetProps } from "@bentley/ui-ninezone/lib/zones/state/Widget";
import NZ_Zone from "@bentley/ui-ninezone/lib/zones/Zone";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import GhostOutline from "@bentley/ui-ninezone/lib/zones/GhostOutline";
import { HorizontalAnchor, VerticalAnchor } from "@bentley/ui-ninezone/lib/widget/Stacked";
import { PointProps } from "@bentley/ui-ninezone/lib/utilities/Point";

// -----------------------------------------------------------------------------
// Zone React Components
// -----------------------------------------------------------------------------

/** Properties for the [[FrameworkZone]] component.
 */
export interface FrameworkZoneProps {
  horizontalAnchor: HorizontalAnchor;
  verticalAnchor: VerticalAnchor;
  zoneProps: NZ_ZoneProps;
  targetedBounds?: RectangleProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  dropTarget: DropTarget;
  zoneDefProvider: ZoneDefProvider;
  isDragged: boolean | undefined;
  lastPosition: PointProps | undefined;
  isUnmergeDrag: boolean;
}

interface FrameworkZoneState {
  updatedWidgetDef?: WidgetDef;
}

interface WidgetStateChange {
  widgetId: number;
  tabIndex: number;
  isOpening: boolean;
}

/** ConfigurableUi Zone React component.
 */
export class FrameworkZone extends React.Component<FrameworkZoneProps, FrameworkZoneState> {
  constructor(props: FrameworkZoneProps) {
    super(props);
  }

  /** @hidden */
  public readonly state: Readonly<FrameworkZoneState> = {
    updatedWidgetDef: undefined,
  };

  public componentDidMount(): void {
    FrontstageManager.onWidgetStateChangedEvent.addListener(this._handleWidgetStateChangedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.onWidgetStateChangedEvent.removeListener(this._handleWidgetStateChangedEvent);
  }

  private _handleWidgetStateChangedEvent = (args: WidgetStateChangedEventArgs) => {
    if (this.containsWidgetDef(args.widgetDef)) {
      this.setState((_prevState, _props) => ({ updatedWidgetDef: args.widgetDef }));
    }
  }

  public render(): React.ReactNode {
    return (
      <>
        <NZ_Zone bounds={this.props.zoneProps.floating ? this.props.zoneProps.floating.bounds : this.props.zoneProps.bounds}>
          {this._getWidget()}
        </NZ_Zone>
        <NZ_Zone bounds={this.props.zoneProps.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneProps.id}
            dropTarget={this.props.dropTarget}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </NZ_Zone>
        {
          this.props.targetedBounds && (
            <GhostOutline bounds={this.props.targetedBounds} />
          )
        }
      </>
    );
  }

  private containsWidgetDef(widgetDef: WidgetDef): boolean {
    return this.props.zoneProps.widgets.some((wProps: NZ_WidgetProps) => {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(wProps.id);
      if (!zoneDef)
        return false;

      return zoneDef.widgetDefs.some((wDef: WidgetDef) => wDef === widgetDef);
    });
  }

  private _getWidget = () => {
    if (this.props.zoneProps.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneProps.widgets[0].id);
      if (!zoneDef)
        return null;

      /** Return free-form widget */
      if (zoneDef.widgetCount === 1 && zoneDef.widgetDefs[0].widgetType !== WidgetType.Rectangular) {
        const widgetDef = zoneDef.widgetDefs[0];
        return (widgetDef.canShow()) ? widgetDef.reactElement : null;
      }
    }

    let activeWidgetDef: WidgetDef | undefined;
    const widgets: EachWidgetProps[] = new Array<EachWidgetProps>();
    let widgetStateChange: WidgetStateChange | undefined;

    this.props.zoneProps.widgets.forEach((widget: NZ_WidgetProps) => {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(widget.id);
      if (!zoneDef)
        return;

      widgets.push({
        id: widget.id,
        isStatusBar: zoneDef.isStatusBar,
        tabs: zoneDef.widgetDefs
          .filter((widgetDef: WidgetDef) => {
            return widgetDef.canShow();
          })
          .map((widgetDef: WidgetDef, tabIndex: number) => {
            let isActive = false;
            if (!activeWidgetDef) {
              if (widgetDef === this.state.updatedWidgetDef && widgetDef.stateChanged) {
                if (widgetDef.canOpen()) {
                  isActive = true;
                  widgetStateChange = {
                    widgetId: widget.id,
                    tabIndex,
                    isOpening: true,
                  };
                }
                widgetDef.stateChanged = false;
              } else if (widget.tabIndex === tabIndex) {
                isActive = true;
              }

              if (isActive) {
                activeWidgetDef = widgetDef;
              }
            }

            return {
              isActive,
              iconSpec: widgetDef.iconSpec,
              title: widgetDef.label,
            };
          }),
      });
    });

    if (widgetStateChange) {
      this.props.widgetChangeHandler.handleWidgetStateChange(widgetStateChange.widgetId, widgetStateChange.tabIndex, widgetStateChange.isOpening);
    }

    let content: React.ReactNode;
    if (activeWidgetDef) {
      content = activeWidgetDef.reactElement;

      if (activeWidgetDef.isStatusBar) {
        const widgetControl = activeWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

        content = (
          <StatusBar
            widgetControl={widgetControl}
            isInFooterMode={false}
          />
        );
      }
    }

    if (widgets.length === 0)
      return null;

    return (
      <StackedWidget
        fillZone={this.props.zoneProps.isLayoutChanged}
        horizontalAnchor={this.props.horizontalAnchor}
        isDragged={this.props.isDragged}
        isFloating={this.props.zoneProps.floating ? true : false}
        isUnmergeDrag={this.props.isUnmergeDrag}
        lastPosition={this.props.lastPosition}
        verticalAnchor={this.props.verticalAnchor}
        widgets={widgets}
        widgetChangeHandler={this.props.widgetChangeHandler}
        zoneId={this.props.zoneProps.id}
      >
        {content}
      </StackedWidget>
    );
  }
}
