/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { ConfigurableCreateInfo, ConfigurableUiControl, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { WidgetDef, WidgetState } from "./WidgetDef";

/** The base class for Widget controls.
 * @public
 */
export class WidgetControl extends ConfigurableUiControl {
  private _widgetDef!: WidgetDef;
  private _reactElement: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Gets the React element associated with this control */
  public get reactElement(): React.ReactNode { return this._reactElement; }
  /** Sets the React element associated with this control */
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }

  /** Gets the [[WidgetDef]] associated with this control */
  public get widgetDef(): WidgetDef { return this._widgetDef; }
  /** Sets the [[WidgetDef]] associated with this control */
  public set widgetDef(w: WidgetDef) { this._widgetDef = w; }

  /** Gets the type of ConfigurableUiControl, which is 'Widget' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.Widget; }

  /** Sets the [[WidgetState]] for this control */
  public setWidgetState(state: WidgetState): void {
    this.widgetDef.setWidgetState(state);
  }

  /** Called when widget state changes. */
  public onWidgetStateChanged(): void {
  }

  /** Overwrite to save transient DOM state (i.e. scroll offset). */
  public saveTransientState(): void {
  }

  /** Overwrite to restore transient DOM state.
   * @note Return true if the state is restored or the Widget will remount.
   */
  public restoreTransientState(): boolean {
    return false;
  }
}
