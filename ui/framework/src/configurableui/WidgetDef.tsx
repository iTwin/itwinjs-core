/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { IconLabelProps, IconLabelSupport, IconInfo } from "./IconLabelSupport";
import { ConfigurableUiManager } from "./ConfigurableUiManager";
import { WidgetControl } from "./WidgetControl";
import { FrontstageManager } from "./FrontstageManager";

import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

// -----------------------------------------------------------------------------
// WidgetDef and sub-interfaces
// -----------------------------------------------------------------------------

/** Widget state enum.
 */
export enum WidgetState {
  Off,
  Open,
  Hidden,
  Footer,
  Floating,
}

/** Widget type enum.
 */
export enum WidgetType {
  Tool,
  Navigation,
  FreeFrom,
  Rectangular,
  ToolSettings,
  StatusBar,
}

/** Properties for a Widget.
 */
export interface WidgetProps extends IconLabelProps {
  id?: string;

  classId?: string;
  defaultState?: WidgetState;
  priority?: number;

  featureId?: string;
  isFreeform?: boolean;                         // Default - false
  isFloatingStateSupported?: boolean;           // Default - false
  isFloatingStateWindowResizable?: boolean;     // Default - true
  isToolSettings?: boolean;                     // Default - false
  isStatusBar?: boolean;                        // Default - false

  applicationData?: any;

  reactElement?: React.ReactNode;
}

/** Properties for a Toolbar Widget.
 */
export interface ToolbarWidgetProps extends WidgetProps {
  horizontalIds?: string[];  // Item Ids
  horizontalDirection?: Direction;
  verticalIds?: string[];    // Item Ids
  verticalDirection?: Direction;
}

/** Properties for a Tool Widget.
 */
export interface ToolWidgetProps extends ToolbarWidgetProps {
  appButtonId?: string;
}

/** Properties for a Navigation Widget.
 */
export interface NavigationWidgetProps extends ToolbarWidgetProps {
  navigationAidId?: string;
}

/** Union of all Widget properties.
 */
export type AnyWidgetProps = WidgetProps | ToolWidgetProps | NavigationWidgetProps;

// -----------------------------------------------------------------------------
// Widget and subclasses
// -----------------------------------------------------------------------------

/** A Widget Definition in the 9-Zone Layout system.
 */
export class WidgetDef {
  private static sId: number;

  public id: string;
  public classId: string = "";
  public defaultState: WidgetState = WidgetState.Open;
  public priority: number = 0;

  public featureId: string = "";
  public isFreeform: boolean = false;
  public isFloatingStateSupported: boolean = false;
  public isFloatingStateWindowResizable: boolean = true;
  public isToolSettings: boolean = false;
  public isStatusBar: boolean = false;
  public isDefaultOpen: boolean = false;
  public defaultOpenUsed: boolean = false;

  public widgetType: WidgetType;

  public applicationData?: any;

  private _iconLabelSupport: IconLabelSupport;
  private _widgetReactNode: React.ReactNode;
  private _widgetControl!: WidgetControl;

  constructor(widgetProps: WidgetProps) {
    if (widgetProps.id !== undefined)
      this.id = widgetProps.id;
    else {
      WidgetDef.sId++;
      this.id = "Widget-" + WidgetDef.sId;
    }

    if (widgetProps.classId !== undefined)
      this.classId = widgetProps.classId;
    if (widgetProps.defaultState !== undefined)
      this.defaultState = widgetProps.defaultState;
    if (widgetProps.priority !== undefined)
      this.priority = widgetProps.priority;

    if (widgetProps.featureId !== undefined)
      this.featureId = widgetProps.featureId;
    if (widgetProps.isFreeform !== undefined)
      this.isFreeform = widgetProps.isFreeform;
    if (widgetProps.isFloatingStateSupported !== undefined)
      this.isFloatingStateSupported = widgetProps.isFloatingStateSupported;
    if (widgetProps.isFloatingStateWindowResizable !== undefined)
      this.isFloatingStateWindowResizable = widgetProps.isFloatingStateWindowResizable;
    if (widgetProps.isToolSettings !== undefined)
      this.isToolSettings = widgetProps.isToolSettings;
    if (widgetProps.isStatusBar !== undefined)
      this.isStatusBar = widgetProps.isStatusBar;

    this.widgetType = this.isFreeform ? WidgetType.FreeFrom : WidgetType.Rectangular;

    if (widgetProps.applicationData !== undefined)
      this.applicationData = widgetProps.applicationData;

    this._iconLabelSupport = new IconLabelSupport(widgetProps);

    if (widgetProps.reactElement !== undefined)
      this._widgetReactNode = widgetProps.reactElement;

    if (this.defaultState === WidgetState.Open)
      this.isDefaultOpen = true;
  }

  public get label(): string { return this._iconLabelSupport.label; }
  public get tooltip(): string { return this._iconLabelSupport.tooltip; }
  public get iconInfo(): IconInfo { return this._iconLabelSupport.iconInfo; }

  public get widgetControl(): WidgetControl | undefined {
    // TODO - should call getConfigurable if widget is sharable
    if (!this._widgetControl) {
      this._widgetControl = ConfigurableUiManager.createConfigurable(this.classId, this.id) as WidgetControl;
      if (this._widgetControl) {
        this._widgetControl.widgetDef = this;
      }
    }

    return this._widgetControl;
  }

  public get reactElement(): React.ReactNode {
    if (!this._widgetReactNode) {
      const widgetControl = this.widgetControl;

      if (widgetControl && widgetControl.reactElement)
        this._widgetReactNode = widgetControl.reactElement;
    }

    return this._widgetReactNode;
  }

  public setWidgetState(state: WidgetState): void {
    this.isDefaultOpen = (state === WidgetState.Open);
    this.defaultOpenUsed = false;

    FrontstageManager.WidgetStateChangedEvent.emit({ widgetDef: this, widgetState: state });
  }
}
