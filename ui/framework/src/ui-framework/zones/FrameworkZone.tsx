/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { WidgetType, WidgetDef, WidgetState, WidgetStateChangedEventArgs } from "../widgets/WidgetDef";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { WidgetStack } from "../widgets/WidgetStack";
import { ZoneTargets } from "../dragdrop/ZoneTargets";
import { FrontstageManager } from "../frontstage/FrontstageManager";

import {
  DropTarget, Zone as NZ_Zone, RectangleProps, ZonesManagerWidgets,
  Outline, ZoneManagerProps, WidgetZoneIndex, DraggingWidgetProps,
} from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[FrameworkZone]] component.
 * @internal
 */
export interface FrameworkZoneProps extends CommonProps {
  draggingWidget: DraggingWidgetProps | undefined;
  getWidgetContentRef: (id: WidgetZoneIndex) => React.Ref<HTMLDivElement>;
  targetedBounds?: RectangleProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  dropTarget: DropTarget;
  fillZone?: boolean;
  isHidden: boolean;
  widgets: ZonesManagerWidgets;
  zoneDefProvider: ZoneDefProvider;
  zoneProps: ZoneManagerProps;
}

interface FrameworkZoneState {
  updatedWidgetDef?: WidgetDef;
}

/** FrameworkZone React component.
 * @internal
 */
export class FrameworkZone extends React.Component<FrameworkZoneProps, FrameworkZoneState> {

  constructor(props: FrameworkZoneProps) {
    super(props);
  }

  /** @internal */
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

    // istanbul ignore else
    if (zoneDef) {
      const visibleWidgets = zoneDef.widgetDefs.filter((wd) => wd.isVisible || wd === widgetDef);
      for (let index = 0; index < visibleWidgets.length; index++) {
        const wDef = visibleWidgets[index];
        if (wDef === widgetDef) {
          this.props.widgetChangeHandler.handleWidgetStateChange(id, index, widgetDef.state === WidgetState.Open);
          break;
        }
      }
    }
  }

  public render(): React.ReactNode {
    const zIndexStyle: React.CSSProperties | undefined = this.props.zoneProps.floating ?
      { zIndex: this.props.zoneProps.floating.stackId, position: "relative" } : undefined;
    return (
      <span style={zIndexStyle}>
        <NZ_Zone
          bounds={this.props.zoneProps.floating ? this.props.zoneProps.floating.bounds : this.props.zoneProps.bounds}
          className={this.props.className}
          style={this.props.style}
          isHidden={this.props.isHidden}
        >
          {this._getWidget()}
        </NZ_Zone>
        <NZ_Zone bounds={this.props.zoneProps.bounds}>
          <ZoneTargets
            zoneId={this.props.zoneProps.id}
            dropTarget={this.props.dropTarget}
            targetChangeHandler={this.props.targetChangeHandler}
          />
        </NZ_Zone>
        {this.props.targetedBounds && <Outline bounds={this.props.targetedBounds} />}
      </span>
    );
  }

  private getWidgetPropsIdForDef(widgetDef: WidgetDef): number | undefined {
    // istanbul ignore else
    if (this.props.zoneProps.widgets.length > 0) {
      for (const wId of this.props.zoneProps.widgets) {
        const zoneDef = this.props.zoneDefProvider.getZoneDef(wId);

        // istanbul ignore else
        if (zoneDef) {
          if (zoneDef.widgetDefs.some((wDef: WidgetDef) => wDef === widgetDef))
            return wId;
        }
      }
    }

    return undefined;
  }

  private _getWidget = () => {
    if (this.props.zoneProps.widgets.length === 1) {
      const zoneDef = this.props.zoneDefProvider.getZoneDef(this.props.zoneProps.widgets[0]);
      // istanbul ignore if
      if (!zoneDef)
        return null;

      /** Return free-form nzWidgetProps */
      if (zoneDef.widgetCount === 1 && zoneDef.widgetDefs[0].widgetType !== WidgetType.Rectangular) {
        const widgetDef = zoneDef.widgetDefs[0];
        return (widgetDef.isVisible) ? widgetDef.reactElement : null;
      }
    }

    return (
      <WidgetStack
        draggingWidget={this.props.draggingWidget}
        fillZone={this.props.fillZone || this.props.zoneProps.isLayoutChanged}
        getWidgetContentRef={this.props.getWidgetContentRef}
        isCollapsed={false}
        isInStagePanel={false}
        isFloating={this.props.zoneProps.floating ? true : false}
        widgets={this.props.zoneProps.widgets}
        widgetChangeHandler={this.props.widgetChangeHandler}
        zoneDefProvider={this.props.zoneDefProvider}
        zonesWidgets={this.props.widgets}
      />
    );
  }
}
