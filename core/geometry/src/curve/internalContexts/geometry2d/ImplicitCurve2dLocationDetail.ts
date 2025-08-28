/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */


import { Angle } from "../../../geometry3d/Angle";
import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { ImplicitCurve2d } from "./implicitCurve2d";

/**
 * ImplicitCurve2dLocationDetail carries a curve and a point of interest.
 * This is typically produced by calculations such as tangent circle contruction to report 
 * where tangencies or other events occur.   Particular meanings of various fields are
 * specific to the code that produces the structure.
 * The "further information" optionally includes a Point2d, an Angle, and an additional Vector2d,
 */
export class ImplicitCurve2dPointnDetail {
    // A curve which is being referenced by this detail.   Externally accessed via properties.
    private _curve: ImplicitCurve2d;
    // An angular parameter.   Externally accessed via properties.
    private _angle?: Angle | undefined;
    // The point of interest.  Typically on the curve, but since the curve's implicit function
    // is defined over the entire 2D plane the point may be elsewhere.
    private _point?: Point2d;
    // (Typically) the curve's tangent vector at the point.
    private _tangentVector?: Vector2d;
    // (Typically) the gradient vector for the curve's implicit function
    private _gradientVector?: Vector2d;
    // (Typically) the curve's implicit function value at the point.
    private _functionValue?: number;
    /** point getter -- returns a CLONE of the point in the detail. */
    public get point(): Point2d | undefined {
        return this._point === undefined ? undefined : this._point.clone();
    }
    /** point setter -- saves a CLONE of the input point. */
    public set point(pointToClone: Point2d) {
        this._point = pointToClone.clone();
    }
    /** gradientVector getter -- returns a CLONE of the _gradientVector in the detail. */
    public get gradientVector(): Vector2d | undefined {
        return this._gradientVector === undefined ? undefined : this._gradientVector.clone();
    }
    /** gradientVector setter -- saves a CLONE of the input _gradientVector. */
    public set gradientVector(vectorToClone: Vector2d) {
        this._gradientVector = vectorToClone.clone();
    }
    /** tangentVector getter -- returns a CLONE of the tangentVector in the detail. */
    public get tangentVector(): Vector2d | undefined {
        return this._tangentVector === undefined ? undefined : this._tangentVector.clone();
    }
    /** tangentVector setter -- saves a CLONE of the input tangentVector. */
    public set tangentVector(vectorToClone: Vector2d) {
        this._tangentVector = vectorToClone.clone();
    }
    /** angle getter -- returns a CLONE of the angle in the detail. */
    public get angle(): Angle | undefined {
        return this._angle === undefined ? undefined : this._angle.clone();
    }
    /** angle setter -- saves a CLONE of the input angle. */
    public set angle(angleToClone: Angle) {
        this._angle = angleToClone.clone();
    }
    /** functionValue getter -- returns the stored function value. */
    public get functionValue(): number | undefined {
        return this._functionValue;
    }
    /** functionValue setter -- saves a the input value. */
    public set functionValue(value: number | undefined) {
        this._functionValue = value;
    }
    private constructor(curve: ImplicitCurve2d, point?: Point2d, angle?: Angle) {
        this._point = (point === undefined) ? Point2d.createZero() : Point2d.createZero();
        this._curve = curve;
        this._angle = angle;
    }
    /**
     * Create a detail with a curve but all other content undefined.
     * @param curve curve reference. This reference is copied into the detail -- not cloned.
     * @param point optional point. If undefined, the detail will have a zero point.
     * @param angle optional angle. If undefined, the detail will have a zero angle.
     * @returns ImplicitCurve2dLocationDetail with the curve reference and optional point and angle.
     */
    public static createDetail(
        curve: ImplicitCurve2d, point: Point2d | undefined, angle: Angle | undefined,
    ): ImplicitCurve2dPointnDetail {
        return new ImplicitCurve2dPointnDetail(curve, point, angle);
    }
    /** Evaluate the curve at given angle and aave the angle and point. */
    public evaluateCurvePoint(angle: Angle): void {
        this._angle = angle;
        this._point = this._curve.radiansToPoint2d(angle.radians);
    }
    /** Evaluate the curve point, tangent, gradient, and function */
    public evaluatePointFunctionGradient(angle: Angle): boolean {
        this._angle = angle;
        this._point = this._curve.radiansToPoint2d(angle.radians);
        if (this._point === undefined) {
            this._tangentVector = undefined;
            this._functionValue = undefined;;
            this._gradientVector = undefined;
            return false;
        } else {
            this._tangentVector = this._curve.radiansToTangentVector2d(angle.radians);
            this._functionValue = this._curve.functionValue(this._point);
            this._gradientVector = this._curve.gradient(this._point);
            return true;
        }
    }
}
