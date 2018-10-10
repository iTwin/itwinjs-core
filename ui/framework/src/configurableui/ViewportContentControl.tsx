/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { ConfigurableUiControlType, ConfigurableCreateInfo } from "./ConfigurableUiControl";
import { ContentControl } from "./ContentControl";

import { ScreenViewport } from "@bentley/imodeljs-frontend";

/** The base class for Frontstage Viewport content controls.
 */
export class ViewportContentControl extends ContentControl {
  private _viewport: ScreenViewport | undefined;
  private _isReady: Promise<void>;
  private _viewportReadyCallback?: () => void;

  /** Creates an instance of ViewportContentControl.
   * @param info         An object that the subclass must pass to this base class.
   * @param options      Options provided via the applicationData in a [[ContentProps]].
   */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this._isReady = new Promise<void>((onSuccess: () => void, _onFailure: () => void): void => {
      this._viewportReadyCallback = onSuccess;
    });
  }

  /** Gets the type of ConfigurableUiControl, which is 'Viewport' in this case */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.Viewport; }

  /** Gets the ScreenViewport */
  public get viewport(): ScreenViewport | undefined { return this._viewport; }
  /** Sets the ScreenViewport */
  public set viewport(v: ScreenViewport | undefined) {
    this._viewport = v;
    if (this._viewportReadyCallback) {
      this._viewportReadyCallback();
    }
  }

  /** Returns a promise that resolves when the control is ready for usage.
   */
  public get isReady(): Promise<void> { return this._isReady; }
}
