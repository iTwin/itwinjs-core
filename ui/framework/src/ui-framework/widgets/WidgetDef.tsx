/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { AbstractWidgetProps, BadgeType, ConditionalStringValue, StringGetter, UiError, WidgetState } from "@bentley/ui-abstract";
import { UiEvent } from "@bentley/ui-core";
import { Direction, PanelSide } from "@bentley/ui-ninezone";
import { ConfigurableCreateInfo, ConfigurableUiControlConstructor, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { CommandItemDef } from "../shared/CommandItemDef";
import { ItemList } from "../shared/ItemMap";
import { SyncUiEventArgs, SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";
import { UiFramework } from "../UiFramework";
import { PropsHelper } from "../utils/PropsHelper";
import { WidgetControl } from "./WidgetControl";
import { WidgetProps } from "./WidgetProps";

const widgetStateNameMap = new Map<WidgetState, string>([
  [WidgetState.Closed, "Closed"],
  [WidgetState.Floating, "Floating"],
  [WidgetState.Hidden, "Hidden"],
  [WidgetState.Open, "Open"],
  [WidgetState.Unloaded, "Unloaded"],
]);

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

/** @internal */
export interface WidgetChangedEventArgs {
  widgetDef: WidgetDef;
}

/** @internal */
export interface WidgetEventArgs {
  widgetDef: WidgetDef;
}

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

/** Prototype for WidgetDef StateFunc
 * @public
 */
export type WidgetStateFunc = (state: Readonly<WidgetState>) => WidgetState;

/** @internal */
export interface TabLocation {
  widgetId: string;
  widgetIndex: number;
  side: PanelSide;
  tabIndex: number;
}

// -----------------------------------------------------------------------------

/** A Widget Definition in the 9-Zone Layout system.
 * @public
 */
export class WidgetDef {
  private static _sId = 0;
  private _label: string | ConditionalStringValue | StringGetter = "";
  private _tooltip: string | ConditionalStringValue | StringGetter = "";
  private _widgetReactNode: React.ReactNode;
  private _widgetControl!: WidgetControl;
  private _defaultState: WidgetState = WidgetState.Unloaded;
  private _state: WidgetState = WidgetState.Unloaded;
  private _id: string;
  private _classId: string | ConfigurableUiControlConstructor | undefined = undefined;
  private _priority: number = 0;
  private _isFreeform: boolean = false;
  private _isFloatingStateSupported: boolean = false;
  private _isFloatingStateWindowResizable: boolean = true;
  private _isToolSettings: boolean = false;
  private _isStatusBar: boolean = false;
  private _stateChanged: boolean = false;
  private _fillZone: boolean = false;
  private _syncEventIds: string[] = [];
  private _stateFunc?: WidgetStateFunc;
  private _widgetType: WidgetType = WidgetType.Rectangular;
  private _applicationData?: any;
  private _iconSpec?: string | ConditionalStringValue | React.ReactNode;
  private _badgeType?: BadgeType;
  private _onWidgetStateChanged?: () => void;
  private _saveTransientState?: () => void;
  private _restoreTransientState?: () => boolean;
  private _preferredPanelSize: "fit-content" | undefined;
  private _canPopout?: boolean;

  private _tabLocation: TabLocation = {
    side: "left",
    tabIndex: 0,
    widgetId: "",
    widgetIndex: 0,
  };

  public get state(): WidgetState { return this._state; }
  public get id(): string { return this._id; }
  public get classId(): string | ConfigurableUiControlConstructor | undefined { return this._classId; }
  public get priority(): number { return this._priority; }
  public get isFreeform(): boolean { return this._isFreeform; }
  public get isFloatingStateSupported(): boolean { return this._isFloatingStateSupported; }
  public get isFloatingStateWindowResizable(): boolean { return this._isFloatingStateWindowResizable; }
  public get isToolSettings(): boolean { return this._isToolSettings; }
  public get isStatusBar(): boolean { return this._isStatusBar; }
  public get stateChanged(): boolean { return this._stateChanged; }
  public get fillZone(): boolean { return this._fillZone; }
  public get syncEventIds(): string[] { return this._syncEventIds; }
  public get stateFunc(): WidgetStateFunc | undefined { return this._stateFunc; }
  public get applicationData(): any | undefined { return this._applicationData; }
  public get isFloating(): boolean { return this._state === WidgetState.Floating; }
  public get iconSpec(): string | ConditionalStringValue | React.ReactNode { return this._iconSpec; }
  public get badgeType(): BadgeType | undefined { return this._badgeType; }

  public get widgetType(): WidgetType { return this._widgetType; }
  public set widgetType(type: WidgetType) { this._widgetType = type; }

  /** @internal */
  public get tabLocation() { return this._tabLocation; }
  public set tabLocation(tabLocation: TabLocation) { this._tabLocation = tabLocation; }

  /** @internal */
  public get defaultState() { return this._defaultState; }

  constructor(widgetProps: WidgetProps) {
    if (widgetProps.id !== undefined)
      this._id = widgetProps.id;
    else {
      WidgetDef._sId++;
      this._id = `Widget-${WidgetDef._sId}`;
    }

    WidgetDef.initializeFromWidgetProps(widgetProps, this);
  }

  public static initializeFromWidgetProps(widgetProps: WidgetProps, me: WidgetDef) {
    if (widgetProps.label)
      me.setLabel(widgetProps.label);
    else if (widgetProps.labelKey)
      me._label = UiFramework.i18n.translate(widgetProps.labelKey);

    me.setCanPopout(widgetProps.canPopout);

    if (widgetProps.priority !== undefined)
      me._priority = widgetProps.priority;

    if (widgetProps.tooltip)
      me.setTooltip(widgetProps.tooltip);
    else if (widgetProps.tooltipKey)
      me._tooltip = UiFramework.i18n.translate(widgetProps.tooltipKey);

    if (widgetProps.control !== undefined)
      me._classId = widgetProps.control;
    else if (widgetProps.classId !== undefined)
      me._classId = widgetProps.classId;

    if (widgetProps.defaultState !== undefined) {
      me._state = widgetProps.defaultState;
      me._defaultState = widgetProps.defaultState;
    }

    if (widgetProps.isFreeform !== undefined) {
      me._isFreeform = widgetProps.isFreeform;
      me._widgetType = me.isFreeform ? WidgetType.FreeFrom : WidgetType.Rectangular;
    }

    if (widgetProps.isFloatingStateSupported !== undefined)
      me._isFloatingStateSupported = widgetProps.isFloatingStateSupported;
    if (widgetProps.isFloatingStateWindowResizable !== undefined)
      me._isFloatingStateWindowResizable = widgetProps.isFloatingStateWindowResizable;
    if (widgetProps.isToolSettings !== undefined)
      me._isToolSettings = widgetProps.isToolSettings;
    if (widgetProps.isStatusBar !== undefined)
      me._isStatusBar = widgetProps.isStatusBar;
    if (widgetProps.fillZone !== undefined)
      me._fillZone = widgetProps.fillZone;

    if (widgetProps.applicationData !== undefined)
      me._applicationData = widgetProps.applicationData;

    if (widgetProps.element !== undefined)
      me._widgetReactNode = widgetProps.element;

    if (widgetProps.iconSpec !== undefined)
      me._iconSpec = widgetProps.iconSpec;
    // istanbul ignore if
    if (widgetProps.icon !== undefined)
      me._iconSpec = widgetProps.icon;

    if (widgetProps.badgeType !== undefined)
      me._badgeType = widgetProps.badgeType;

    me._preferredPanelSize = widgetProps.preferredPanelSize;
    me._onWidgetStateChanged = widgetProps.onWidgetStateChanged;
    me._saveTransientState = widgetProps.saveTransientState;
    me._restoreTransientState = widgetProps.restoreTransientState;

    me.setUpSyncSupport(widgetProps);
  }

  public static createWidgetPropsFromAbstractProps(abstractWidgetProps: AbstractWidgetProps): WidgetProps {
    const widgetProps: WidgetProps = abstractWidgetProps;
    widgetProps.element = abstractWidgetProps.getWidgetContent();
    return widgetProps;
  }

  public setUpSyncSupport(props: WidgetProps) {
    if (props.stateFunc && props.syncEventIds && props.syncEventIds.length > 0) {
      this._syncEventIds = props.syncEventIds;
      this._stateFunc = props.stateFunc;
      SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    }
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if ((this.syncEventIds.length > 0) && this.syncEventIds.some((value: string): boolean => args.eventIds.has(value.toLowerCase()))) {
      // istanbul ignore else
      if (this.stateFunc) {
        let newState = this.state;
        newState = this.stateFunc(newState);
        this.setWidgetState(newState);
      }
    }
  };

  /** @alpha */
  public get preferredPanelSize() {
    return this._preferredPanelSize;
  }

  /** Get the label string */
  public get label(): string {
    return PropsHelper.getStringFromSpec(this._label);
  }

  /** Set the label.
   * @param v A string or a function to get the string.
   */
  public setLabel(v: string | ConditionalStringValue | StringGetter) {
    if (this._label === v)
      return;
    this._label = v;
    FrontstageManager.onWidgetLabelChangedEvent.emit({ widgetDef: this });
  }

  /** Get the tooltip string */
  public get tooltip(): string {
    return PropsHelper.getStringFromSpec(this._tooltip);
  }

  /** Set the tooltip.
   * @param v A string or a function to get the string.
   */
  public setTooltip(v: string | ConditionalStringValue | StringGetter) {
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
          throw new UiError(UiFramework.loggerCategory(this), `getWidgetControl: '${usedClassId}' is NOT a ${type}; it is a ${this._widgetControl.getType()}`);
        }

        this._widgetControl.widgetDef = this;
        this._widgetControl.initialize();
      }
    }

    return this._widgetControl;
  }

  public get reactNode(): React.ReactNode {
    if (!this._widgetReactNode) {
      const widgetControl = this.getWidgetControl(ConfigurableUiControlType.Widget);

      // istanbul ignore else
      if (widgetControl && widgetControl.reactNode)
        this._widgetReactNode = widgetControl.reactNode;
    }

    return this._widgetReactNode;
  }

  public set reactNode(node: React.ReactNode) {
    this._widgetReactNode = node;
  }

  /** @deprecated use reactNode */
  // istanbul ignore next
  public get reactElement(): React.ReactNode {
    return this.reactNode;
  }
  // istanbul ignore next
  public set reactElement(node: React.ReactNode) {
    this.reactNode = node;
  }

  public setWidgetState(newState: WidgetState): void {
    if (this.state === newState)
      return;
    this._state = newState;
    this._stateChanged = true;
    FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef: this, widgetState: newState });
    this.onWidgetStateChanged();
  }

  public setCanPopout(value: boolean | undefined) {
    this._canPopout = value;
  }

  public get canPopout(): boolean | undefined {
    return (this._canPopout);
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

  public onWidgetStateChanged(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.widgetControl && UiFramework.postTelemetry(`Widget ${this.widgetControl.classId} state set to ${widgetStateNameMap.get(this._state)}`, "35402486-9839-441E-A5C7-46D546142D11");
    this.widgetControl && this.widgetControl.onWidgetStateChanged();
    this._onWidgetStateChanged && this._onWidgetStateChanged();
  }

  /** Overwrite to save transient DOM state (i.e. scroll offset). */
  public saveTransientState(): void {
    this.widgetControl && this.widgetControl.saveTransientState();
    this._saveTransientState && this._saveTransientState();
  }

  /** Overwrite to restore transient DOM state.
   * @note Return true if the state is restored or the Widget will remount.
   */
  public restoreTransientState(): boolean {
    let result = true;
    if (this.widgetControl || this._restoreTransientState) {
      let result1 = false, result2 = false;
      if (this.widgetControl)
        result1 = this.widgetControl.restoreTransientState();
      if (this._restoreTransientState)
        result2 = this._restoreTransientState();
      result = !(result1 || result2);
    }
    return result;
  }

  /** Opens the widget and makes it visible to the user.
   * I.e. opens the stage panel or brings the floating widget to front of the screen.
   * @alpha
   */
  public show() {
    FrontstageManager.onWidgetShowEvent.emit({ widgetDef: this });
  }

  /** Opens the widget and expands it to fill full size of the stage panel.
   * @alpha
   */
  public expand() {
    FrontstageManager.onWidgetExpandEvent.emit({ widgetDef: this });
  }
}
