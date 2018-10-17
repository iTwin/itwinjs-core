/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { ConfigurableUiControlType, ConfigurableCreateInfo, ConfigurableUiControl } from "./ConfigurableUiControl";
import { ScreenViewport, IModelApp } from "@bentley/imodeljs-frontend";

/** The base class for Frontstage content controls.
 */
export class ContentControl extends ConfigurableUiControl {
  private _reactElement: React.ReactNode;

  /** Creates an instance of ContentControl.
   * @param info         An object that the subclass must pass to this base class.
   * @param options      Options provided via the applicationData in a [[ContentProps]].
   */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Called when this ContentControl is activated */
  public onActivated(): void {
    if (this.isViewport) { // if viewport make sure the selected view in ViewManager is in sync.
      const me = this;
      this.isReady.then(() => {
        IModelApp.viewManager.setSelectedView(me.viewport);
      });
    }
  }

  /** Called when this ContentControl is deactivated */
  public onDeactivated(): void {
  }

  /** Gets the type of ConfigurableUiControl, which is 'Content' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.Content; }

  /** Returns true if this control is a Viewport control. */
  public get isViewport(): boolean { return false; }

  /** Returns the ScreenViewport if isViewport is true */
  public get viewport(): ScreenViewport | undefined { return undefined; }
  /** Gets the React element associated with this control */
  public get reactElement(): React.ReactNode { return this._reactElement; }
  /** Sets the React element associated with this control */
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }

  /** Get the NavigationAidControl associated with this ContentControl */
  public get navigationAidControl(): string {
    return "";
  }
}

export default ContentControl;
