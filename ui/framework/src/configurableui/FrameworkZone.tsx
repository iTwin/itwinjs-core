/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { WidgetType, WidgetDef } from "./WidgetDef";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "./FrontstageComposer";
import { StackedWidget, EachWidgetProps } from "./StackedWidget";
import ZoneTargets from "./ZoneTargets";
import { ZoneTargetProvider } from "./FrontstageZone";
import { StatusBar } from "./StatusBar";
import { ZoneDef } from "./ZoneDef";
import { FrontstageManager, WidgetStateChangedEventArgs } from "./FrontstageManager";

import NZ_ZoneState from "@bentley/ui-ninezone/lib/zones/state/Zone";
import NZ_Zone from "@bentley/ui-ninezone/lib/zones/Zone";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import GhostOutline from "@bentley/ui-ninezone/lib/zones/GhostOutline";
import NineZoneStateManagement from "@bentley/ui-ninezone/lib/zones/state/Management";

// -----------------------------------------------------------------------------
// Zone React Components
// -----------------------------------------------------------------------------

/** Props for the FrameworkZone Component.
 */
export interface FrameworkZoneProps {
  zoneState: NZ_ZoneState;
  targetedBounds: RectangleProps | undefined;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  targetProvider: ZoneTargetProvider;
  zoneDefProvider: ZoneDefProvider;
}

interface FrameworkZoneState {
  updatedWidgetDef: WidgetDef | undefined;
}

/** ConfigurableUI Zone React Component.
 */
export class FrameworkZone extends React.Component<FrameworkZoneProps, FrameworkZoneState> {
  constructor(props: FrameworkZoneProps) {
    super(props);
  }

  /** hidden */
  public readonly state: Readonly<FrameworkZoneState> = {
    updatedWidgetDef: undefined,
  };

  public componentDidMount(): void {
    FrontstageManager.WidgetStateChangedEvent.addListener(this._handleWidgetStateChangedEvent);
  }

  public componentWillUnmount(): void {
    FrontstageManager.WidgetStateChangedEvent.removeListener(this._handleWidgetStateChangedEvent);
  }

  private _handleWidgetStateChangedEvent = (args: WidgetStateChangedEventArgs) => {
    if (this.containsWidgetDef(args.widgetDef)) {
      this.setState((_prevState, _props) => ({ updatedWidgetDef: args.widgetDef }));
    }
  }

  public render(): React.ReactNode {
    return (
      <>
        <NZ_Zone bounds={this.props.zoneState.floatingBounds || this.props.zoneState.bounds}>
          {this._getWidget()}
        </NZ_Zone>
        <NZ_Zone bounds={this.props.zoneState.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneState.id}
            targetProvider={this.props.targetProvider}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </NZ_Zone>
        {
          this.props.targetedBounds &&
          <NZ_Zone bounds={this.props.targetedBounds}>
            <GhostOutline />
          </NZ_Zone>
        }
      </>
    );
  }

  private containsWidgetDef(widgetDef: WidgetDef): boolean {
    return this.props.zoneState.widgets.some((wProps) => {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(wProps.id);
      if (!zoneDef)
        return false;

      return zoneDef.widgetDefs.some((wDef) => wDef === widgetDef);
    });
  }

  private _getWidget = () => {
    if (this.props.zoneState.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneState.widgets[0].id);
      if (!zoneDef)
        return null;
      if (zoneDef.widgetCount === 1 && zoneDef.widgetDefs[0].widgetType !== WidgetType.Rectangular)
        return zoneDef.widgetDefs[0].reactElement;
    }

    let activeZoneDef: ZoneDef | undefined;
    let activeWidgetDef: WidgetDef | undefined;
    const widgets: EachWidgetProps[] = new Array<EachWidgetProps>();

    this.props.zoneState.widgets.forEach((widget) => {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(widget.id);
      if (!zoneDef)
        return;

      widgets.push({
        id: widget.id,
        tabs: zoneDef.widgetDefs.map((widgetDef, tabIndex) => {
          let isActive = false;
          if (!activeWidgetDef) {
            if (!widgetDef.defaultOpenUsed) {
              if ((zoneDef.isDefaultOpen || widgetDef === this.state.updatedWidgetDef) && widgetDef.isDefaultOpen) {
                isActive = true;
              }
              widgetDef.defaultOpenUsed = true;
            } else if (widget.tabIndex === tabIndex) {
              isActive = true;
            }

            if (isActive) {
              activeWidgetDef = widgetDef;
              activeZoneDef = zoneDef;
            }
          }

          return {
            isActive,
            icon: widgetDef.iconInfo,
          };
        }),
      });
    });

    let content: React.ReactNode;
    if (activeWidgetDef && activeZoneDef) {
      content = activeWidgetDef.reactElement;

      if (activeWidgetDef.isStatusBar) {
        content = (
          <StatusBar
            zoneDef={activeZoneDef}
            isInFooterMode={false}
          />
        );
      }
    }

    if (widgets.length === 0)
      return null;

    return (
      <StackedWidget
        zoneId={this.props.zoneState.id}
        widgets={widgets}
        widgetChangeHandler={this.props.widgetChangeHandler}
        anchor={NineZoneStateManagement.getZoneAnchor(this.props.zoneState.id)}
      >
        {content}
      </StackedWidget>
    );
  }
}
