/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Geometry } from "../../../Geometry";
import { Point2d } from "../../../geometry3d/Point2dVector2d";
import { TangentConstruction } from "./TangentConstruction";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "./implicitCurve2d";
import { UnboundedCircle2dByCenterAndRadius } from "./UnboundedCircle2d";
import { UnboundedLine2dByPointAndNormal } from "./UnboundedLine2d";

/**
 * Itemization of constraints for line and circle construction.
 * Not all combinations are solvable!
 * @public
 */

export enum ConstraintType {
  throughPoint,
  radius,
  perpendicularTo,
  tangentTo,
  curveLength
}

export class ConstraintConstruction {
  public constraintType: ConstraintType;
  public curve?: ImplicitCurve2d;
  public point?: Point2d;
  public radius?: number;
  private constructor(constraintType: ConstraintType) {
    this.constraintType = constraintType;
  }
  public static createThroughPoint(point: Point2d): ConstraintConstruction {
    const c = new ConstraintConstruction(ConstraintType.throughPoint);
    c.point = point.clone();
    return c;
  }
  public static createTangentTo(curve: ImplicitCurve2d): ConstraintConstruction {
    const c = new ConstraintConstruction(ConstraintType.tangentTo);
    c.curve = curve.clone();
    return c;
  }
  public static createPerpendicularTo(curve: ImplicitCurve2d): ConstraintConstruction {
    const c = new ConstraintConstruction(ConstraintType.perpendicularTo);
    c.curve = curve.clone();
    return c;
  }
  public static createRadius(radius: number): ConstraintConstruction {
    const c = new ConstraintConstruction(ConstraintType.radius);
    c.radius = radius;
    return c;
  }
  /**
   * Return a clone of this constraint.
   * * point or curve referenced by this constraint are cloned.
   */
  public clone(): ConstraintConstruction {
    const c = new ConstraintConstruction(this.constraintType);
    if (this.curve !== undefined)
      c.curve = this.curve.clone();
    if (this.point !== undefined)
      c.point = this.point.clone();
    if (this.radius !== undefined)
      c.radius = this.radius;
    return c;
  }
}

export class ConstraintSet {
  private _constraints: ConstraintConstruction[];
  private constructor() {
    this._constraints = [];
  }
  /** Create an empty constraint set. */
  public static create(): ConstraintSet {
    return new ConstraintSet();
  }
  /** Clone the array. */
  public clone(): ConstraintSet {
    const theClone = ConstraintSet.create();
    for (const c of this._constraints) {
      theClone._constraints.push(c.clone());
    }
    return theClone;
  }
  /**
   * Add a new constraint to the array.
   * @param constraint the constraint to add.
   * @returns true if the constraint was accepted.
   */
  public addConstraint(constraint: ConstraintConstruction): boolean {
    this._constraints.push(constraint);
    return true;
  }
  /** Count the constraints of specific type. */
  public countConstraintType(t: ConstraintType): number {
    let n = 0;
    for (const c of this._constraints) {
      if (c.constraintType === t)
        n++;
    }
    return n;
  }
  /** Replace zero radius circle constraints to point constraints. */
  public convertZeroRadiusCirclesToThroughPoint(): void {
    for (let i = 0; i < this._constraints.length; i++) {
      const c = this._constraints[i];
      if (c.constraintType === ConstraintType.tangentTo
        && c.curve !== undefined
        && c.curve instanceof UnboundedCircle2dByCenterAndRadius
        && Geometry.isSmallMetricDistance(c.curve.radius)) {
        const c1 = ConstraintConstruction.createThroughPoint(c.curve.center);
        this._constraints[i] = c1;
      }
    }
  }
  /** Replace point passthrough to zero radius circle tangency. */
  public convertThroughPointToZeroRadiusCircles(): void {
    for (let i = 0; i < this._constraints.length; i++) {
      const c = this._constraints[i];
      if (c.constraintType === ConstraintType.throughPoint && c.point !== undefined) {
        const c1 = ConstraintConstruction.createTangentTo(
          UnboundedCircle2dByCenterAndRadius.createPointRadius(c.point, 0.0))
        this._constraints[i] = c1;
      }
    }
  }
  /** Normalize all line perpendiculars. */
  public normalizeLines(): void {
    for (let i = 0; i < this._constraints.length; i++) {
      const c = this._constraints[i];
      if (c.constraintType === ConstraintType.tangentTo
        && c.curve instanceof UnboundedLine2dByPointAndNormal) {
        const newLine = c.curve.cloneNormalizedFromOrigin();
        if (newLine !== undefined) {
          const c1 = ConstraintConstruction.createTangentTo(newLine);
          this._constraints[i] = c1;
        }
      }
    }
  }
  /**
   * Return
   *   * 1 if the constraint curve is UnboundedLine2dByPointAndNormal
   *   * 2 if the constraint curve is UnboundedCircle2dByCenterAndRadius
   *   * 0 otherwise
   * @param c the constraint.
   */
  private static tangentGeometryLineCircleType(c: ConstraintConstruction): number {
    if (c.curve instanceof UnboundedCircle2dByCenterAndRadius)
      return 2;
    if (c.curve instanceof UnboundedLine2dByPointAndNormal)
      return 1;
    return 0;
  }
  /**
   * Sort the given constraints with
   * * Primary sort is on constraint type
   * * For equal constraint type, apply ordering from tangentGeometryType function.
   */
  public static sortByConstraintTypeAndGeometryType(constraints: ConstraintConstruction[]) {
    constraints.sort(
      (a: ConstraintConstruction, b: ConstraintConstruction) => {
        if (a.constraintType === b.constraintType) {
          const ga = this.tangentGeometryLineCircleType(a);
          const gb = this.tangentGeometryLineCircleType(b);
          if (ga === gb)
            return 0;
          return ga < gb ? -1 : 1;
        }
        return (a.constraintType < b.constraintType) ? -1 : 1;
      }
    )
  }
  /**
   * Given an array of constraint requests (e.g. tangent to circle, tangent to line, etc),
   * construct all circles that satisfy the conditions.
   * * Circles are defined by 3 conditions, so there is null output for inputs with other than 3 constraints.
   * * Returns undefined if no solver is available for the requested constraints.
   * @returns Array of circles with markup about how or where the constraints are satisfied.
   */
  public constructConstrainedCircles(): ImplicitGeometryMarkup<UnboundedCircle2dByCenterAndRadius>[] | undefined {
    if (this._constraints.length !== 3)
      return undefined;
    const constraints = this.clone();
    constraints.convertThroughPointToZeroRadiusCircles();
    constraints.normalizeLines();
    ConstraintSet.sortByConstraintTypeAndGeometryType(constraints._constraints);
    // note that pass-through points are now tangentTo circles with zero radius
    const numTangent = constraints.countConstraintType(ConstraintType.tangentTo);
    const numRadius = constraints.countConstraintType(ConstraintType.radius);
    const c0 = constraints._constraints[0];
    const c1 = constraints._constraints[1];
    const c2 = constraints._constraints[2];
    if (numTangent === 3) {
      // radius comes first, then line(s), then circle(s); once a circle is encountered, the rest must be circles
      if (c0.curve instanceof UnboundedLine2dByPointAndNormal) {
        if (c1.curve instanceof UnboundedLine2dByPointAndNormal) {
          if (c2.curve instanceof UnboundedLine2dByPointAndNormal) {
            return TangentConstruction.circlesTangentLLL(c0.curve, c1.curve, c2.curve);
          } else if (c2.curve instanceof UnboundedCircle2dByCenterAndRadius) {
            return TangentConstruction.circlesTangentLLC(c0.curve, c1.curve, c2.curve);
          }
        } else if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          if (c2.curve instanceof UnboundedCircle2dByCenterAndRadius) {
            return TangentConstruction.circlesTangentCCL(c1.curve, c2.curve, c0.curve);
          }
        }
      } else if (c0.curve instanceof UnboundedCircle2dByCenterAndRadius) {
        if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius
          && c2.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.circlesTangentCCC(c0.curve, c1.curve, c2.curve);
        }
      }
    } else if (numRadius === 1 && numTangent === 2 && c0.radius !== undefined) {
      if (c1.curve instanceof UnboundedLine2dByPointAndNormal) {
        if (c2.curve instanceof UnboundedLine2dByPointAndNormal) {
          return TangentConstruction.circlesTangentLLR(c1.curve, c2.curve, c0.radius);
        } else if (c2.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.circlesTangentCLR(c2.curve, c1.curve, c0.radius);
        }
      } else if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius) {
        if (c2.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.circlesTangentCCR(c1.curve, c2.curve, c0.radius);
        }
      }
    }
    return undefined;
  }
  /**
   * Given an array of constraint requests (e.g. tangent to circle, tangent to line, etc),
   * construct all lines that satisfy the conditions.
   * * Lines are defined by 2 conditions, so there is null output for inputs with other than 2 constraints.
   * * Returns undefined if no solver is available for the requested constraints.
   * @returns Array of lines with markup about how or where the constraints are satisfied.
   */
  public constructConstrainedLines(): ImplicitGeometryMarkup<UnboundedLine2dByPointAndNormal>[] | undefined {
    if (this._constraints.length !== 2)
      return undefined;
    const constraints = this.clone();
    constraints.convertThroughPointToZeroRadiusCircles();
    constraints.normalizeLines();
    ConstraintSet.sortByConstraintTypeAndGeometryType(constraints._constraints);
    // note that pass-through points are now tangentTo circles with zero radius
    const numTangent = constraints.countConstraintType(ConstraintType.tangentTo);
    const numPerp = constraints.countConstraintType(ConstraintType.perpendicularTo);
    const c0 = constraints._constraints[0];
    const c1 = constraints._constraints[1];
    if (numTangent === 2) {
      if (c0.curve instanceof UnboundedCircle2dByCenterAndRadius) {
        if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.linesTangentCC(c1.curve, c0.curve);
        }
      }
    } else if (numPerp === 2) {
      if (c0.curve instanceof UnboundedCircle2dByCenterAndRadius) {
        if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.linesPerpCPerpC(c0.curve, c1.curve);
        }
      } else if (c0.curve instanceof UnboundedLine2dByPointAndNormal) {
        if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.linesPerpLPerpC(c0.curve, c1.curve);
        }
      }
    } else if (numPerp === 1 && numTangent === 1) {
      // the tangent comes second and must be a circle
      if (c1.curve instanceof UnboundedCircle2dByCenterAndRadius) {
        if (c0.curve instanceof UnboundedCircle2dByCenterAndRadius) {
          return TangentConstruction.linesPerpCTangentC(c0.curve, c1.curve);
        } else if (c0.curve instanceof UnboundedLine2dByPointAndNormal) {
          return TangentConstruction.linesPerpLTangentC(c0.curve, c1.curve);
        }
      }
    }
    return undefined;
  }
}
