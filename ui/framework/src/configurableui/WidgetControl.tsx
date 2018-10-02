/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import { ConfigurableCreateInfo, ConfigurableUIControl, ConfigurableUIControlType } from "./ConfigurableUIControl";
import { WidgetDef, WidgetState } from "./WidgetDef";

// -----------------------------------------------------------------------------
// Configurable Ui Widget Control
// -----------------------------------------------------------------------------

/** Props for a WidgetControl.
 */
export interface WidgetControlProps {
  widgetControl: WidgetControl;
}

/** The base class for Widget controls.
 */
export class WidgetControl extends ConfigurableUIControl {
  private _widgetDef!: WidgetDef;
  private _reactElement: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public get reactElement(): React.ReactNode { return this._reactElement; }
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }

  public get widgetDef() { return this._widgetDef; }
  public set widgetDef(w: WidgetDef) { this._widgetDef = w; }

  public getType(): ConfigurableUIControlType { return ConfigurableUIControlType.Widget; }

  public setWidgetState(state: WidgetState): void {
    this.widgetDef.setWidgetState(state);
  }
}

export default WidgetControl;
