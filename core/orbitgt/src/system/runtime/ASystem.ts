/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

/**
 * Class ASystem defines low level capabilities of the runtime platform.
 */
/** @internal */
export class ASystem {
  private static TIME0: number = new Date().getTime();

  private constructor() {}

  public static assert0(condition: boolean, message: string): void {
    if (condition == false) throw new Error("Assert failed: " + message);
  }

  public static assertNot(condition: boolean, message: string): void {
    if (condition) throw new Error("AssertNot failed: " + message);
  }

  public static time(): number {
    return (new Date().getTime() - ASystem.TIME0) / 1000.0; // time in seconds
  }
}
