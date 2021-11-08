/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

/** JSON representation of a [[WhiteOnWhiteReversalSettings]].
 * @public
 */
export interface WhiteOnWhiteReversalProps {
  /** Default: false.
   * @see [[WhiteOnWhiteReversalSettings.ignoreBackgroundColor]].
   */
  ignoreBackgroundColor?: boolean;
}

/** As part of a [[DisplayStyleSettings]], controls how white-on-white reversal is applied to make white geometry more
 * visible in the view.
 * By default, pure white geometry is displayed as black instead if the [[DisplayStyleSettings.backgroundColor]] is also pure white.
 * These settings are only applied if the display style's [[ViewFlags.whiteOnWhiteReversal]] flag is enabled.
 * @see [[DisplayStyleSettings.whiteOnWhiteReversal]] to change these settings for a display style.
 * @public
 */
export class WhiteOnWhiteReversalSettings {
  /** If true, white-on-white reversal ignores the display style's background color; otherwise, white-on-white reversal applies only
   * if the background color is pure white.
   * @see [[DisplayStyleSettings.backgroundColor]] to change the background color.
   */
  public readonly ignoreBackgroundColor: boolean;

  private constructor(ignoreBackground: boolean) {
    this.ignoreBackgroundColor = ignoreBackground;
  }

  private static _noIgnore = new WhiteOnWhiteReversalSettings(true);
  private static _ignore = new WhiteOnWhiteReversalSettings(false);

  /** Create from JSON representation. */
  public static fromJSON(props?: WhiteOnWhiteReversalProps): WhiteOnWhiteReversalSettings {
    return props?.ignoreBackgroundColor ? this._noIgnore : this._ignore;
  }

  /** Convert to JSON representation. The JSON representation is `undefined` if these settings match the defaults. */
  public toJSON(): WhiteOnWhiteReversalProps | undefined {
    return this.ignoreBackgroundColor ? { ignoreBackgroundColor: true } : undefined;
  }

  /** Returns true if `this` is equivalent to `other`. */
  public equals(other: WhiteOnWhiteReversalSettings): boolean {
    return this === other;
  }
}
