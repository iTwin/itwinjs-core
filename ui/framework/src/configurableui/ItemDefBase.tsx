/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { UiFramework } from "../UiFramework";
import { ItemProps } from "./ItemProps";

/** Base state for any 'stateful' React component */
export interface BaseItemState {
  isVisible?: boolean;        // Default - true
  isEnabled?: boolean;        // Default - true
  isActive?: boolean;         // Default - false
}

/** The base class for Items. */
export abstract class ItemDefBase {
  public isVisible: boolean = true;
  public isEnabled: boolean = true;
  public isPressed: boolean = false;
  public featureId: string = "";
  public applicationData?: any;

  public stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  public stateSyncIds: string[] = [];

  public label: string = "";
  public tooltip: string = "";
  public iconSpec?: string | React.ReactNode;
  public iconElement?: React.ReactNode;

  public static initializeDef(me: ItemDefBase, itemProps: ItemProps): void {

    me.isVisible = (itemProps.isVisible !== undefined) ? itemProps.isVisible : true;
    me.isEnabled = (itemProps.isEnabled !== undefined) ? itemProps.isEnabled : true;
    me.isPressed = (itemProps.isPressed !== undefined) ? itemProps.isPressed : false;

    if (itemProps.featureId !== undefined) me.featureId = itemProps.featureId;
    if (itemProps.applicationData !== undefined) me.applicationData = itemProps.applicationData;
    if (itemProps.iconSpec) me.iconSpec = itemProps.iconSpec;

    if (itemProps.label)
      me.label = itemProps.label;
    else if (itemProps.labelKey)
      me.label = UiFramework.i18n.translate(itemProps.labelKey);

    if (itemProps.tooltip)
      me.tooltip = itemProps.tooltip;
    else if (itemProps.tooltipKey)
      me.tooltip = UiFramework.i18n.translate(itemProps.tooltipKey);

    if (itemProps.stateFunc)
      me.stateFunc = itemProps.stateFunc;

    if (itemProps.stateSyncIds)
      me.stateSyncIds = itemProps.stateSyncIds;
  }

  constructor(itemProps?: ItemProps) {
    if (itemProps) {
      ItemDefBase.initializeDef(this, itemProps);
    }
  }

  public get trayId() { return undefined; }
  public abstract get id(): string;
}
