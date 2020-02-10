/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { WidgetState } from "@bentley/ui-abstract";
import { ConfigurableCreateInfo, ConfigurableUiControl, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { WidgetDef } from "./WidgetDef";

/** The base class for Widget controls.
 * @public
 */
export class WidgetControl extends ConfigurableUiControl {
  private _widgetDef!: WidgetDef;
  private _reactElement: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** The React element associated with this control */
  public get reactElement(): React.ReactNode { return this._reactElement; }
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }

  /** The [[WidgetDef]] associated with this control */
  public get widgetDef(): WidgetDef { return this._widgetDef; }
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
