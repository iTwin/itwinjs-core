/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

/** Commonly used constant values. */
export class Constant {
  public static readonly oneMillimeter: number = 0.001;
  public static readonly oneCentimeter: number = 0.01;
  public static readonly oneMeter: number = 1.0;
  public static readonly oneKilometer: number = 1000.0;
  public static readonly diameterOfEarth: number = 12742.0 * Constant.oneKilometer;
  public static readonly circumferenceOfEarth: number = 40075.0 * Constant.oneKilometer;
  public static readonly radiansPerDegree: number = 0.0174532925;
}
