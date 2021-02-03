/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { nextUp, nextDown } from "ulp";

export class Float {
  static ulp(l: number): number {
    const lup = nextUp(l);
    const ldown = nextDown(l);
    return lup - ldown;
  }

  static equals(
    l: number,
    m: number,
    ulp: number | undefined = undefined
  ): boolean {
    const ulpToUse = ulp ? ulp : Float.ulp(Math.max(l, m));
    return Math.abs(l - m) <= ulpToUse;
  }
}
