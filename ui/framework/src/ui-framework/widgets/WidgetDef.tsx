/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { UiFramework } from "../UiFramework";
import { WidgetProps } from "./Widget";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { WidgetControl } from "./WidgetControl";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ConfigurableUiControlType, ConfigurableUiControlConstructor, ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { CommandItemDef } from "../shared/Item";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { StringGetter } from "../shared/ItemProps";

import { Direction } from "@bentley/ui-ninezone";
import { ItemList } from "../shared/ItemMap";

// -----------------------------------------------------------------------------
// WidgetDef and sub-interfaces
// -----------------------------------------------------------------------------

/** Widget state enum.
 */
export enum WidgetState {
  Open,     // widgetTab is visible and active and its contents are visible.
  Closed,   // widgetTab is visible but its contents are not visible.
  Hidden,   // widgetTab nor its contents are visible
  Floating, // widgetTab is in a 'floating' state and is not docked in zone's tab stack.
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

/** Properties for a Toolbar Widget.
 */
export interface ToolbarWidgetProps extends WidgetProps {
  horizontalDirection?: Direction;
  verticalDirection?: Direction;

  horizontalItems?: ItemList;
  verticalItems?: ItemList;
}

/** Properties for a Tool Widget.
 */
export interface ToolWidgetProps extends ToolbarWidgetProps {
  appButton?: CommandItemDef;
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
  private static _sId = 0;
  private _label: string | StringGetter = "";
  private _tooltip: string | StringGetter = "";
  private _widgetReactNode: React.ReactNode;
  private _widgetControl!: WidgetControl;

  public state: WidgetState = WidgetState.Closed;
  public id: string;
  public classId: string | ConfigurableUiControlConstructor | undefined = undefined;
  public priority: number = 0;
  public featureId: string = "";
  public isFreeform: boolean = false;
  public isFloatingStateSupported: boolean = false;
  public isFloatingStateWindowResizable: boolean = true;
  public isToolSettings: boolean = false;
  public isStatusBar: boolean = false;
  public stateChanged: boolean = false;
  public fillZone: boolean = false;
  public syncEventIds: string[] = [];
  public stateFunc?: (state: Readonly<WidgetState>) => WidgetState;
  public widgetType: WidgetType = WidgetType.Rectangular;
  public applicationData?: any;
  public isFloating = false;
  public iconSpec?: string | React.ReactNode;

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if ((this.syncEventIds.length > 0) && this.syncEventIds.some((value: string): boolean => args.eventIds.has(value))) {
      if (this.stateFunc) {
        let newState = this.state;
        newState = this.stateFunc(newState);
        this.setWidgetState(newState);
      }
    }
  }

  constructor(widgetProps?: WidgetProps) {
    if (widgetProps && widgetProps.id !== undefined)
      this.id = widgetProps.id;
    else {
      WidgetDef._sId++;
      this.id = "Widget-" + WidgetDef._sId;
    }

    if (widgetProps)
      WidgetDef.initializeFromWidgetProps(widgetProps, this);
  }

  public static initializeFromWidgetProps(widgetProps: WidgetProps, me: WidgetDef) {
    if (widgetProps.label)
      me.setLabel(widgetProps.label);
    else if (widgetProps.labelKey)
      me._label = UiFramework.i18n.translate(widgetProps.labelKey);

    if (widgetProps.priority !== undefined)
      me.priority = widgetProps.priority;

    if (widgetProps.tooltip)
      me.setTooltip(widgetProps.tooltip);
    else if (widgetProps.tooltipKey)
      me._tooltip = UiFramework.i18n.translate(widgetProps.tooltipKey);

    if (widgetProps.control !== undefined)
      me.classId = widgetProps.control;
    else if (widgetProps.classId !== undefined)
      me.classId = widgetProps.classId;

    if (widgetProps.defaultState !== undefined)
      me.state = widgetProps.defaultState;

    if (widgetProps.featureId !== undefined)
      me.featureId = widgetProps.featureId;
    if (widgetProps.isFreeform !== undefined) {
      me.isFreeform = widgetProps.isFreeform;
      me.widgetType = me.isFreeform ? WidgetType.FreeFrom : WidgetType.Rectangular;
    }

    if (widgetProps.isFloatingStateSupported !== undefined)
      me.isFloatingStateSupported = widgetProps.isFloatingStateSupported;
    if (widgetProps.isFloatingStateWindowResizable !== undefined)
      me.isFloatingStateWindowResizable = widgetProps.isFloatingStateWindowResizable;
    if (widgetProps.isToolSettings !== undefined)
      me.isToolSettings = widgetProps.isToolSettings;
    if (widgetProps.isStatusBar !== undefined)
      me.isStatusBar = widgetProps.isStatusBar;
    if (widgetProps.fillZone !== undefined)
      me.fillZone = widgetProps.fillZone;

    if (widgetProps.applicationData !== undefined)
      me.applicationData = widgetProps.applicationData;

    if (widgetProps.element !== undefined)
      me._widgetReactNode = widgetProps.element;

    if (widgetProps.iconSpec !== undefined)
      me.iconSpec = widgetProps.iconSpec;

    me.setUpSyncSupport(widgetProps);
  }

  public setUpSyncSupport(props: WidgetProps) {
    if (props.stateFunc && props.syncEventIds && props.syncEventIds.length > 0) {
      this.syncEventIds = props.syncEventIds;
      this.stateFunc = props.stateFunc;
      SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    }
  }

  /** Get the label string */
  public get label(): string {
    let label = "";
    if (typeof this._label === "string")
      label = this._label;
    else
      label = this._label();
    return label;
  }

  /** Set the label.
   * @param v A string or a function to get the string.
   */
  public setLabel(v: string | StringGetter) {
    this._label = v;
  }

  /** Get the tooltip string */
  public get tooltip(): string {
    let tooltip = "";
    if (typeof this._tooltip === "string")
      tooltip = this._tooltip;
    else
      tooltip = this._tooltip();
    return tooltip;
  }

  /** Set the tooltip.
   * @param v A string or a function to get the string.
   */
  public setTooltip(v: string | StringGetter) {
    this._tooltip = v;
  }

  public get widgetControl(): WidgetControl | undefined {
    return this._widgetControl;
  }

  public getWidgetControl(type: ConfigurableUiControlType): WidgetControl | undefined {
    if (!this._widgetControl && this.classId) {
      if (typeof this.classId === "string") {
        if (this.classId) {
          this._widgetControl = ConfigurableUiManager.createControl(this.classId, this.id, this.applicationData) as WidgetControl;
          if (this._widgetControl.getType() !== type) {
            throw Error("WidgetDef.widgetControl error: classId '" + this.classId + "' is registered to a control that is NOT a Widget");
          }
          this._widgetControl.initialize();
        }
      } else {
        const info = new ConfigurableCreateInfo(this.classId.name, this.id, this.id);
        this._widgetControl = new this.classId(info, this.applicationData) as WidgetControl;
      }

      if (this._widgetControl) {
        this._widgetControl.widgetDef = this;
      }
    }

    return this._widgetControl;
  }

  public get reactElement(): React.ReactNode {
    if (!this._widgetReactNode) {
      const widgetControl = this.getWidgetControl(ConfigurableUiControlType.Widget);

      if (widgetControl && widgetControl.reactElement)
        this._widgetReactNode = widgetControl.reactElement;
    }

    return this._widgetReactNode;
  }

  public set reactElement(node: React.ReactNode) {
    this._widgetReactNode = node;
  }

  public setWidgetState(newState: WidgetState): void {
    this.state = newState;
    FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef: this });
  }

  public canOpen(): boolean {
    return (this.isFloating || this.isActive);
  }

  public get isVisible(): boolean {
    return (WidgetState.Hidden !== this.state);
  }

  public get activeState(): WidgetState {
    return this.state;
  }

  public get isActive(): boolean {
    return WidgetState.Open === this.activeState;
  }

}
