/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import { IconProps } from "../shared/IconComponent";
import { WidgetState } from "./WidgetDef";
import { StringGetter } from "../shared/ItemProps";
import { ConfigurableUiControlConstructor } from "../configurableui/ConfigurableUiControl";

/** Properties for a Widget.
 */
export interface WidgetProps extends IconProps {
  /** Defines the SyncUi event Ids that will trigger the stateFunc to run to determine the state of the widget. */
  syncEventIds?: string[];
  /** Function executed to determine the state of the widget. */
  stateFunc?: (state: Readonly<WidgetState>) => WidgetState;
  /** if set, component will be considered selected but will NOT display an "active stripe" - defaults to false. Typically used by buttons that toggle between two states. */
  label?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  labelKey?: string;
  /** used to explicitly set the tooltip shown by a component. */
  tooltip?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  tooltipKey?: string;
  /** Optional Id used to uniquely identify the widget. */
  id?: string;
  /** Default Widget state. Controls how the Widget is initially displayed. Defaults to WidgetState.Open. */
  defaultState?: WidgetState;
  /** Indicates whether the Widget is free-form or rectangular. Defaults to false for rectangular. */
  isFreeform?: boolean;                         // Default - false
  /** for future use. */
  featureId?: string;
  /** Application data attached to the Widget. */
  applicationData?: any;
  /** Indicates whether this Widget is for the Tool Settings. */
  isToolSettings?: boolean;
  /** Indicates whether this Widget is for the Status Bar. */
  isStatusBar?: boolean;
  /** Indicates whether this Widget should fill the available space in the Zone. */
  fillZone?: boolean;
  /** Indicates if widget can be in floating state. */
  isFloatingStateSupported?: boolean;
  /** Indicates if floating widget is resizable. */
  isFloatingStateWindowResizable?: boolean;
  /** A [[WidgetControl]] providing information about the Widget. */
  control?: ConfigurableUiControlConstructor;
  /** A React component for the Widget. */
  element?: React.ReactNode;
  /** Specification for icon on Widget Tab */
  iconSpec?: string | React.ReactNode;
  /** Control's class id */
  classId?: string | ConfigurableUiControlConstructor;
  /** Control's priority */
  priority?: number;
}

/** ConfigurableUi Widget React component.
 */
export class Widget extends React.Component<WidgetProps> {

  constructor(props: WidgetProps) {
    super(props);
  }

  public render() {
    return null;
  }

}
