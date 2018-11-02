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
  public isVisible?: boolean = true;
  public isEnabled?: boolean = true;
  public isPressed?: boolean = false;
  public featureId?: string = "";
  public applicationData?: any;

  public stateFunc?: (state: Readonly<BaseItemState>) => BaseItemState;
  public stateSyncIds: string[] = [];

  public label: string = "";
  public tooltip: string = "";
  public iconClass?: string = "";
  public iconElement?: React.ReactNode;

  constructor(itemProps?: ItemProps) {
    if (itemProps) {
      this.isVisible = (itemProps.isVisible !== undefined) ? itemProps.isVisible : true;
      this.isEnabled = (itemProps.isEnabled !== undefined) ? itemProps.isEnabled : true;
      this.isPressed = (itemProps.isPressed !== undefined) ? itemProps.isPressed : false;

      if (itemProps.featureId !== undefined) this.featureId = itemProps.featureId;
      if (itemProps.applicationData !== undefined) this.applicationData = itemProps.applicationData;
      if (itemProps.iconClass) this.iconClass = itemProps.iconClass;
      if (itemProps.iconElement) this.iconElement = itemProps.iconElement;

      if (itemProps.label)
        this.label = itemProps.label;
      else if (itemProps.labelKey)
        this.label = UiFramework.i18n.translate(itemProps.labelKey);

      if (itemProps.tooltip)
        this.tooltip = itemProps.tooltip;
      else if (itemProps.tooltipKey)
        this.tooltip = UiFramework.i18n.translate(itemProps.tooltipKey);
    }
  }

  public get trayId() { return undefined; }
  public abstract get id(): string;
}
