/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

import { Geometry } from "../Geometry";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { SmallSystem } from "./Polynomials";

// cspell:word currentdFdX XYRR

/**
 * Base class for Newton iterations in various dimensions.
 * Dimension-specific classes carry all dimension-related data and answer generalized queries from this base class.
 * @internal
 */
export abstract class AbstractNewtonIterator {
  /** Compute a step. The current x and function values must be retained for use in later method calls. */
  public abstract computeStep(): boolean;
  /**
   * Return the current step size, scaled for use in tolerance tests.
   * * This is a single number, typically the max of various per-dimension `dx/(1+x)` for the x and dx of that dimension.
   */
  public abstract currentStepSize(): number;
  /**
   * Apply the current step (in all dimensions).
   * @param isFinalStep true if this is a final step.
   */
  public abstract applyCurrentStep(isFinalStep: boolean): boolean;
  /**
   * The constructor.
   * @param stepSizeTarget tolerance to consider a single step converged.
   * This number should be "moderately" strict. Because 2 successive convergences are required,
   * it is expected that a first "accept" for (say) 10 to 14 digit step will be followed by another
   * iteration. A well behaved newton would then hypothetically double the number of digits to
   * 20 to 28. Since the IEEE double only carries 16 digits, this second-convergence step will
   * typically achieve full precision.
   * @param successiveConvergenceTarget number of successive convergences required for acceptance.
   * @param maxIterations max number of iterations. A typical newton step converges in 3 to 6 iterations.
   * Allow 15 to 20 to catch difficult cases.
   */
  protected constructor(
    stepSizeTolerance: number = 1.0e-11,
    successiveConvergenceTarget: number = 2,
    maxIterations: number = 15,
  ) {
    this._stepSizeTolerance = stepSizeTolerance;
    this._successiveConvergenceTarget = successiveConvergenceTarget;
    this._maxIterations = maxIterations;
  }
  /** Number of consecutive steps which passed convergence condition. */
  protected _numAccepted: number = 0;
  /** Target number of successive convergences. */
  protected _successiveConvergenceTarget: number;
  /** Convergence target (the implementation-specific currentStepSize is compared to this). */
  protected _stepSizeTolerance: number;
  /** Max iterations allowed. */
  protected _maxIterations: number;
  /** Number of iterations (incremented at each step). */
  public numIterations: number = 0;
  /**
   * Test if a step is converged.
   * * Convergence is accepted with enough (_successiveConvergenceTarget) small steps (according to _stepSizeTolerance)
   * occur in succession.
   * @param delta step size as reported by currentStepSize.
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
   * * currentStepSize -- return numeric measure of the step just computed by computeStep.
   * * testConvergence -- test if the step from currentStepSize (along with recent steps) is converged.
   * * applyCurrentStep -- apply the step to the independent variables.
   */
  public runIterations(): boolean {
    this._numAccepted = 0;
    this.numIterations = 0;
    while (this.numIterations++ < this._maxIterations && this.computeStep()) {
      if (this.testConvergence(this.currentStepSize()) && this.applyCurrentStep(true)) {
        // console.log("iter: " + this.numIterations); // print number of Newton iterations for debug
        return true;
      }
      this.applyCurrentStep(false);
    }
    return false;
  }
}
/**
 * Object to evaluate a newton function. The object must retain most-recent function and derivative
 * values for immediate query.
 * @internal
 */
export abstract class NewtonEvaluatorRtoRD {
  /** Evaluate the function and its derivative at x. */
  public abstract evaluate(x: number): boolean;
  /** Most recent function value, i.e., f(x_n). */
  public currentF!: number;
  /** Most recent evaluated derivative, i.e., f'(x_n). */
  public currentdFdX!: number;
}
/**
 * Newton iterator for use when both function and derivative can be evaluated.
 * To solve `f(x) = 0`, the Newton iteration is `x_{n+1} = x_n - dx = x_n - f(x_n)/f'(x_n)`.
 * To solve `f(x) = target` which is equivalent to solving  `g(x) = f(x) - target = 0`, the Newton iteration is
 * `x_{n+1} = x_n - dx = x_n - g(x_n)/g'(x_n) = x_n - (f(x_n)-target)/f'(x_n)`.
 * @internal
 */
export class Newton1dUnbounded extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRtoRD;
  /** Current step is dx. */
  private _currentStep!: number;
  /** Current X is x_n. */
  private _currentX!: number;
  /** The target */
  private _target!: number;
  /**
   * Constructor for 1D newton iteration with derivatives.
   * @param func function that returns both function value and derivative.
   */
  public constructor(func: NewtonEvaluatorRtoRD) {
    super();
    this._func = func;
    this.setTarget(0);
  }
  /** Set the independent variable, i.e., x_n. */
  public setX(x: number): boolean {
    this._currentX = x;
    return true;
  }
  /** Get the independent variable, i.e., x_n. */
  public getX(): number {
    return this._currentX;
  }
  /** Set the target function value. */
  public setTarget(y: number): void {
    this._target = y;
  }
  /** Move the current X by the just-computed step, i.e., `x_n - dx`. */
  public applyCurrentStep(): boolean {
    // console.log(this._currentX - this._currentStep); // print approximations for debug
    return this.setX(this._currentX - this._currentStep);
  }
  /** Compute the univariate newton step dx. */
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
  /** Return the current step size as a relative number, i.e., `|dx / (1 + |x_n|)|`. */
  public currentStepSize(): number {
    return Math.abs(this._currentStep / (1.0 + Math.abs(this._currentX)));
  }
}

/**
 * Object to evaluate a newton function (without derivative). The object must retain most-recent function value.
 * @internal
 */
export abstract class NewtonEvaluatorRtoR {
  /** Evaluate function value into member currentF */
  public abstract evaluate(x: number): boolean;
  /** Most recent function evaluation, i.e., f(x_n). */
  public currentF!: number;
}

/**
 * Newton iteration for a univariate function, using approximate derivatives.
 * To approximate the derivatives we use a small step `h`, i.e., `f'(x_n) = (f(x_n + h) - f(x_n)) / h`.
 * Therefore, to solve `f(x) = 0`, the iteration is
 * `x_{n+1} = x_n - dx = x_n - f(x_n)/f'(x_n) = x_n - f(x_n) * h / (f(x_n + h) - f(x_n))`.
 * @internal
 */
export class Newton1dUnboundedApproximateDerivative extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRtoR;
  /** Current step is dx. */
  private _currentStep!: number;
  /** Current X is x_n. */
  private _currentX!: number;
  /**
   * Step size for approximate derivative for the iteration.
   * * Initialized to 1e-8, which is appropriate for iteration in fraction space.
   * * Should be larger for iteration with real distance as x.
   */
  public derivativeH: number; // h

  /**
   * Constructor for 1D newton iteration with approximate derivatives.
   * @param func function that only returns function value (and not derivative).
   */
  public constructor(func: NewtonEvaluatorRtoR) {
    super();
    this._func = func;
    this.derivativeH = 1.0e-8;
  }
  /** Set the independent variable, i.e., x_n. */
  public setX(x: number): boolean {
    this._currentX = x;
    return true;
  }
  /** Get the independent variable, i.e., x_n. */
  public getX(): number {
    return this._currentX;
  }
  /** Move the current X by the just-computed step, i.e., `x_n - dx`. */
  public applyCurrentStep(): boolean {
    // console.log(this._currentX - this._currentStep); // print approximations for debug
    return this.setX(this._currentX - this._currentStep);
  }
  /** Univariate newton step dx, computed with approximate derivative. */
  public computeStep(): boolean {
    if (this._func.evaluate(this._currentX)) {
      const fA = this._func.currentF; // f(x_n)
      if (this._func.evaluate(this._currentX + this.derivativeH)) {
        const fB = this._func.currentF; // f(x_n + h)
        const dx = Geometry.conditionalDivideFraction(fA, (fB - fA) / this.derivativeH);
        if (dx !== undefined) {
          this._currentStep = dx;
          return true;
        }
      }
    }
    return false;
  }
  /** Return the current step size as a relative number, i.e., `|dx / (1 + |x_n|)|`. */
  public currentStepSize(): number {
    return Math.abs(this._currentStep / (1.0 + Math.abs(this._currentX)));
  }
}

/**
 * Object to evaluate a 2-parameter newton function with derivatives.
 * @internal
 */
export abstract class NewtonEvaluatorRRtoRRD {
  /**
   * Iteration controller calls this to ask for evaluation of the function and its two partial derivatives.
   * * The implementation returns true, it must set the currentF object.
   */
  public abstract evaluate(x: number, y: number): boolean;
  /**
   * Most recent function evaluation as parts of the plane.
   * * See doc of [[Newton2dUnboundedWithDerivative]] class for info on 2d newton method.
   * * For `F(u,v) := (x(u,v), y(u,v))` the returned plane stores the following evaluations at current value `X := (u,v)`:
   * * `origin` = F(X) = (x(X), y(X))
   * * `vectorU` = F_u(X) = partial deriv of F wrt u at X = (x_u(X), y_u(X)) = 1st col of Jacobian matrix evaluated at X
   * * `vectorV` = F_v(X) = partial deriv of F wrt v at X = (x_v(X), y_v(X)) = 2nd col of Jacobian matrix evaluated at X
   */
  public currentF!: Plane3dByOriginAndVectors;
  /**
   * Constructor.
   * * This creates a currentF object to (repeatedly) receive function and derivatives.
   */
  public constructor() {
    this.currentF = Plane3dByOriginAndVectors.createXYPlane();
  }
}

/**
 * Implement evaluation steps for newton iteration in 2 dimensions, using caller supplied NewtonEvaluatorRRtoRRD object.
 * * Suppose we want to find the roots of `F(u,v) := (x(u,v), y(u,v))`. Writing `X := (u,v)` and `F(X)` as column vectors,
 *  the 2D Newton's iteration to find a root of `F` is given by:
 * `X_{n+1} = X_n - dX = X_n - JInv(X_n)F(X_n)`, where `JInv` is the inverse of the Jacobian matrix `J`, and `J` is
 * defined by the partial derivatives of the component functions of F:
 *
 * `[dx/du   dx/dv]`
 *
 * `[dy/du   dy/dv]`
 * @internal
 */
export class Newton2dUnboundedWithDerivative extends AbstractNewtonIterator {
  private _func: NewtonEvaluatorRRtoRRD;
  /** Current step, or dX = (du, dv). */
  private _currentStep: Vector2d;
  /** Current uv parameters, or X_n = (u_n, v_n). */
  private _currentUV: Point2d;
  /**
   * Constructor for 2D newton iteration with derivatives.
   * @param func function that returns both function value and derivative.
   */
  public constructor(func: NewtonEvaluatorRRtoRRD) {
    const maxIterations = 100;  // Was default (15). We observed 49 iters to achieve 1e-11 tol with tangent geometry.
    super(undefined, undefined, maxIterations);
    this._func = func;
    this._currentStep = Vector2d.createZero();
    this._currentUV = Point2d.createZero();
  }
  /** Set the current uv parameters, i.e., `X_n = (u_n, v_n)`. */
  public setUV(u: number, v: number): boolean {
    this._currentUV.set(u, v);
    return true;
  }
  /** Get the current u parameter of X_n, i.e., u_n. */
  public getU(): number {
    return this._currentUV.x;
  }
  /** Get the current v parameter of X_n, i.e., v_n. */
  public getV(): number {
    return this._currentUV.y;
  }
  /** Update the current uv parameter by currentStep, i.e., compute `X_{n+1} := X_n - dX = (u_n - du, v_n - dv)`. */
  public applyCurrentStep(): boolean {
    // print approximations for debug
    // console.log("(" + (this._currentUV.x - this._currentStep.x) + "," + (this._currentUV.y - this._currentStep.y) + ")");
    return this.setUV(this._currentUV.x - this._currentStep.x, this._currentUV.y - this._currentStep.y);
  }
  /**
   * Evaluate the functions and derivatives at `X_n = (u_n, v_n)`, and solve the Jacobian matrix equation to
   * compute `dX = (du, dv)`.
   */
  public computeStep(): boolean {
    if (this._func.evaluate(this._currentUV.x, this._currentUV.y)) {
      const fA = this._func.currentF;
      if (  // Given X_{n+1} = X_n - dX = X_n - JInv(X_n) F(X_n), we solve J(X_n) dX = F(X_n) for dX:
        SmallSystem.linearSystem2d(
          fA.vectorU.x, fA.vectorV.x, // x_u(X_n), x_v(X_n): 1st row of J evaluated at X_n
          fA.vectorU.y, fA.vectorV.y, // y_u(X_n), y_v(X_n): 2nd row of J evaluated at X_n
          fA.origin.x, fA.origin.y,   // F(X_n) := (x(X_n), y(X_n))
          this._currentStep,          // dX
        )
      )
        return true;
    }
    return false;
  }
  /**
   * Return the current relative step size, i.e., the larger absolute component of `dX / (1 + |X_n|)`
   */
  public currentStepSize(): number {
    return Geometry.maxAbsXY(
      this._currentStep.x / (1.0 + Math.abs(this._currentUV.x)),
      this._currentStep.y / (1.0 + Math.abs(this._currentUV.y)),
    );
  }
}
/**
 * SimpleNewton has static methods for newton methods with evaluated functions presented as immediate arguments
 * (not function object).
 * @internal
 */
export class SimpleNewton {
  /**
   * Run a one-dimensional newton iteration with separate functions for function and derivative.
   * * Completion is at 2 (TWO) successive passes at `absoluteTolerance + relTol * abs(x)`, where relTol is
   * chosen internally.
   * * `absoluteTolerance` is usually aggressively tight -- should come into play only for x near zero.
   * * The `relTol` is fluffy (for instance around 1e-11) but in properly converging cases the extra pass after
   * first success normally moves to full machine precision.
   * * This is an open-loop newton -- it just runs, and returns undefined if anything bad happens.
   */
  public static runNewton1D(
    x: number,
    func: (x: number) => number | undefined,
    derivative: (x: number) => number | undefined,
    absoluteTolerance: number = Geometry.smallFloatingPoint,
  ): number | undefined {
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
        // console.log(x); // print approximations for debug
        tolerance = absoluteTolerance + Math.abs(x) * relTol;
        if (Math.abs(dx) < tolerance) {
          numConverged++;
          if (dx === 0.0 || numConverged > 1)   // bypass convergence count on true 0 dx
            return x;
        } else {
          numConverged = 0;
        }
      }
    }
    return undefined;
  }
}

/**
 * Class to evaluate XY intersection between 2 curve primitives using the Newton method.
 * @internal
 */
export class CurveCurveIntersectionXYRRToRRD extends NewtonEvaluatorRRtoRRD {
  private _curveP: CurvePrimitive;
  private _curveQ: CurvePrimitive;
  private _rayP: Ray3d;
  private _rayQ: Ray3d;
  constructor(curveP: CurvePrimitive, curveQ: CurvePrimitive) {
    super();
    this._curveP = curveP;
    this._curveQ = curveQ;
    this._rayP = Ray3d.createZero();
    this._rayQ = Ray3d.createZero();
  }
  public evaluate(fractionU: number, fractionV: number): boolean {
    /**
     * To find an intersection between xy-curves P(u) = (x_p(u), y_p(u)) and Q(v) = (x_q(v), y_q(v)) we should solve
     *   F(u,v) := P(u) - Q(v) = (0,0)
     * Using the Newton method we can find the fractions u and v at the intersection via
     *   [u_{n+1}]     [u_n]          [x_p'(u_n)  -x_q'(v_n)]    [x_p(u_n) - x_q(v_n)]
     *              =         -  Inv(                         )
     *   [v_{n+1}]     [v_n]          [y_p'(u_n)  -y_q'(v_n)]    [y_p(u_n) - y_q(v_n)]
     * Note that this is xy intersection so we can ignore z.
     */
    this._curveP.fractionToPointAndDerivative(fractionU, this._rayP);
    this._curveQ.fractionToPointAndDerivative(fractionV, this._rayQ);
    this.currentF.setOriginAndVectorsXYZ(
      this._rayP.origin.x - this._rayQ.origin.x, this._rayP.origin.y - this._rayQ.origin.y, 0.0,
      this._rayP.direction.x, this._rayP.direction.y, 0.0,
      -this._rayQ.direction.x, -this._rayQ.direction.y, 0.0,
    );
    return true;
  }
}

/**
 * Class to evaluate XY close approach between a curve primitive and a point using the Newton method.
 * @internal
 */
export class CurvePointCloseApproachXYRtoRD extends NewtonEvaluatorRtoRD {
  private _curveP: CurvePrimitive;
  private _pointQ: Point3d;
  private _planeP: Plane3dByOriginAndVectors;
  constructor(curveP: CurvePrimitive, pointQ: Point3d) {
    super();
    this._curveP = curveP;
    this._pointQ = pointQ;
    this._planeP = Plane3dByOriginAndVectors.createXYPlane();
  }
  public evaluate(fractionU: number): boolean {
    /**
     * To find a close approach between xy-curve P(u) and xy-point q we should solve
     *    F(u) := P'(u).(P(u) - q) = 0
     * For a solution u, the segment S(u) := P(u) - q is perpendicular to the curve tangent P'(u), which means S(u) is a close approach.
     * Using the Newton method we can find the fractions u at the close approach location via
     *    u_{n+1} = u_n + F(u_n)/F'(u_n) = u_n + [ P'(u_n).S(u_n) ]/[ P''(u_n).S(u_n) + P'(u_n).P'(u_n) ]
     * Note that this is xy close approach so we can ignore z.
     */
    this._curveP.fractionToPointAnd2Derivatives(fractionU, this._planeP);
    const segX = this._planeP.origin.x - this._pointQ.x;
    const segY = this._planeP.origin.y - this._pointQ.y;
    const pDerivX = this._planeP.vectorU.x;
    const pDerivY = this._planeP.vectorU.y;
    const p2DerivX = this._planeP.vectorV.x;
    const p2DerivY = this._planeP.vectorV.y;
    this.currentF = pDerivX * segX + pDerivY * segY;
    this.currentdFdX = p2DerivX * segX + pDerivX * pDerivX + p2DerivY * segY + pDerivY * pDerivY;
    return true;
  }
}

/**
 * Class to evaluate XY close approach between 2 curve primitives using the Newton method.
 * @internal
 */
export class CurveCurveCloseApproachXYRRtoRRD extends NewtonEvaluatorRRtoRRD {
  private _curveP: CurvePrimitive;
  private _curveQ: CurvePrimitive;
  private _planeP: Plane3dByOriginAndVectors;
  private _planeQ: Plane3dByOriginAndVectors;
  constructor(curveP: CurvePrimitive, curveQ: CurvePrimitive) {
    super();
    this._curveP = curveP;
    this._curveQ = curveQ;
    this._planeP = Plane3dByOriginAndVectors.createXYPlane();
    this._planeQ = Plane3dByOriginAndVectors.createXYPlane();
  }
  public evaluate(fractionU: number, fractionV: number): boolean {
    /**
     * To find a close approach between xy-curves P(u) and Q(v) we should solve
     *    F(u,v) := (P'(u).(P(u) - Q(v)), Q'(v).(P(u) - Q(v))) = (0,0)
     * For a solution (u,v), the segment S(u,v) := P(u) - Q(v) is perpendicular to the curve tangents P'(u) and Q'(v),
     * which means S(u,v) is a close approach.
     * Using the Newton method we can find the fractions u and v at the close approach location via
     *   [u_{n+1}]     [u_n]          [P''(u_n).S(u_n,v_n) + P'(u_n).P'(u_n)    -P'(u_n).Q'(v_n)]    [P'(u_n).S(u_n,v_n)]
     *              =         -  Inv(                                                            )
     *   [v_{n+1}]     [v_n]          [Q'(v_n).P'(u_n)     Q''(v_n).S(u_n,v_n) - Q'(v_n).Q'(v_n)]    [Q'(v_n).S(u_n,v_n)]
     * Note that this is xy close approach so we can ignore z.
     */
    this._curveP.fractionToPointAnd2Derivatives(fractionU, this._planeP);
    this._curveQ.fractionToPointAnd2Derivatives(fractionV, this._planeQ);
    const segX = this._planeP.origin.x - this._planeQ.origin.x;
    const segY = this._planeP.origin.y - this._planeQ.origin.y;
    const pDerivX = this._planeP.vectorU.x;
    const pDerivY = this._planeP.vectorU.y;
    const qDerivX = this._planeQ.vectorU.x;
    const qDerivY = this._planeQ.vectorU.y;
    const p2DerivX = this._planeP.vectorV.x;
    const p2DerivY = this._planeP.vectorV.y;
    const q2DerivX = this._planeQ.vectorV.x;
    const q2DerivY = this._planeQ.vectorV.y;
    this.currentF.setOriginAndVectorsXYZ(
      pDerivX * segX + pDerivY * segY,
      qDerivX * segX + qDerivY * segY,
      0.0,
      p2DerivX * segX + p2DerivY * segY + pDerivX * pDerivX + pDerivY * pDerivY,
      qDerivX * pDerivX + qDerivY * pDerivY,
      0.0,
      -(pDerivX * qDerivX + pDerivY * qDerivY),
      q2DerivX * segX + q2DerivY * segY - qDerivX * qDerivX - qDerivY * qDerivY,
      0.0,
    );
    return true;
  }
}
