/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { } from "../PointVector";
import { Range3d } from "../Range";
import { Transform} from "../Transform";

import { CurveCollection } from "../curve/CurveChain";
import { GeometryQuery, CurvePrimitive } from "../curve/CurvePrimitive";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../GeometryHandler";
import { SolidPrimitive } from "./SolidPrimitive";
import { SweepContour } from "./SweepContour";
import { ConstructCurveBetweenCurves } from "../curve/ConstructCurveBetweenCurves";

export class RuledSweep extends SolidPrimitive {
  private contours: SweepContour[];
  private constructor(contours: SweepContour[], capped: boolean) {
    super(capped);
    this.contours = contours;
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
  public sweepContoursRef(): SweepContour[] { return this.contours; }

  public cloneSweepContours(): SweepContour[] {
    const result = [];
    for (const sweepable of this.contours) {
      result.push(sweepable.clone());
    }
    return result;
  }
  public cloneContours(): CurveCollection[] {
    const result = [];
    for (const sweepable of this.contours) {
      result.push(sweepable.curves.clone() as CurveCollection);
    }
    return result;
  }

  public clone(): RuledSweep {
    return new RuledSweep(this.cloneSweepContours(), this.capped);
  }
  public tryTransformInPlace(transform: Transform): boolean {
    for (const contour of this.contours) {
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
    if (this.contours.length === 0) return undefined;
    return this.contours[0].localToWorld.cloneRigid();
  }

  public isSameGeometryClass(other: any): boolean { return other instanceof RuledSweep; }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof RuledSweep) {
      if (this.capped !== other.capped) return false;
      if (this.contours.length !== other.contours.length) return false;
      for (let i = 0; i < this.contours.length; i++) {
        if (!this.contours[i].isAlmostEqual(other.contours[i]))
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
    const numSection = this.contours.length;
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
    return CurveCollection.mutatePartners(this.contours[section0].curves, this.contours[section1].curves,
      (primitive0: CurvePrimitive, primitive1: CurvePrimitive): CurvePrimitive | undefined => {
        const newPrimitive = ConstructCurveBetweenCurves.InterpolateBetween(primitive0, localFraction, primitive1);
        if (newPrimitive instanceof CurvePrimitive) return newPrimitive;
        return undefined;
      });
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    for (const contour of this.contours)
      contour.curves.extendRange(rangeToExtend, transform);
  }

}
