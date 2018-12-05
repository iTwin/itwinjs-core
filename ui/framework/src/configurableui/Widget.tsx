/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import { ItemDefBase } from "./ItemDefBase";
import { ItemProps } from "./ItemProps";
import { WidgetState, WidgetDef, WidgetType } from "./WidgetDef";
import { ConfigurableUiControlConstructor } from "./ConfigurableUiControl";

/** Properties for a Widget.
 */
export interface WidgetProps extends ItemProps {
  id?: string;
  /** Default Widget state. Controls how the Widget is initially displayed. Defaults to WidgetState.Open. */
  defaultState?: WidgetState;
  /** Indicates whether the Widget is free-form or rectangular. Defaults to false for rectangular. */
  isFreeform?: boolean;                         // Default - false
  /** Application data attached to the Widget. */
  applicationData?: any;

  /** Indicates whether this Widget is for the Tool Settings. */
  isToolSettings?: boolean;
  /** Indicates whether this Widget is for the Status Bar. */
  isStatusBar?: boolean;
  /** Indicates whether this Widget should fill the available space in the Zone. */
  fillZone?: boolean;

  /** A [[WidgetControl]] providing information about the Widget. */
  control?: ConfigurableUiControlConstructor;
  /** A React component for the Widget. */
  element?: React.ReactNode;
}

/** ConfigurableUi Widget React component.
 */
export class Widget extends React.Component<WidgetProps> {

  constructor(props: WidgetProps) {
    super(props);
  }

  public static initializeWidgetDef(widgetDef: WidgetDef, props: WidgetProps): void {
    // set base class properties
    ItemDefBase.initializeDef(widgetDef, props);

    if (props.id !== undefined)
      widgetDef.id = props.id;
    if (props.defaultState !== undefined)
      widgetDef.widgetState = props.defaultState;
    if (props.isFreeform !== undefined)
      widgetDef.isFreeform = props.isFreeform;
    if (props.isToolSettings !== undefined)
      widgetDef.isToolSettings = props.isToolSettings;
    if (props.isStatusBar !== undefined)
      widgetDef.isStatusBar = props.isStatusBar;
    if (props.fillZone !== undefined)
      widgetDef.fillZone = props.fillZone;

    widgetDef.widgetType = widgetDef.isFreeform ? WidgetType.FreeFrom : WidgetType.Rectangular;

    if (props.applicationData !== undefined)
      widgetDef.applicationData = props.applicationData;

    if (props.control !== undefined)
      widgetDef.classId = props.control;
    if (props.element !== undefined)
      widgetDef.reactElement = props.element;
  }

  public render() {
    return null;
  }

}
