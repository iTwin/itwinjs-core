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
import { CommandItemDef } from "../shared/CommandItemDef";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { StringGetter } from "../shared/ItemProps";

import { Direction } from "@bentley/ui-ninezone";
import { ItemList } from "../shared/ItemMap";
import { UiEvent, UiError } from "@bentley/ui-core";

/** Widget state enum.
 * @public
 */
export enum WidgetState {
  /** Widget tab is visible and active and its contents are visible */
  Open,
  /** Widget tab is visible but its contents are not visible */
  Closed,
  /** Widget tab nor its contents are visible */
  Hidden,
  /** Widget tab is in a 'floating' state and is not docked in zone's tab stack */
  Floating,
  /** Widget tab is visible but its contents are not loaded */
  Unloaded,
}

/** Widget State Changed Event Args interface.
 * @public
 */
export interface WidgetStateChangedEventArgs {
  widgetDef: WidgetDef;
  widgetState: WidgetState;
}

/** Widget State Changed Event class.
 * @public
 */
export class WidgetStateChangedEvent extends UiEvent<WidgetStateChangedEventArgs> { }

/** Widget type enum.
 * @public
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
 * @public
 */
export interface ToolbarWidgetProps extends WidgetProps {
  horizontalDirection?: Direction;
  verticalDirection?: Direction;

  horizontalItems?: ItemList;
  verticalItems?: ItemList;
}

/** Properties for a Tool Widget.
 * @public
 */
export interface ToolWidgetProps extends ToolbarWidgetProps {
  appButton?: CommandItemDef;
}

/** Properties for a Navigation Widget.
 * @public
 */
export interface NavigationWidgetProps extends ToolbarWidgetProps {
  navigationAidId?: string;
}

/** Union of all Widget properties.
 * @public
 */
export type AnyWidgetProps = WidgetProps | ToolWidgetProps | NavigationWidgetProps;

// -----------------------------------------------------------------------------

/** A Widget Definition in the 9-Zone Layout system.
 * @public
 */
export class WidgetDef {
  private static _sId = 0;
  private _label: string | StringGetter = "";
  private _tooltip: string | StringGetter = "";
  private _widgetReactNode: React.ReactNode;
  private _widgetControl!: WidgetControl;

  public state: WidgetState = WidgetState.Unloaded;
  public id: string;
  public classId: string | ConfigurableUiControlConstructor | undefined = undefined;
  public priority: number = 0;
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
  public betaBadge?: boolean;

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if ((this.syncEventIds.length > 0) && this.syncEventIds.some((value: string): boolean => args.eventIds.has(value))) {
      // istanbul ignore else
      if (this.stateFunc) {
        let newState = this.state;
        newState = this.stateFunc(newState);
        this.setWidgetState(newState);
      }
    }
  }

  constructor(widgetProps: WidgetProps) {
    if (widgetProps.id !== undefined)
      this.id = widgetProps.id;
    else {
      WidgetDef._sId++;
      this.id = "Widget-" + WidgetDef._sId;
    }

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
    if (widgetProps.betaBadge !== undefined)
      me.betaBadge = widgetProps.betaBadge;

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
      let usedClassId: string = "";

      if (typeof this.classId === "string") {
        // istanbul ignore else
        if (this.classId)
          this._widgetControl = ConfigurableUiManager.createControl(this.classId, this.id, this.applicationData) as WidgetControl;
        usedClassId = this.classId;
      } else {
        const info = new ConfigurableCreateInfo(this.classId.name, this.id, this.id);
        usedClassId = this.classId.name;
        this._widgetControl = new this.classId(info, this.applicationData) as WidgetControl;
      }

      // istanbul ignore else
      if (this._widgetControl) {
        if (this._widgetControl.getType() !== type) {
          throw new UiError(UiFramework.loggerCategory(this), "getWidgetControl: '" + usedClassId + "' is NOT a " + type + "; it is a " + this._widgetControl.getType());
        }

        this._widgetControl.widgetDef = this;
        this._widgetControl.initialize();
      }
    }

    return this._widgetControl;
  }

  public get reactElement(): React.ReactNode {
    if (!this._widgetReactNode) {
      const widgetControl = this.getWidgetControl(ConfigurableUiControlType.Widget);

      // istanbul ignore else
      if (widgetControl && widgetControl.reactElement)
        this._widgetReactNode = widgetControl.reactElement;
    }

    return this._widgetReactNode;
  }

  public set reactElement(node: React.ReactNode) {
    this._widgetReactNode = node;
  }

  public setWidgetState(newState: WidgetState): void {
    if (this.state === newState)
      return;
    this.state = newState;
    FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef: this, widgetState: newState });
    this.widgetControl && this.widgetControl.onWidgetStateChanged();
  }

  public canOpen(): boolean {
    return (this.isFloating || this.isActive);
  }

  public get isVisible(): boolean {
    return WidgetState.Hidden !== this.state;
  }

  public get activeState(): WidgetState {
    return this.state;
  }

  public get isActive(): boolean {
    return WidgetState.Open === this.activeState;
  }

}
