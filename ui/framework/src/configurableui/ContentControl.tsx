/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { ConfigurableUiControlType, ConfigurableCreateInfo, ConfigurableUiControl } from "./ConfigurableUiControl";

/** The base class for Frontstage content controls.
 */
export class ContentControl extends ConfigurableUiControl {
  private _reactElement: React.ReactNode;

  /** Creates an instance of ContentControl.
   * @param info         An object that the subclass must pass to this base class.
   * @param options      Options provided via the applicationData in a [[Content]].
   */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Called when this ContentControl is activated */
  public onActivated(): void {
  }

  /** Called when this ContentControl is deactivated */
  public onDeactivated(): void {
  }

  /** Gets the type of ConfigurableUiControl, which is 'Content' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.Content; }

  /** Gets the React element associated with this control */
  public get reactElement(): React.ReactNode { return this._reactElement; }
  /** Sets the React element associated with this control */
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }
}

export default ContentControl;
