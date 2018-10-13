/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { CurveCollection } from "../curve/CurveCollection";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Transform } from "../geometry3d/Transform";
/**
 * Base class for SolidPrimitve variants.
 *
 * * Base class holds capped flag for all derived classes.
 */
export abstract class SolidPrimitive extends GeometryQuery {
  protected _capped: boolean;
  protected constructor(capped: boolean) { super(); this._capped = capped; }
  /** Ask if this is a capped solid */
  public get capped(): boolean { return this._capped; }
  /** Set the capped flag */
  public set capped(capped: boolean) { this._capped = capped; }
  /** Return a cross section at specified vFraction */
  public abstract constantVSection(_vFraction: number): CurveCollection | undefined;
  /** Return a Transform from the local system of the solid to world.
   * * The particulars of origin and orientation are specific to each SolidPrimitive type.
   */
  public abstract getConstructiveFrame(): Transform | undefined;
}
