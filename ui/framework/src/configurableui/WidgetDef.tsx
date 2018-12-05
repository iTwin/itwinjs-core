/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { ItemProps } from "./ItemProps";
import { ConfigurableUiManager } from "./ConfigurableUiManager";
import { WidgetControl } from "./WidgetControl";
import { FrontstageManager } from "./FrontstageManager";
import { ConfigurableUiControlType, ConfigurableUiControlConstructor, ConfigurableCreateInfo } from "./ConfigurableUiControl";
import { CommandItemDef } from "../configurableui/Item";
import { ItemDefBase } from "./ItemDefBase";
import { BaseItemState } from "./ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../SyncUiEventDispatcher";

import { Direction } from "@bentley/ui-ninezone";
import { ItemList } from "./ItemMap";

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
export interface WidgetDefProps extends ItemProps {
  id?: string;

  classId?: string | ConfigurableUiControlConstructor;
  defaultState?: WidgetState;
  priority?: number;

  featureId?: string;
  isFreeform?: boolean;                         // Default - false
  isFloatingStateSupported?: boolean;           // Default - false
  isFloatingStateWindowResizable?: boolean;     // Default - true
  isToolSettings?: boolean;                     // Default - false
  isStatusBar?: boolean;                        // Default - false
  fillZone?: boolean;                           // Default - false

  applicationData?: any;

  reactElement?: React.ReactNode;
}

/** Properties for a Toolbar Widget.
 */
export interface ToolbarWidgetProps extends WidgetDefProps {
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
export type AnyWidgetProps = WidgetDefProps | ToolWidgetProps | NavigationWidgetProps;

// -----------------------------------------------------------------------------
// Widget and subclasses
// -----------------------------------------------------------------------------

/** A Widget Definition in the 9-Zone Layout system.
 */
export class WidgetDef extends ItemDefBase {
  private static _sId = 0;

  public id: string;
  public classId: string | ConfigurableUiControlConstructor | undefined = undefined;
  public widgetState: WidgetState = WidgetState.Open;
  public priority: number = 0;

  public featureId: string = "";
  public isFreeform: boolean = false;
  public isFloatingStateSupported: boolean = false;
  public isFloatingStateWindowResizable: boolean = true;
  public isToolSettings: boolean = false;
  public isStatusBar: boolean = false;
  public stateChanged: boolean = false;
  public fillZone: boolean = false;
  public stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  public stateSyncIds: string[] = [];
  public widgetType: WidgetType = WidgetType.Rectangular;
  public applicationData?: any;

  private _widgetReactNode: React.ReactNode;
  private _widgetControl!: WidgetControl;
  private _isVisible = true;

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    let refreshState = false;

    if (this.stateSyncIds && this.stateSyncIds.length > 0)
      refreshState = this.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState) {
      let newState: BaseItemState = {
        isVisible: this._isVisible,
        isEnabled: true,
        isActive: false,
      };

      if (this.stateFunc)
        newState = this.stateFunc(newState);

      if (undefined !== newState.isVisible && this._isVisible !== newState.isVisible) {
        this._isVisible = newState.isVisible;
        this.setWidgetState(this.widgetState);
      }
    }
  }

  constructor(widgetProps?: WidgetDefProps) {
    super(widgetProps);
    if (widgetProps && widgetProps.id !== undefined)
      this.id = widgetProps.id;
    else {
      WidgetDef._sId++;
      this.id = "Widget-" + WidgetDef._sId;
    }

    if (widgetProps) {
      if (widgetProps.classId !== undefined)
        this.classId = widgetProps.classId;
      if (widgetProps.defaultState !== undefined)
        this.widgetState = widgetProps.defaultState;
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
      if (widgetProps.fillZone !== undefined)
        this.fillZone = widgetProps.fillZone;

      this.widgetType = this.isFreeform ? WidgetType.FreeFrom : WidgetType.Rectangular;

      if (widgetProps.applicationData !== undefined)
        this.applicationData = widgetProps.applicationData;

      if (widgetProps.isVisible !== undefined)
        this._isVisible = widgetProps.isVisible;

      if (widgetProps.reactElement !== undefined)
        this._widgetReactNode = widgetProps.reactElement;

      if (widgetProps.stateFunc && widgetProps.stateSyncIds && widgetProps.stateSyncIds.length > 0) {
        this.stateSyncIds = widgetProps.stateSyncIds;
        this.stateFunc = widgetProps.stateFunc;
        SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
      }
    }
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

  public setWidgetState(state: WidgetState): void {
    const oldWidgetState = this.widgetState;
    this.widgetState = state;
    this.stateChanged = oldWidgetState !== state;
    FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef: this, oldWidgetState, newWidgetState: state });
  }

  public canShow(): boolean {
    return (this._isVisible && this.widgetState !== WidgetState.Off && this.widgetState !== WidgetState.Hidden);
  }

  public canOpen(): boolean {
    return (this.widgetState === WidgetState.Open || this.widgetState === WidgetState.Floating || this.widgetState === WidgetState.Footer);
  }
}
