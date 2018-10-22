/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import IconLabelSupport, { IconInfo } from "./IconLabelSupport";
import { ItemProps } from "./ItemProps";

// -----------------------------------------------------------------------------
// ItemBase and subclasses
// -----------------------------------------------------------------------------

/** The base class for Items.
 */
export abstract class ItemDefBase {
  public isVisible: boolean = true;
  public isVisibleExpr: string = "";
  public isEnabled: boolean = true;
  public isEnabledExpr: string = "";
  public featureId: string = "";
  public itemSyncMsg: string = "";
  public isPressed: boolean = false;
  public applicationData?: any;

  private _iconLabelSupport!: IconLabelSupport;

  constructor(itemProps?: ItemProps) {
    if (itemProps) {
      this.isVisible = (itemProps.isVisible !== undefined) ? itemProps.isVisible : true;
      // isVisibleExpr?: string;
      this.isEnabled = (itemProps.isEnabled !== undefined) ? itemProps.isEnabled : true;
      // isEnabledExpr?: string;

      if (itemProps.featureId !== undefined)
        this.featureId = itemProps.featureId;
      if (itemProps.itemSyncMsg !== undefined)
        this.itemSyncMsg = itemProps.itemSyncMsg;
      if (itemProps.applicationData !== undefined)
        this.applicationData = itemProps.applicationData;

      this._iconLabelSupport = new IconLabelSupport(itemProps);
    }

    this.execute = this.execute.bind(this);
  }

  public abstract get id(): string;
  public abstract execute(): void;
  public abstract toolbarReactNode(index?: number): React.ReactNode;

  public get label(): string { return this._iconLabelSupport.label; }
  public get tooltip(): string { return this._iconLabelSupport.tooltip; }
  public get iconInfo(): IconInfo { return this._iconLabelSupport.iconInfo; }
  public get trayId() { return undefined; }
}

export default ItemDefBase;
