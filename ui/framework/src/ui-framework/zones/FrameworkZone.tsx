/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as React from "react";

import { WidgetType, WidgetDef, WidgetState, WidgetStateChangedEventArgs } from "../widgets/WidgetDef";
import { WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { StackedWidget, EachWidgetProps } from "../widgets/StackedWidget";
import { ZoneTargets } from "../dragdrop/ZoneTargets";
import { FrontstageManager } from "../frontstage/FrontstageManager";

import {
  ZonePropsBase, DropTarget, WidgetProps as NZ_WidgetProps, Zone as NZ_Zone, RectangleProps,
  Outline, HorizontalAnchor, VerticalAnchor, PointProps,
} from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** Properties for the [[FrameworkZone]] component.
 * @internal
 */
export interface FrameworkZoneProps extends CommonProps {
  contentRef: React.RefObject<HTMLDivElement>;
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
  isHidden: boolean;
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
      for (const wProps of this.props.zoneProps.widgets) {
        const zoneDef = this.props.zoneDefProvider.getZoneDef(wProps.id);

        // istanbul ignore else
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
      // istanbul ignore if
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
      // istanbul ignore if
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
            isActive: widgetDef === widgetDefToActivate,
            iconSpec: widgetDef.iconSpec,
            title: widgetDef.label,
            widgetName: widgetDef.id,
            betaBadge: widgetDef.betaBadge,
          };
        }),
      });
    });

    if (widgets.length === 0)
      return null;

    return (
      <StackedWidget
        contentRef={this.props.contentRef}
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
      />
    );
  }
}
