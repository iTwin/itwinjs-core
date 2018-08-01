/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

/**
 * Class that provides custom request options for all future requests
 */
export class CustomRequestOptions {
  private _customOptions?: { [index: string]: string };

  public setCustomOptions(customOptions?: { [index: string]: string }): void {
    this._customOptions = customOptions;
  }

  public insertCustomOptions(customOptions: any): { [index: string]: string } {
    if (!this._customOptions) {
      return customOptions;
    }
    if (!customOptions) {
      customOptions = {};
    }
    customOptions = { ...customOptions, ...this._customOptions };
    return customOptions;
  }

  public isSet(): boolean {
    return null != this._customOptions;
  }
}
