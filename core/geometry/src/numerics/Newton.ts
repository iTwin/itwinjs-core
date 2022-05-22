/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

import { Geometry } from "../Geometry";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { SmallSystem } from "./Polynomials";

// cspell:word currentdFdX
/** base class for Newton iterations in various dimensions.
 * Dimension-specific classes carry all dimension-related data and answer generalized queries
 * from this base class.
 * @internal
 */
export abstract class AbstractNewtonIterator {
  /** Compute a step.  The current x and function values must be retained for use in later method calls */
  public abstract computeStep(): boolean;
  /** return the current step size, scaled for use in tolerance tests.
   * * This is a single number, typically the max of various per-dimension `dx / (1+x)` for the x and dx of that dimension.
   */
  public abstract currentStepSize(): number;
  /**
   * Apply the current step (in all dimensions)
   * @param isFinalStep true if this is a final step.
   */
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
  /** Number of consecutive steps which passed convergence condition */
  protected _numAccepted: number = 0;
  /** Target number of successive convergences */
  protected _successiveConvergenceTarget: number;
  /** convergence target (the implementation-specific currentStepSize is compared to this) */
  protected _stepSizeTolerance: number;
  /** Max iterations allowed */
  protected _maxIterations: number;
  /** number of iterations (incremented at each step) */
  public numIterations: number = 0;
  /**
   * Test if a step is converged.
   * * Convergence is accepted with enough (_successiveConvergenceTarget) small steps (according to _stepSizeTolerance) occur in succession.
   * @param delta step size as reported by currentStepSize
   */
  public testConvergence(delta: number): boolean {
    if (Math.abs(delta) < this._stepSizeTolerance) {
      this._numAccepted++;
      return this._numAccepted >= this._successiveConvergenceTarget;
    }
    this._numAccepted = 0;
    return false;
  }
  /**
   * Run iterations, calling various methods from base and derived classes:
   * * computeStep -- typically evaluate derivatives and solve linear system.
   * * currentStepSize -- return numeric measure of the step just computed by computeStep
   * * testConvergence -- test if the step from currentStepSize (along with recent steps) is converged.
   * * applyCurrentStep -- apply the step to the independent variables
   */
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
 * @internal
 */
export abstract class NewtonEvaluatorRtoRD {
  /** evaluate the function and its derivative at x. */
  public abstract evaluate(x: number): boolean;
  /** most recent function value */
  public currentF!: number;
  /** most recent evaluated derivative */
  public currentdFdX!: number;
}
/**
 * Newton iterator for use when both function and derivative can be evaluated.
 * @internal
 */
export class Newton1dUnbounded extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRtoRD;
  private _currentStep!: number;
  private _currentX!: number;
  private _target!: number;
  /**
   * Constructor for 1D newton iteration with approximate derivatives.
   * @param func function that returns both function and derivative.
   */
  public constructor(func: NewtonEvaluatorRtoRD) {
    super();
    this._func = func;
    this.setTarget(0);
  }
  /** Set the independent variable */
  public setX(x: number): boolean { this._currentX = x; return true; }
  /** Get the independent variable */
  public getX(): number { return this._currentX; }
  /** Set the target function value */
  public setTarget(y: number) { this._target = y; }
  /** move the current X by the just-computed step */
  public applyCurrentStep(): boolean { return this.setX(this._currentX - this._currentStep); }
  /** Compute the univariate newton step. */
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
  /** Return the current step size as a relative number. */
  public currentStepSize(): number {
    return Math.abs(this._currentStep / (1.0 + Math.abs(this._currentX)));
  }
}

/** object to evaluate a newton function (without derivative).  The object must retain most-recent function value.
 * @internal
 */
export abstract class NewtonEvaluatorRtoR {
  /** Evaluate function value into member currentF */
  public abstract evaluate(x: number): boolean;
  /** Most recent function evaluation. */
  public currentF!: number;
}

/** Newton iteration for a univariate function, using approximate derivatives.
 * @internal
 */
export class Newton1dUnboundedApproximateDerivative extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRtoR;
  private _currentStep!: number;
  private _currentX!: number;
  /** Step size for iteration.
   * * Initialized to 1e-8, which is appropriate for iteration in fraction space.
   * * Should be larger for iteration with real distance as x.
   */
  public derivativeH: number; // step size for approximate derivative

  /**
   * Constructor for 1D newton iteration with approximate derivatives.
   * @param func function that returns both function and derivative.
   */
  public constructor(func: NewtonEvaluatorRtoR) {
    super();
    this._func = func;
    this.derivativeH = 1.0e-8;
  }
  /** Set the x (independent, iterated) value */
  public setX(x: number): boolean { this._currentX = x; return true; }
  /** Get the independent variable */
  public getX(): number { return this._currentX; }
  /** move the current X by the just-computed step */
  public applyCurrentStep(): boolean { return this.setX(this._currentX - this._currentStep); }
  /** Univariate newton step computed with APPROXIMATE derivative. */
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

  /** Return the current step size as a relative number. */
  public currentStepSize(): number {
    return Math.abs(this._currentStep / (1.0 + Math.abs(this._currentX)));
  }
}

/** object to evaluate a 2-parameter newton function (with derivatives!!).
 * @internal
 */
export abstract class NewtonEvaluatorRRtoRRD {
  /** Iteration controller calls this to ask for evaluation of the function and its two partial derivatives.
   * * The implementation returns true, it must set the currentF object.
   */
  public abstract evaluate(x: number, y: number): boolean;
  /** most recent function evaluation as xy parts of the plane */
  public currentF!: Plane3dByOriginAndVectors;
  /**
   * constructor.
   * * This creates a currentF object to (repeatedly) receive function and derivatives.
   */
  public constructor() {
    this.currentF = Plane3dByOriginAndVectors.createXYPlane();
  }
}

/**
 * Implement evaluation steps for newton iteration in 2 dimensions, using caller supplied NewtonEvaluatorRRtoRRD object.
 * @internal
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
  /** Set the current uv coordinates for current iteration */
  public setUV(x: number, y: number): boolean { this._currentUV.set(x, y); return true; }
  /** Get the current u coordinate */
  public getU(): number { return this._currentUV.x; }
  /** Get the current v coordinate */
  public getV(): number { return this._currentUV.y; }
  /** Move the currentUV coordinate by currentStep. */
  public applyCurrentStep(): boolean { return this.setUV(this._currentUV.x - this._currentStep.x, this._currentUV.y - this._currentStep.y); }
  /** Evaluate the functions and derivatives at this._currentUV
   * Invert the jacobian and compute the this._currentStep.
   */
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
   * Return the largest relative step of the x,y, components of the current step.
   */
  public currentStepSize(): number {
    return Geometry.maxAbsXY(
      this._currentStep.x / (1.0 + Math.abs(this._currentUV.x)),
      this._currentStep.y / (1.0 + Math.abs(this._currentUV.y)));
  }
}
/**
 * SimpleNewton has static methods for newton methods with evaluated functions presented as immediate arguments (not function object)
 * @internal
 */
export class SimpleNewton {
  /** Run a one-dimensional newton iteration with separate functions for function and derivative.
   * * completion is at 2 (TWO) successive passes at (absoluteTolerance + relTol * abs (x)), where relTol is chosen internally.
   * * absoluteTolerance is usually aggressively tight -- should come into play only for x near zero.
   * * The relTol is fluffy (for instance around 1e-11) but in properly converging cases the extra pass after first success
   *    normally moves to full machine precision.
   * * This is an open-loop newton -- it just runs, and returns undefined if anything bad happens.
   */
  public static runNewton1D(x: number, func: (x: number) => number | undefined, derivative: (x: number) => number | undefined, absoluteTolerance: number = 1.0e-15): number | undefined {
    let numConverged = 0;
    let tolerance: number;
    const relTol = 1.0e-11;
    for (let iteration = 0; iteration < 20; iteration++) {
      const f = func(x);
      const df = derivative(x);
      if (f !== undefined && df !== undefined) {
        const dx = Geometry.conditionalDivideCoordinate(f, df);
        if (dx === undefined)
          return undefined;
        x -= dx;
        tolerance = absoluteTolerance + Math.abs(x) * relTol;
        if (Math.abs(dx) < tolerance) {
          numConverged++;
          if (dx === 0.0 || numConverged > 1)   // bypass convergence count on true 0 dx !
            return x;
        } else {
          numConverged = 0;
        }
      }
    }
    return undefined;
  }
}
