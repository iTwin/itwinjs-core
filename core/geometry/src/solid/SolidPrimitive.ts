/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Solid
 */

import { CurveCollection } from "../curve/CurveCollection";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Transform } from "../geometry3d/Transform";
import { Box } from "./Box";
import { Cone } from "./Cone";
import { LinearSweep } from "./LinearSweep";
import { RotationalSweep } from "./RotationalSweep";
import { RuledSweep } from "./RuledSweep";
import { Sphere } from "./Sphere";
import { TorusPipe } from "./TorusPipe";

/** Describes the concrete type of a [[SolidPrimitive]]. Each type name maps to a specific subclass and can be used for type-switching in conditional statements.
 *
 *  - "box" => [[Box]]
 *  - "cone" => [[Cone]]
 *  - "sphere" => [[Sphere]]
 *  - "linearSweep" => [[LinearSweep]]
 *  - "rotationalSweep" => [[RotationalSweep]]
 *  - "ruledSweep" => [[RuledSweep]]
 *  - "torusPipe" => [[TorusPipe]]
 *
 * @public
 */
export type SolidPrimitiveType = "box" | "cone" | "sphere" | "linearSweep" | "rotationalSweep" | "ruledSweep" | "torusPipe";

/** Union type of all subclasses of [[SolidPrimitive]].
 * @public
 */
export type AnySolidPrimitive = Box | Cone | Sphere | LinearSweep | RotationalSweep | RuledSweep | TorusPipe;

/**
 * Base class for SolidPrimitive variants.
 *
 * * The base class holds capped flag for all derived classes.
 * @public
 */
export abstract class SolidPrimitive extends GeometryQuery {
  /** String name for schema properties */
  public readonly geometryCategory = "solid";
  /** String name for schema properties */
  public abstract readonly solidPrimitiveType: SolidPrimitiveType;

  /** flag indicating whether cap region is considered closed (i.e. a planar region, rather than just a wire in space) */
  protected _capped: boolean;
  protected constructor(capped: boolean) { super(); this._capped = capped; }
  /** Whether this is a capped solid */
  public get capped(): boolean { return this._capped; }
  public set capped(capped: boolean) { this._capped = capped; }
  /** Return a cross section at specified vFraction. */
  public abstract constantVSection(_vFraction: number): CurveCollection | undefined;
  /** Return a Transform from the local system of the solid to world.
   * * The particulars of origin and orientation are specific to each SolidPrimitive type.
   */
  public abstract getConstructiveFrame(): Transform | undefined;
  /**
   * @return true if this is a closed volume.
   * * LinearSweep, Box, Cone only depend on capped.
   * * Sphere affected by capped and latitude sweep
   * * TorusPipe and RotationalSweep affected by capped and sweep
   * * RuledSweep is affected by capped and match of first, last contour
   */
  public abstract get isClosedVolume(): boolean;
}
