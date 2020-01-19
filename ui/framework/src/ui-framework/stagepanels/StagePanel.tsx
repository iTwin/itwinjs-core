/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";
import {
  StagePanelType as NZ_StagePanelType, NestedStagePanelKey, NestedStagePanelsManagerProps,
  NineZoneStagePanelManagerProps, WidgetZoneId, ZonesManagerWidgetsProps,
} from "@bentley/ui-ninezone";
import { StagePanelState as StagePanelState, StagePanelDef } from "./StagePanelDef";
import { WidgetDef } from "../widgets/WidgetDef";
import { WidgetProps } from "../widgets/Widget";
import { WidgetTabs } from "../widgets/WidgetStack";
import { StagePanelChangeHandler, WidgetChangeHandler, ZoneDefProvider } from "../frontstage/FrontstageComposer";
import { ZoneLocation } from "../zones/Zone";
import { FrameworkStagePanel } from "./FrameworkStagePanel";

/** Available StagePanel locations.
 * ------------------------------------------------------------------------------------
 * TopMost
 * ------------------------------------------------------------------------------------
 * Left     | Top                                                           | Right
 *          |---------------------------------------------------------------|
 *          | Nine-zone                                                     |
 *          |                                                               |
 *          |                                                               |
 *          |                                                               |
 *          |                                                               |
 *          |                                                               |
 *          |---------------------------------------------------------------|
 *          | Bottom                                                        |
 * ------------------------------------------------------------------------------------
 * BottomMost
 * ------------------------------------------------------------------------------------
 * @alpha
 */
export enum StagePanelLocation {
  Top,
  TopMost,
  Left,
  Right,
  Bottom,
  BottomMost,
}

/** @internal */
export const stagePanelLocations: ReadonlyArray<StagePanelLocation> = [
  StagePanelLocation.Top,
  StagePanelLocation.TopMost,
  StagePanelLocation.Left,
  StagePanelLocation.Right,
  StagePanelLocation.Bottom,
  StagePanelLocation.BottomMost,
];

/** Properties of a [[StagePanel]] component
 * @alpha
 */
export interface StagePanelProps {
  /** Describes which zones are allowed in this stage panel. */
  allowedZones?: ZoneLocation[];
  /** Any application data to attach to this Panel. */
  applicationData?: any;
  /** Default Panel state. Controls how the panel is initially displayed. Defaults to StagePanelState.Open. */
  defaultState?: StagePanelState;
  /** Stage panel header. */
  header?: React.ReactNode;
  /** Maximum size of the panel. */
  maxSize?: number;
  /** Minimum size of the panel. */
  minSize?: number;
  /** Indicates whether the panel is resizable. Defaults to true. */
  resizable: boolean;
  /** Default size of the panel. */
  size?: number;
  /** Properties for the Widgets in this Panel. */
  widgets?: Array<React.ReactElement<WidgetProps>>;

  /** @internal */
  runtimeProps?: StagePanelRuntimeProps;
}

/** Default properties of [[StagePanel]] component.
 * @alpha
 */
export type StagePanelDefaultProps = Pick<StagePanelProps, "resizable">;

/** Runtime Properties for the [[StagePanel]] component.
 * @internal
 */
export interface StagePanelRuntimeProps {
  draggedWidgetId: WidgetZoneId | undefined;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isInFooterMode: boolean;
  isTargeted: boolean;
  panel: NineZoneStagePanelManagerProps;
  panelDef: StagePanelDef;
  stagePanelChangeHandler: StagePanelChangeHandler;
  widgetChangeHandler: WidgetChangeHandler;
  widgets: ZonesManagerWidgetsProps;
  widgetTabs: WidgetTabs;
  zoneDefProvider: ZoneDefProvider;
}

/** Frontstage Panel React component.
 * @alpha
 */
export class StagePanel extends React.Component<StagePanelProps> {
  public static readonly defaultProps: StagePanelDefaultProps = {
    resizable: true,
  };

  public static initializeStagePanelDef(panelDef: StagePanelDef, props: StagePanelProps, panelLocation: StagePanelLocation): void {
    panelDef.size = props.size;
    panelDef.location = panelLocation;
    if (props.defaultState !== undefined)
      panelDef.initializePanelState(props.defaultState);
    panelDef.resizable = props.resizable;
    if (props.applicationData !== undefined)
      panelDef.applicationData = props.applicationData;

    if (props.widgets) {
      props.widgets.forEach((widgetNode: React.ReactElement<WidgetProps>) => {
        const widgetDef = new WidgetDef(widgetNode.props);
        panelDef.addWidgetDef(widgetDef);
      });
    }
  }

  public render(): React.ReactNode {
    const { applicationData, defaultState, runtimeProps, size, ...props } = this.props;
    if (!runtimeProps)
      return null;

    const { stagePanelChangeHandler, panelDef, ...otherRuntimeProps } = runtimeProps;
    return (
      <FrameworkStagePanel
        changeHandler={stagePanelChangeHandler}
        initialSize={size}
        location={panelDef.location}
        renderPane={this._handleRenderPane}
        widgetCount={panelDef.widgetCount}
        {...props}
        {...otherRuntimeProps}
      />
    );
  }

  private _handleRenderPane = (index: number): React.ReactNode => {
    const runtimeProps = this.props.runtimeProps;
    if (!runtimeProps)
      return null;
    const widgetDef = runtimeProps.panelDef.widgetDefs[index];
    if (!widgetDef.isVisible)
      return null;
    return (
      <div
        key={`wd-${index}`}
        style={{
          height: "100%",
          display: runtimeProps.panel.isCollapsed ? "none" : "block",
        }}
      >
        {widgetDef.reactElement}
      </div>
    );
  }
}

/** @internal */
export const getStagePanelType = (location: StagePanelLocation): NZ_StagePanelType => {
  switch (location) {
    case StagePanelLocation.Bottom:
    case StagePanelLocation.BottomMost:
      return NZ_StagePanelType.Bottom;
    case StagePanelLocation.Left:
      return NZ_StagePanelType.Left;
    case StagePanelLocation.Right:
      return NZ_StagePanelType.Right;
    case StagePanelLocation.Top:
    case StagePanelLocation.TopMost:
      return NZ_StagePanelType.Top;
  }
};

/** @internal */
export const getNestedStagePanelKey = (location: StagePanelLocation): NestedStagePanelKey<NestedStagePanelsManagerProps> => {
  switch (location) {
    case StagePanelLocation.Bottom:
      return {
        id: "inner",
        type: NZ_StagePanelType.Bottom,
      };
    case StagePanelLocation.BottomMost:
      return {
        id: "outer",
        type: NZ_StagePanelType.Bottom,
      };
    case StagePanelLocation.Left:
      return {
        id: "inner",
        type: NZ_StagePanelType.Left,
      };
    case StagePanelLocation.Right:
      return {
        id: "inner",
        type: NZ_StagePanelType.Right,
      };
    case StagePanelLocation.Top:
      return {
        id: "inner",
        type: NZ_StagePanelType.Top,
      };
    case StagePanelLocation.TopMost:
      return {
        id: "outer",
        type: NZ_StagePanelType.Top,
      };
  }
};
