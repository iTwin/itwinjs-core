/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Describes available safe area insets.
 * @beta
 */
export enum SafeAreaInsets {
  None = 0,
  Bottom = 1 << 0,
  Left = 1 << 1,
  Right = 1 << 2,
  Top = 1 << 3,
  All = SafeAreaInsets.Bottom | SafeAreaInsets.Left | SafeAreaInsets.Right | SafeAreaInsets.Top,
}

/** @internal */
export class SafeAreaInsetsHelpers {
  public static isBottom(flags: SafeAreaInsets) {
    return (SafeAreaInsets.Bottom === (flags & SafeAreaInsets.Bottom));
  }

  public static isLeft(flags: SafeAreaInsets) {
    return (SafeAreaInsets.Left === (flags & SafeAreaInsets.Left));
  }

  public static isRight(flags: SafeAreaInsets) {
    return (SafeAreaInsets.Right === (flags & SafeAreaInsets.Right));
  }

  public static isTop(flags: SafeAreaInsets) {
    return (SafeAreaInsets.Top === (flags & SafeAreaInsets.Top));
  }

  public static getCssClassNames = (flags: SafeAreaInsets) => {
    return {
      "nz-safe-area-bottom": SafeAreaInsetsHelpers.isBottom(flags),
      "nz-safe-area-left": SafeAreaInsetsHelpers.isLeft(flags),
      "nz-safe-area-right": SafeAreaInsetsHelpers.isRight(flags),
      "nz-safe-area-top": SafeAreaInsetsHelpers.isTop(flags),
    };
  };
}
