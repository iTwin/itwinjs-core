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
import { ItemDefBase, BaseItemState } from "./ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../SyncUiEventDispatcher";

import { Direction } from "@bentley/ui-ninezone";
import { ItemList } from "./ItemMap";

// -----------------------------------------------------------------------------
// WidgetDef and sub-interfaces
// -----------------------------------------------------------------------------

/** Widget state enum.
 */
export enum WidgetState {
  Open,     // widgetTab is visible and active and its contents are visible.
  Close,    // widgetTab is visible but its contents are not visible.
  Hidden,   // widgetTab nor its contents are visible
  Visible,  // widgetTab is visible in zone's tab stack
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
  isFloating?: boolean;                         // Default - false
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

export interface WidgetDefState extends BaseItemState {
  widgetState?: number;
  isFloating?: boolean;
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
  public priority: number = 0;

  public featureId: string = "";
  public isFreeform: boolean = false;
  public isFloatingStateSupported: boolean = false;
  public isFloatingStateWindowResizable: boolean = true;
  public isToolSettings: boolean = false;
  public isStatusBar: boolean = false;
  public stateChanged: boolean = false;
  public fillZone: boolean = false;
  public stateFunc?: (state: Readonly<WidgetDefState>) => WidgetDefState;  // override stateFunc from ItemDefBase to use widget-specific properties
  public widgetType: WidgetType = WidgetType.Rectangular;
  public applicationData?: any;

  private _widgetReactNode: React.ReactNode;
  private _widgetControl!: WidgetControl;
  public isFloating: boolean = false;

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    let refreshState = false;

    if (this.stateSyncIds && this.stateSyncIds.length > 0)
      refreshState = this.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState) {
      if (this.stateFunc) {
        let newState: WidgetDefState = {
          isVisible: this.isVisible,
          isEnabled: this.isEnabled,
          isActive: this.isActive,
          isFloating: this.isFloating,
        };
        newState = this.stateFunc(newState);
        this.applyStateChanges(newState);
      }
    }
  }

  private applyStateChanges(newState: WidgetDefState): void {
    // if widgetState is defined then use it, else use individual properties
    if (undefined !== newState.widgetState) {
      this.setWidgetState(newState.widgetState);
      return;
    }

    let stateChanged = false;
    if (undefined !== newState.isVisible && newState.isVisible !== this.isVisible) {
      stateChanged = true;
      this.isVisible = newState.isVisible;
    }

    if (undefined !== newState.isActive && newState.isActive !== this.isActive) {
      stateChanged = true;
      this.isActive = newState.isActive;
    }

    if (undefined !== newState.isFloating && newState.isFloating !== this.isFloating) {
      stateChanged = true;
      this.isFloating = newState.isFloating;
    }

    if (stateChanged) {
      this.stateChanged = true;
      FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef: this });
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
        this.applyWidgetState(widgetProps.defaultState);
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
        this.isVisible = widgetProps.isVisible;
      else
        this.isVisible = true;

      this.isActive = false;

      if (widgetProps.isFloating !== undefined)
        this.isFloating = widgetProps.isFloating;
      else
        this.isFloating = false;

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

  public applyWidgetState(state: WidgetState): boolean {
    let stateChanged = false;

    switch (state) {
      case WidgetState.Open:
        if (!this.isVisible || !this.isActive) {
          stateChanged = true;
          this.isVisible = true;
          this.isActive = true;
        }
        break;
      case WidgetState.Close:
        if (!this.isVisible || this.isActive) {
          stateChanged = true;
          this.isVisible = true;
          this.isActive = false;
        }
        break;
      case WidgetState.Hidden:
        if (this.isVisible || !this.isFloating) {
          stateChanged = true;
          this.isVisible = false;
          this.isFloating = false;
        }
        break;
      case WidgetState.Visible:
        if (!this.isVisible) {
          stateChanged = true;
          this.isVisible = true;
        }
        break;
      case WidgetState.Floating:
        if (!this.isVisible || !this.isFloating) {
          stateChanged = true;
          this.isFloating = true;
          this.isVisible = true;
        }
        break;
    }

    return stateChanged;
  }

  public setWidgetState(state: WidgetState): void {
    if (this.applyWidgetState(state)) {
      this.stateChanged = true;
      FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef: this });
    }
  }

  public canOpen(): boolean {
    return (this.isActive || this.isFloating);
  }
}
