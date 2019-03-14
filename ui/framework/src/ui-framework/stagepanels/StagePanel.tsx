/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import * as classnames from "classnames";

import { StagePanelState as StagePanelState, StagePanelDef } from "./StagePanelDef";
import { WidgetDef, WidgetType } from "../widgets/WidgetDef";
import { WidgetProps } from "../widgets/Widget";

import "./StagePanel.scss";

/** Enum for StagePanel location.
 */
export enum StagePanelLocation {
  Top,
  TopMost,
  Left,
  Right,
  Bottom,
  BottomMost,
}

/** Properties of a [[StagePanel]] component
 */
export interface StagePanelProps {
  /** Default Height or Width of the panel */
  size: string;
  /** Default Panel state. Controls how the panel is initially displayed. Defaults to StagePanelState.Open. */
  defaultState?: StagePanelState;
  /** Indicates whether the panel is resizable. */
  resizable?: boolean;
  /** Any application data to attach to this Panel. */
  applicationData?: any;

  /** Properties for the Widgets in this Panel. */
  widgets?: Array<React.ReactElement<WidgetProps>>;

  /** @hidden */
  runtimeProps?: StagePanelRuntimeProps;
}

/** Runtime Properties for the [[StagePanel]] component.
 */
export interface StagePanelRuntimeProps {
  panelDef: StagePanelDef;
}

/** Frontstage Panel React component.
 */
export class StagePanel extends React.Component<StagePanelProps> {

  constructor(props: StagePanelProps) {
    super(props);
  }

  public static initializeStagePanelDef(panelDef: StagePanelDef, props: StagePanelProps, panelLocation: StagePanelLocation): void {
    panelDef.size = props.size;
    panelDef.location = panelLocation;

    if (props.defaultState)
      panelDef.panelState = props.defaultState;
    if (props.resizable)
      panelDef.resizable = props.resizable;
    if (props.applicationData !== undefined)
      panelDef.applicationData = props.applicationData;

    // istanbul ignore else
    if (props.widgets) {
      props.widgets.forEach((widgetNode: React.ReactElement<WidgetProps>) => {
        const widgetDef = StagePanel.createWidgetDef(widgetNode);
        // istanbul ignore else
        if (widgetDef) {
          panelDef.addWidgetDef(widgetDef);
        }
      });
    }
  }

  private static createWidgetDef(widgetNode: React.ReactElement<WidgetProps>): WidgetDef | undefined {
    let widgetDef: WidgetDef | undefined;

    // istanbul ignore else
    if (React.isValidElement(widgetNode))
      widgetDef = new WidgetDef(widgetNode.props);

    return widgetDef;
  }

  public render(): React.ReactNode {
    const { runtimeProps } = this.props;
    let classes = classnames("uifw-stagepanel");
    let cssProperties: React.CSSProperties = {};
    let content: React.ReactNode = null;

    if (runtimeProps) {
      const { size } = this.props;
      const { panelDef } = runtimeProps;
      const { location } = panelDef;

      // NEEDSWORK: currently only support one rectangular Widget
      if (panelDef.widgetCount === 1 && panelDef.widgetDefs[0].widgetType === WidgetType.Rectangular) {
        const widgetDef = panelDef.widgetDefs[0];
        content = (widgetDef.isVisible) ? widgetDef.reactElement : null;
      } else {
        throw Error("StagePanels currently only support one rectangular Widget");
      }

      classes = classnames("uifw-stagepanel",
        (location === StagePanelLocation.Top || location === StagePanelLocation.TopMost) && "stagepanel-top",
        location === StagePanelLocation.Left && "stagepanel-left",
        location === StagePanelLocation.Right && "stagepanel-right",
        (location === StagePanelLocation.Bottom || location === StagePanelLocation.BottomMost) && "stagepanel-bottom",
      );
      cssProperties = this.getDivProperties(size, location);
    }

    return (
      <div className={classes} style={cssProperties}>
        {content}
      </div>
    );
  }

  private getDivProperties(size: string, location: StagePanelLocation): React.CSSProperties {
    let panelStyle: React.CSSProperties;

    if (location === StagePanelLocation.Left || location === StagePanelLocation.Right)
      panelStyle = {
        width: size,
        height: "100%",
      };
    else
      panelStyle = {
        height: size,
        width: "100%",
      };

    return panelStyle;
  }
}
