/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Solid
 */

import { ConstructCurveBetweenCurves } from "../curve/ConstructCurveBetweenCurves";
import { AnyCurve } from "../curve/CurveTypes";
import { CurveChain, CurveCollection } from "../curve/CurveCollection";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { SolidPrimitive } from "./SolidPrimitive";
import { SweepContour } from "./SweepContour";

/**
 * Type for a function argument taking 2 curves and returning another curve or failing with undefined.
 * * This is used (for instance) by `RuleSweep.mutatePartners`.
 * @public
 */
export type CurvePrimitiveMutator = (primitiveA: CurvePrimitive, primitiveB: CurvePrimitive) => CurvePrimitive | undefined;
/**
 * A ruled sweep (surface) is a collection of 2 or more contours.
 * * All contours must have identical number and type of geometry: (paths, loops, parity regions, lines, arcs, other curves).
 * @public
 */
export class RuledSweep extends SolidPrimitive {
  /** String name for schema properties. */
  public readonly solidPrimitiveType = "ruledSweep";

  private _contours: SweepContour[];
  private constructor(contours: SweepContour[], capped: boolean) {
    super(capped);
    this._contours = contours;
  }
  /**
   * Create a ruled sweep from an array of contours.
   * * The contours are CAPTURED (not cloned).
   */
  public static create(contours: AnyCurve[], capped: boolean): RuledSweep | undefined {
    const sweepContours = [];
    for (const contour of contours) {
      const sweepable = SweepContour.createForLinearSweep(contour);
      if (sweepable === undefined)
        return undefined;
      sweepContours.push(sweepable);
    }
    return new RuledSweep(sweepContours, capped);
  }
  /** Return a reference to the array of SweepContour. */
  public sweepContoursRef(): SweepContour[] {
    return this._contours;
  }
  /**
   * Return clones of the sweep contours.
   * * See also [[cloneContours]], which returns the contours without their local coordinate system definitions.
   */
  public cloneSweepContours(): SweepContour[] {
    const result = [];
    for (const sweepable of this._contours) {
      result.push(sweepable.clone());
    }
    return result;
  }
  /**
   * Return clones of the sweep contours, each as a [[CurveCollection]].
   * * See also [[cloneSweepContours]], which returns the contours with their local coordinate system definitions.
   */
  public cloneContours(): CurveCollection[] {
    const result = [];
    for (const sweepable of this._contours) {
      result.push(sweepable.curves.clone());
    }
    return result;
  }
  /** Return a deep clone. */
  public clone(): RuledSweep {
    return new RuledSweep(this.cloneSweepContours(), this.capped);
  }
  /**
   * Transform all contours in place.
   * * This fails if the transformation is singular.
   */
  public tryTransformInPlace(transform: Transform): boolean {
    if (transform.matrix.isSingular())
      return false;
    for (const contour of this._contours) {
      if (!contour.tryTransformInPlace(transform))
        return false;
    }
    if (transform.matrix.determinant() < 0.0) {
      // if mirror, reverse the sweep order to preserve outward normals
      this._contours.reverse();
    }
    return true;
  }
  /**
   * Return a transformed clone.
   * * This fails if the transformation is singular.
   */
  public cloneTransformed(transform: Transform): RuledSweep | undefined {
    const result = this.clone();
    return result.tryTransformInPlace(transform) ? result : undefined;
  }
  /**
   * Return a coordinate frame (right handed unit vectors)
   * * origin on base contour.
   * * x, y directions from base contour.
   * * z direction perpendicular.
   */
  public getConstructiveFrame(): Transform | undefined {
    if (this._contours.length === 0)
      return undefined;
    return this._contours[0].localToWorld.cloneRigid();
  }
  /** Test if `other` is an instance of a `RuledSweep`. */
  public isSameGeometryClass(other: any): boolean {
    return other instanceof RuledSweep;
  }
  /** Test for near equality of two RuledSweeps. */
  public override isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof RuledSweep) {
      if (this.capped !== other.capped)
        return false;
      if (this._contours.length !== other._contours.length)
        return false;
      for (let i = 0; i < this._contours.length; i++) {
        if (!this._contours[i].isAlmostEqual(other._contours[i]))
          return false;
      }
      return true;
    }
    return false;
  }
  /** Dispatch to strongly typed `handler.handleRuledSweep(this)`. */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleRuledSweep(this);
  }
  /**
   * Return the section curves at a fraction of the sweep.
   * @param vFraction fractional position along the sweep direction.
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const numSection = this._contours.length;
    if (numSection < 2)
      return undefined;
    const q = vFraction * numSection;
    let section0 = 0;
    if (vFraction >= 1.0)
      section0 = numSection - 1;
    else
      section0 = Math.floor(q);
    if (section0 + 1 >= numSection)
      section0 = numSection - 2;
    const section1 = section0 + 1;
    const localFraction = Geometry.clampToStartEnd(q - section0, 0, 1);
    return RuledSweep.mutatePartners(
      this._contours[section0].curves,
      this._contours[section1].curves,
      (primitive0: CurvePrimitive, primitive1: CurvePrimitive): CurvePrimitive | undefined => {
        const newPrimitive = ConstructCurveBetweenCurves.interpolateBetween(primitive0, localFraction, primitive1);
        if (newPrimitive instanceof CurvePrimitive) return newPrimitive;
        return undefined;
      },
    );
  }
  /** Pass each contour to `extendRange`. */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    for (const contour of this._contours)
      contour.curves.extendRange(rangeToExtend, transform);
  }

  /**
   * Construct a CurveCollection with the same structure as collectionA and collectionB, with primitives constructed
   * by the caller-supplied primitiveMutator function.
   * @returns Returns undefined if there is any type mismatch between the two collections.
   */
  public static mutatePartners(
    collectionA: CurveCollection, collectionB: CurveCollection, primitiveMutator: CurvePrimitiveMutator,
  ): CurveCollection | undefined {
    if (!collectionA.isSameGeometryClass(collectionB))
      return undefined;
    if (collectionA instanceof CurveChain && collectionB instanceof CurveChain) {
      const chainA = collectionA;
      const chainB = collectionB;
      const chainC = chainA.cloneEmptyPeer() as CurveChain;
      const childrenA = chainA.children;
      const childrenB = chainB.children;
      if (childrenA.length !== childrenB.length)
        return undefined;
      for (let i = 0; i < childrenA.length; i++) {
        const newChild = primitiveMutator(childrenA[i], childrenB[i]);
        if (!newChild)
          return undefined;
        chainC.children.push(newChild);
      }
      return chainC;
    } else if (collectionA instanceof CurveCollection && collectionB instanceof CurveCollection) {
      const collectionC = collectionA.cloneEmptyPeer();
      const childrenA = collectionA.children;
      const childrenB = collectionB.children;
      const childrenC = collectionC.children;
      if (childrenA === undefined || childrenB === undefined || childrenC === undefined || childrenA.length !== childrenB.length)
        return undefined;
      for (let i = 0; i < childrenA.length; i++) {
        const childA = childrenA[i];
        const childB = childrenB[i];
        if (childA instanceof CurvePrimitive && childB instanceof CurvePrimitive) {
          const newPrimitive = primitiveMutator(childA, childB);
          if (!newPrimitive)
            return undefined;
          childrenC.push(newPrimitive);
        } else if (childA instanceof CurveCollection && childB instanceof CurveCollection) {
          const newChild = this.mutatePartners(childA, childB, primitiveMutator);
          if (!newChild)
            return undefined;
          if (newChild instanceof CurveCollection)
            childrenC.push(newChild);
        }
      }
      return collectionC;
    }
    return undefined;
  }
  /**
   * @return true if this is a closed volume.
   */
  public get isClosedVolume(): boolean {
    const n = this._contours.length;
    return n > 1 && (this.capped || this._contours[0].isAlmostEqual(this._contours[n - 1]));
  }
}
