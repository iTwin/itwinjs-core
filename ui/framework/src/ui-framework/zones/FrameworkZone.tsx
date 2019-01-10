/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { WidgetType, WidgetDef, WidgetState } from "../widgets/WidgetDef";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { StackedWidget, EachWidgetProps } from "../widgets/StackedWidget";
import { ZoneTargets } from "../dragdrop/ZoneTargets";
import { StatusBar } from "../widgets/StatusBar";
import { FrontstageManager, WidgetStateChangedEventArgs } from "../frontstage/FrontstageManager";
import { StatusBarWidgetControl } from "../widgets/StatusBarWidgetControl";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";

import {
  ZonePropsBase, DropTarget, WidgetProps as NZ_WidgetProps, ZoneComponent as NZ_Zone, RectangleProps,
  GhostOutline, HorizontalAnchor, VerticalAnchor, PointProps,
} from "@bentley/ui-ninezone";

// -----------------------------------------------------------------------------
// Zone React Components
// -----------------------------------------------------------------------------

/** Properties for the [[FrameworkZone]] component.
 */
export interface FrameworkZoneProps {
  horizontalAnchor: HorizontalAnchor;
  verticalAnchor: VerticalAnchor;
  zoneProps: ZonePropsBase;
  targetedBounds?: RectangleProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  dropTarget: DropTarget;
  zoneDefProvider: ZoneDefProvider;
  isDragged: boolean | undefined;
  lastPosition: PointProps | undefined;
  isUnmergeDrag: boolean;
  fillZone?: boolean;
}

interface FrameworkZoneState {
  updatedWidgetDef?: WidgetDef;
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
    const widgetDef = args.widgetDef;
    const id = this.getWidgetPropsIdForDef(widgetDef);
    if (!id)
      return;

    const zoneDef = this.props.zoneDefProvider.getZoneDef(id);
    if (zoneDef) {
      // tslint:disable-next-line:prefer-for-of
      for (let index = 0; index < zoneDef.widgetDefs.length; index++) {
        const wDef = zoneDef.widgetDefs[index];
        if (wDef === widgetDef) {
          this.props.widgetChangeHandler.handleWidgetStateChange(id, index, widgetDef.state === WidgetState.Open);
          break;
        }
      }
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

  private getWidgetPropsIdForDef(widgetDef: WidgetDef): number | undefined {
    if (this.props.zoneProps.widgets.length > 0) {
      for (const wProps of this.props.zoneProps.widgets) {
        const zoneDef = this.props.zoneDefProvider.getZoneDef(wProps.id);
        if (zoneDef) {
          if (zoneDef.widgetDefs.some((wDef: WidgetDef) => wDef === widgetDef))
            return wProps.id;
        }
      }
    }
    return undefined;
  }

  private _getWidget = () => {
    if (this.props.zoneProps.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneProps.widgets[0].id);
      if (!zoneDef)
        return null;

      /** Return free-form nzWidgetProps */
      if (zoneDef.widgetCount === 1 && zoneDef.widgetDefs[0].widgetType !== WidgetType.Rectangular) {
        const widgetDef = zoneDef.widgetDefs[0];
        return (widgetDef.isVisible) ? widgetDef.reactElement : null;
      }
    }

    let widgetDefToActivate: WidgetDef | undefined;
    const widgets: EachWidgetProps[] = new Array<EachWidgetProps>();

    this.props.zoneProps.widgets.forEach((nzWidgetProps: NZ_WidgetProps) => {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(nzWidgetProps.id);
      if (!zoneDef)
        return;

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
            else
              currentWidgetDef.state = WidgetState.Closed;
          }
        }
      } else {
        // if there was a state change in this zone then force the WidgetDef state to match that defined by the active tabIndex
        for (let index = 0; index < visibleWidgetDefs.length; index++) {
          const currentWidgetDef = visibleWidgetDefs[index];
          if (nzWidgetProps.tabIndex === index) {
            widgetDefToActivate = visibleWidgetDefs[index];
            if (!currentWidgetDef.isActive) {
              // This is needed if stateFun says tab should be closed and then user clicks tab to show tab contents.
              currentWidgetDef.state = WidgetState.Open;
            }
          } else {
            if (currentWidgetDef.isActive) {
              // This is needed if stateFun enables tab and then user clicks tab to hide tab contents.
              currentWidgetDef.state = WidgetState.Closed;
            }
          }
        }
      }

      widgets.push({
        id: nzWidgetProps.id,
        isStatusBar: zoneDef.isStatusBar,
        tabs: visibleWidgetDefs.map((widgetDef: WidgetDef) => {
          return {
            isActive: widgetDef === widgetDefToActivate,
            iconSpec: widgetDef.iconSpec,
            title: widgetDef.label,
            widgetName: widgetDef.id,
          };
        }),
      });
    });

    let content: React.ReactNode;
    if (widgetDefToActivate) {
      content = widgetDefToActivate.reactElement;

      if (widgetDefToActivate.isStatusBar) {
        const widgetControl = widgetDefToActivate.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

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
        fillZone={this.props.fillZone || this.props.zoneProps.isLayoutChanged}
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
