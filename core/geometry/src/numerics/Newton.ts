/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Numerics */

import { Geometry } from "../Geometry";
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
    this.stepSizeTolerance = stepSizeTolerance;
    this.successiveConvergenceTarget = successiveConvergenceTarget;
    this.maxIterations = maxIterations;
  }
  protected numAccepted: number = 0;
  protected successiveConvergenceTarget: number;
  protected stepSizeTolerance: number;
  protected maxIterations: number;
  public numIterations: number = 0;
  public testConvergence(delta: number): boolean {
    if (Math.abs(delta) < this.stepSizeTolerance) {
      this.numAccepted++;
      return this.numAccepted >= this.successiveConvergenceTarget;
    }
    this.numAccepted = 0;
    return false;
  }

  public runIterations(): boolean {
    this.numAccepted = 0;
    this.numIterations = 0;
    while (this.numIterations++ < this.maxIterations && this.computeStep()) {
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
  private func: NewtonEvaluatorRtoRD;
  private currentStep!: number;
  private currentX!: number;
  private target!: number;
  public constructor(func: NewtonEvaluatorRtoRD) {
    super();
    this.func = func;
    this.setTarget(0);
  }
  public setX(x: number): boolean { this.currentX = x; return true; }
  public getX(): number { return this.currentX; }
  public setTarget(y: number) { this.target = y; }
  public applyCurrentStep(): boolean { return this.setX(this.currentX - this.currentStep); }
  /** Univariate newton step : */
  public computeStep(): boolean {
    if (this.func.evaluate(this.currentX)) {
      const dx = Geometry.conditionalDivideFraction(this.func.currentF - this.target, this.func.currentdFdX);
      if (dx !== undefined) {
        this.currentStep = dx;
        return true;
      }
    }
    return false;
  }

  public currentStepSize(): number {
    return Math.abs(this.currentStep / (1.0 + Math.abs(this.currentX)));
  }
}

/** object to evaluate a newton function (without derivative).  The object must retain most-recent function value.
 */
export abstract class NewtonEvaluatorRtoR {

  public abstract evaluate(x: number): boolean;
  public currentF!: number;
}

export class Newton1dUnboundedApproximateDerivative extends AbstractNewtonIterator {
  private func: NewtonEvaluatorRtoR;
  private currentStep!: number;
  private currentX!: number;
  public derivativeH: number; // step size for approximate derivative

  public constructor(func: NewtonEvaluatorRtoR) {
    super();
    this.func = func;
    this.derivativeH = 1.0e-8;
  }
  public setX(x: number): boolean { this.currentX = x; return true; }
  public getX(): number { return this.currentX; }
  public applyCurrentStep(): boolean { return this.setX(this.currentX - this.currentStep); }
  /** Univariate newton step : */
  public computeStep(): boolean {
    if (this.func.evaluate(this.currentX)) {
      const fA = this.func.currentF;
      if (this.func.evaluate(this.currentX + this.derivativeH)) {
        const fB = this.func.currentF;
        const dx = Geometry.conditionalDivideFraction(fA, (fB - fA) / this.derivativeH);
        if (dx !== undefined) {
          this.currentStep = dx;
          return true;
        }
      }
    }
    return false;
  }

  public currentStepSize(): number {
    return Math.abs(this.currentStep / (1.0 + Math.abs(this.currentX)));
  }
}
