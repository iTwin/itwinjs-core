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

  public static initializeWidgetDef(widgetDef: WidgetDef, widgetProps: WidgetProps): void {
    // set base class properties
    ItemDefBase.initializeDef(widgetDef, widgetProps);

    // defaults if no widgetProps are defined
    widgetDef.isVisible = true;
    widgetDef.isFloating = false;
    widgetDef.isActive = false;

    if (widgetProps) {
      if (widgetProps && widgetProps.id !== undefined)
        widgetDef.id = widgetProps.id;

      if (widgetProps.isVisible !== undefined)
        widgetDef.isVisible = widgetProps.isVisible;

      if (widgetProps.defaultState !== undefined)
        widgetDef.applyWidgetState(widgetProps.defaultState);

      if (widgetProps.featureId !== undefined)
        widgetDef.featureId = widgetProps.featureId;
      if (widgetProps.isFreeform !== undefined) {
        widgetDef.isFreeform = widgetProps.isFreeform;
        widgetDef.widgetType = widgetDef.isFreeform ? WidgetType.FreeFrom : WidgetType.Rectangular;
      }

      if (widgetProps.isToolSettings !== undefined)
        widgetDef.isToolSettings = widgetProps.isToolSettings;
      if (widgetProps.isStatusBar !== undefined)
        widgetDef.isStatusBar = widgetProps.isStatusBar;
      if (widgetProps.fillZone !== undefined)
        widgetDef.fillZone = widgetProps.fillZone;

      if (widgetProps.applicationData !== undefined)
        widgetDef.applicationData = widgetProps.applicationData;

      if (widgetProps.control !== undefined)
        widgetDef.classId = widgetProps.control;

      if (widgetProps.element !== undefined)
        widgetDef.reactElement = widgetProps.element;

      widgetDef.setUpSyncSupport (widgetProps);
    }
  }

  public render() {
    return null;
  }

}
