/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Numerics */

import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { SmallSystem } from "./Polynomials";
/** base class for Newton iterations in various dimensions.
 * Dimension-specific classes carry all dimension-related data and answer generalized queries
 * from this base class.
 */
export abstract class AbstractNewtonIterator {
  /** Compute a step.  The current x and function values must be retained for use in later method calls */
  public abstract computeStep(): boolean;
  /** return the current step size, scaled for use in tolerance tests. */
  public abstract currentStepSize(): number;
  public abstract applyCurrentStep(isFinalStep: boolean): boolean;
  /**
   * @param stepSizeTarget tolerance to consider a single step converged.
   * This number should be "moderately" strict.   Because 2 successive convergences are required,
   * it is expected that a first "accept" for (say) 10 to 14 digit step will be followed by another
   * iteration.   A well behaved newton would then hypothetically double the number of digits to
   * 20 to 28.  Since the IEEE double only carries 16 digits, this second-convergence step will
   * typically achieve full precision.
   * @param successiveConvergenceTarget number of successive convergences required for acceptance.
   * @param maxIterations max number of iterations.   A typical newton step converges in 3 to 6 iterations.
   *     Allow 15 to 20 to catch difficult cases.
   */
  protected constructor(
    stepSizeTolerance: number = 1.0e-11,
    successiveConvergenceTarget: number = 2,
    maxIterations: number = 15) {
    this._stepSizeTolerance = stepSizeTolerance;
    this._successiveConvergenceTarget = successiveConvergenceTarget;
    this._maxIterations = maxIterations;
  }
  protected _numAccepted: number = 0;
  protected _successiveConvergenceTarget: number;
  protected _stepSizeTolerance: number;
  protected _maxIterations: number;
  public numIterations: number = 0;
  public testConvergence(delta: number): boolean {
    if (Math.abs(delta) < this._stepSizeTolerance) {
      this._numAccepted++;
      return this._numAccepted >= this._successiveConvergenceTarget;
    }
    this._numAccepted = 0;
    return false;
  }

  public runIterations(): boolean {
    this._numAccepted = 0;
    this.numIterations = 0;
    while (this.numIterations++ < this._maxIterations && this.computeStep()) {
      if (this.testConvergence(this.currentStepSize())
        && this.applyCurrentStep(true)) {
        return true;
      }
      this.applyCurrentStep(false);
    }
    return false;
  }
}
/** object to evaluate a newton function.  The object must retain most-recent function and derivative
 * values for immediate query.
 */
export abstract class NewtonEvaluatorRtoRD {

  public abstract evaluate(x: number): boolean;
  public currentF!: number;
  public currentdFdX!: number;
}
export class Newton1dUnbounded extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRtoRD;
  private _currentStep!: number;
  private _currentX!: number;
  private _target!: number;
  public constructor(func: NewtonEvaluatorRtoRD) {
    super();
    this._func = func;
    this.setTarget(0);
  }
  public setX(x: number): boolean { this._currentX = x; return true; }
  public getX(): number { return this._currentX; }
  public setTarget(y: number) { this._target = y; }
  public applyCurrentStep(): boolean { return this.setX(this._currentX - this._currentStep); }
  /** Univariate newton step : */
  public computeStep(): boolean {
    if (this._func.evaluate(this._currentX)) {
      const dx = Geometry.conditionalDivideFraction(this._func.currentF - this._target, this._func.currentdFdX);
      if (dx !== undefined) {
        this._currentStep = dx;
        return true;
      }
    }
    return false;
  }

  public currentStepSize(): number {
    return Math.abs(this._currentStep / (1.0 + Math.abs(this._currentX)));
  }
}

/** object to evaluate a newton function (without derivative).  The object must retain most-recent function value.
 */
export abstract class NewtonEvaluatorRtoR {

  public abstract evaluate(x: number): boolean;
  public currentF!: number;
}

/** Newton iteration for a univariate function, using approximate derivatives. */
export class Newton1dUnboundedApproximateDerivative extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRtoR;
  private _currentStep!: number;
  private _currentX!: number;
  public derivativeH: number; // step size for approximate derivative

  public constructor(func: NewtonEvaluatorRtoR) {
    super();
    this._func = func;
    this.derivativeH = 1.0e-8;
  }
  public setX(x: number): boolean { this._currentX = x; return true; }
  public getX(): number { return this._currentX; }
  public applyCurrentStep(): boolean { return this.setX(this._currentX - this._currentStep); }
  /** Univariate newton step : */
  public computeStep(): boolean {
    if (this._func.evaluate(this._currentX)) {
      const fA = this._func.currentF;
      if (this._func.evaluate(this._currentX + this.derivativeH)) {
        const fB = this._func.currentF;
        const dx = Geometry.conditionalDivideFraction(fA, (fB - fA) / this.derivativeH);
        if (dx !== undefined) {
          this._currentStep = dx;
          return true;
        }
      }
    }
    return false;
  }

  public currentStepSize(): number {
    return Math.abs(this._currentStep / (1.0 + Math.abs(this._currentX)));
  }
}

/** object to evaluate a 2-parameter newton function (with derivatives!!).
 */
export abstract class NewtonEvaluatorRRtoRRD {
  /** Iteration controller calls this to ask for evaluation of the function and its two partial derivatives.
   * * The implemention returns true, it must set the currentF object.
   */
  public abstract evaluate(x: number, y: number): boolean;
  /** most recent function evaluation */
  public currentF!: Plane3dByOriginAndVectors;
  /**
   * constructor.
   * * This creates a crrentF object to (repeatedly) receive function and derivatives.
   */
  public constructor() {
    this.currentF = Plane3dByOriginAndVectors.createXYPlane();
  }
}

/**
 * Implement evaluation steps for newton iteration in 2 dimensions.
 */
export class Newton2dUnboundedWithDerivative extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRRtoRRD;
  private _currentStep: Vector2d;
  private _currentUV: Point2d;

  public constructor(func: NewtonEvaluatorRRtoRRD) {
    super();
    this._func = func;
    this._currentStep = Vector2d.createZero();
    this._currentUV = Point2d.createZero();
  }
  public setUV(x: number, y: number): boolean { this._currentUV.set(x, y); return true; }
  public getU(): number { return this._currentUV.x; }
  public getV(): number { return this._currentUV.y; }
  public applyCurrentStep(): boolean { return this.setUV(this._currentUV.x - this._currentStep.x, this._currentUV.y - this._currentStep.y); }
  /** Univariate newton step : */
  public computeStep(): boolean {
    if (this._func.evaluate(this._currentUV.x, this._currentUV.y)) {
      const fA = this._func.currentF;
      if (SmallSystem.linearSystem2d(
        fA.vectorU.x, fA.vectorV.x,
        fA.vectorU.y, fA.vectorV.y,
        fA.origin.x, fA.origin.y, this._currentStep))
        return true;
    }
    return false;
  }
  /**
   * @returns the largest relative step of the x,y, components of the current step.
   */
  public currentStepSize(): number {
    return Geometry.maxAbsXY(
      this._currentStep.x / (1.0 + Math.abs(this._currentUV.x)),
      this._currentStep.y / (1.0 + Math.abs(this._currentUV.y)));
  }
}
