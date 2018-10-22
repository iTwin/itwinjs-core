/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import { ConfigurableCreateInfo, ConfigurableUiControl, ConfigurableUiControlType } from "./ConfigurableUiControl";
import { WidgetDef, WidgetState } from "./WidgetDef";

// -----------------------------------------------------------------------------
// Configurable Ui Widget Control
// -----------------------------------------------------------------------------

/** Properties for a Widget React component.
 */
export interface WidgetComponentProps {
  widgetControl: WidgetControl;
}

/** The base class for Widget controls.
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
}

export default WidgetControl;
