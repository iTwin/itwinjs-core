/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { ItemProps, StringGetter } from "./ItemProps";
import { PropsHelper } from "../utils/PropsHelper";

/** Base state for any 'stateful' React component */
export interface BaseItemState {
  isVisible?: boolean;        // Default - true
  isEnabled?: boolean;        // Default - true
  isActive?: boolean;         // Default - false
  isPressed?: boolean;        // Default - false
}

/** The base class for Items. */
export abstract class ItemDefBase {
  private _label: string | StringGetter = "";
  private _tooltip: string | StringGetter = "";

  public isVisible: boolean = true;
  public isEnabled: boolean = true;
  public isPressed: boolean = false;
  public isActive: boolean = false;
  public featureId: string = "";
  public applicationData?: any;

  public stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  public stateSyncIds: string[] = [];

  public iconSpec?: string | React.ReactNode;
  public iconElement?: React.ReactNode;

  public static initializeDef(me: ItemDefBase, itemProps: ItemProps): void {

    me.isVisible = (itemProps.isVisible !== undefined) ? itemProps.isVisible : true;
    me.isEnabled = (itemProps.isEnabled !== undefined) ? itemProps.isEnabled : true;
    me.isPressed = (itemProps.isPressed !== undefined) ? itemProps.isPressed : false;
    me.isActive = (itemProps.isActive !== undefined) ? itemProps.isActive : false;

    if (itemProps.featureId !== undefined) me.featureId = itemProps.featureId;
    if (itemProps.applicationData !== undefined) me.applicationData = itemProps.applicationData;
    if (itemProps.iconSpec) me.iconSpec = itemProps.iconSpec;

    me._label = PropsHelper.getStringSpec(itemProps.label, itemProps.labelKey);
    me._tooltip = PropsHelper.getStringSpec(itemProps.tooltip, itemProps.tooltipKey);

    if (itemProps.stateFunc)
      me.stateFunc = itemProps.stateFunc;

    if (itemProps.stateSyncIds)
      me.stateSyncIds = itemProps.stateSyncIds.map((value) => value.toLowerCase());
  }

  constructor(itemProps?: ItemProps) {
    if (itemProps) {
      ItemDefBase.initializeDef(this, itemProps);
    }
  }

  public get trayId() { return undefined; }
  public abstract get id(): string;

  /** Get the label string */
  public get label(): string {
    return PropsHelper.getStringFromSpec(this._label);
  }

  /** Set the label.
   * @param v A string or a function to get the string.
   */
  public setLabel(v: string | StringGetter) {
    this._label = v;
  }

  /** Get the tooltip string */
  public get tooltip(): string {
    return PropsHelper.getStringFromSpec(this._tooltip);
  }

  /** Set the tooltip.
   * @param v A string or a function to get the string.
   */
  public setTooltip(v: string | StringGetter) {
    this._tooltip = v;
  }
}
