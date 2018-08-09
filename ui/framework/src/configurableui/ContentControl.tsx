/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { ConfigurableUiControlType, ConfigurableCreateInfo, ConfigurableUiControl, IConfigurable } from "./ConfigurableUiControl";

/** The base class for Frontstage content controls.
 */
export class ContentControl extends ConfigurableUiControl {
  private _defaultLayoutIndex: number = 0;
  private _reactElement: React.ReactNode;

  /** Creates an instance of ConfigurableUiContentControl.
   * @param info         An object that the subclass must pass to this base class.
   * @param options      An object which is created on the native part of this control by the function
   *                     @link BentleyApi::DgnClientFx::ConfigurableUi::IConfigurable::_SupplyInitializationOptions
   *                     IConfigurable::_SupplyInitializationOptions @endlink.
   * @note Subclasses must pass all arguments to the base class and not add themselves
   * to any container - the control is added automatically by the @ref ConfigurableUiManager.
   * @protected
   */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options)
      this._defaultLayoutIndex = options.defaultLayoutIndex;
  }

  public getDefaultLayoutIndex(): number { return this._defaultLayoutIndex; }

  protected _canAdopt(other: IConfigurable): boolean {
    if (!super._canAdopt(other))
      return false;

    const otherContentControl = other as ContentControl;
    return this.getConfigurableUiControlId() === otherContentControl.getConfigurableUiControlId();
  }

  protected _adopt(other: IConfigurable): void {
    super._adopt(other);

    const otherContentControl = other as ContentControl;
    // update the layout index of the shelved control to match that specified by the input control
    // this way the order specified in the UIConfig file for the current stage is honored.
    this._defaultLayoutIndex = otherContentControl._defaultLayoutIndex;
  }

  protected _onActivated(): void {
    this.onActivated();
  }

  protected _onDeactivated(): void {
    this.onDeactivated();
  }

  public onActivated(): void {
  }

  public onDeactivated(): void {
  }

  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.Content; }

  public get reactElement(): React.ReactNode { return this._reactElement; }
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }
}

export default ContentControl;
