/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export const enum PolylineParam {
  kNone = 0,
  kSquare = 1 * 3,
  kMitter = 2 * 3,
  kMiterInsideOnly = 3 * 3,
  kJointBase = 4 * 3,
  kNegatePerp = 8 * 3,
  kNegateAlong = 16 * 3,
  kNoneAdjWt = 32 * 3,
}
