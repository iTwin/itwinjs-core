/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { CurveCollection } from "../curve/CurveChain";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { Transform } from "../Transform";
/**
 * Base class for SolidPrimitve variants.
 *
 * * Base class holds capped flag for all derived classes.
 */
export abstract class SolidPrimitive extends GeometryQuery {
  protected capped: boolean;
  protected constructor(capped: boolean) { super(); this.capped = capped; }
  public getCapped(): boolean { return this.capped; }
  public setCapped(capped: boolean) { this.capped = capped; }
  public abstract constantVSection(_vFraction: number): CurveCollection | undefined;
  /** Return a Transform from the local system of the solid to world.
   * * The particulars of origin and orientation are specific to each SolidPrimitive type.
   */
  public abstract getConstructiveFrame(): Transform | undefined;
}
