/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";

import { CurveCollection } from "../curve/CurveCollection";
import { GeometryQuery } from "../curve/GeometryQuery";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { SolidPrimitive } from "./SolidPrimitive";
import { SweepContour } from "./SweepContour";
import { ConstructCurveBetweenCurves } from "../curve/ConstructCurveBetweenCurves";
import { CurveChain } from "../curve/CurveCollection";

export class RuledSweep extends SolidPrimitive {
  private _contours: SweepContour[];
  private constructor(contours: SweepContour[], capped: boolean) {
    super(capped);
    this._contours = contours;
  }

  public static create(contours: CurveCollection[], capped: boolean): RuledSweep | undefined {
    const sweepContours = [];
    for (const contour of contours) {
      const sweepable = SweepContour.createForLinearSweep(contour);
      if (sweepable === undefined) return undefined;
      sweepContours.push(sweepable);
    }
    return new RuledSweep(sweepContours, capped);
  }
  /** @returns Return a reference to the array of sweep contours. */
  public sweepContoursRef(): SweepContour[] { return this._contours; }

  public cloneSweepContours(): SweepContour[] {
    const result = [];
    for (const sweepable of this._contours) {
      result.push(sweepable.clone());
    }
    return result;
  }
  public cloneContours(): CurveCollection[] {
    const result = [];
    for (const sweepable of this._contours) {
      result.push(sweepable.curves.clone() as CurveCollection);
    }
    return result;
  }

  public clone(): RuledSweep {
    return new RuledSweep(this.cloneSweepContours(), this.capped);
  }
  public tryTransformInPlace(transform: Transform): boolean {
    for (const contour of this._contours) {
      contour.tryTransformInPlace(transform);
    }
    return true;
  }
  public cloneTransformed(transform: Transform): RuledSweep {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  /** Return a coordinate frame (right handed unit vectors)
   * * origin on base contour
   * * x, y directions from base contour.
   * * z direction perpenedicular
   */
  public getConstructiveFrame(): Transform | undefined {
    if (this._contours.length === 0) return undefined;
    return this._contours[0].localToWorld.cloneRigid();
  }

  public isSameGeometryClass(other: any): boolean { return other instanceof RuledSweep; }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof RuledSweep) {
      if (this.capped !== other.capped) return false;
      if (this._contours.length !== other._contours.length) return false;
      for (let i = 0; i < this._contours.length; i++) {
        if (!this._contours[i].isAlmostEqual(other._contours[i]))
          return false;
      }
      return true;
    }
    return false;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleRuledSweep(this);
  }
  /**
   * @returns Return the section curves at a fraction of the sweep
   * @param vFraction fractional position along the sweep direction
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
    return RuledSweep.mutatePartners(this._contours[section0].curves, this._contours[section1].curves,
      (primitive0: CurvePrimitive, primitive1: CurvePrimitive): CurvePrimitive | undefined => {
        const newPrimitive = ConstructCurveBetweenCurves.InterpolateBetween(primitive0, localFraction, primitive1);
        if (newPrimitive instanceof CurvePrimitive) return newPrimitive;
        return undefined;
      });
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    for (const contour of this._contours)
      contour.curves.extendRange(rangeToExtend, transform);
  }

  /** Construct a CurveCollection with the same structure as collectionA and collectionB, with primitives constructed by the caller-supplied primitiveMutator function.
   * @returns Returns undefined if there is any type mismatch between the two collections.
   */
  public static mutatePartners(collectionA: CurveCollection, collectionB: CurveCollection, primitiveMutator: (primitiveA: CurvePrimitive, primitiveB: CurvePrimitive) => CurvePrimitive | undefined): CurveCollection | undefined {
    if (!collectionA.isSameGeometryClass(collectionB))
      return undefined;
    if (collectionA instanceof CurveChain && collectionB instanceof CurveChain) {
      const chainA = collectionA as CurveChain;
      const chainB = collectionB as CurveChain;
      const chainC = chainA.cloneEmptyPeer() as CurveChain;
      const childrenA = chainA.children;
      const childrenB = chainB.children;
      if (childrenA.length !== childrenA.length)
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
      if (!childrenA || !childrenB || !childrenC)
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

}
